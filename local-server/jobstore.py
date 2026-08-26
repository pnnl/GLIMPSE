from __future__ import annotations

import gzip
import json
import os
import threading
import time
import uuid
from dataclasses import asdict, dataclass, field

# Job lifecycle. A job is terminal once it is DONE or FAILED.
QUEUED = "queued"
RUNNING = "running"
DONE = "done"
FAILED = "failed"
TERMINAL = (DONE, FAILED)

# How long a finished job and its result stay collectable, and how long an
# accepted-but-unstarted job may sit before it is presumed abandoned.
RESULT_TTL_SECONDS = int(os.environ.get("GLIMPSE_JOB_TTL", "3600"))

# How many times a single job may be handed to a worker. The parse task runs
# with acks_late, so a worker that dies mid-parse — an OOM kill is the realistic
# case, since a 9500-scale parse peaks near 600 MB — has its task redelivered
# rather than silently losing it, which is exactly what should happen to a
# worker replaced during a deploy. The same mechanism is a trap for a model that
# kills whatever tries to parse it: unbounded redelivery of a poison pill takes
# down every worker in turn. Counting attempts on the job record bounds that.
MAX_ATTEMPTS = int(os.environ.get("GLIMPSE_JOB_MAX_ATTEMPTS", "2"))

# The Celery queue parse tasks are published to. Named explicitly because the
# web tier reads its depth directly to shed load: kombu's Redis transport keeps
# a queue's pending messages in a list under exactly this key, so LLEN is the
# queue depth. Renaming the queue without renaming this constant would silently
# report a depth of zero forever.
PARSE_QUEUE = os.environ.get("GLIMPSE_PARSE_QUEUE", "glimpse.parse")


@dataclass
class Job:
    id: str
    state: str = QUEUED
    # Coarse by design: the underlying cimgraph XML parse is a single blocking
    # call with no progress to report, so claiming a percentage would be a lie.
    stage: str = "queued"
    filename: str = ""
    error: str | None = None
    # Incremented each time a worker picks the job up. Above 1 means an earlier
    # attempt died without reporting, and Celery redelivered the task.
    attempts: int = 0
    created_at: float = field(default_factory=time.time)
    started_at: float | None = None
    finished_at: float | None = None

    @property
    def elapsed(self) -> float:
        end = self.finished_at or time.time()
        return end - (self.started_at or self.created_at)

    def to_public_dict(self) -> dict:
        body = asdict(self)
        body["elapsed"] = round(self.elapsed, 1)
        return body


class JobStore:
    """Interface shared by both backends."""

    def submit(self, filename: str, payload: bytes) -> Job:
        raise NotImplementedError

    def get(self, job_id: str) -> Job | None:
        raise NotImplementedError

    def result(self, job_id: str) -> bytes | None:
        """The finished payload, gzipped, or None."""
        raise NotImplementedError

    def begin(self, job_id: str) -> tuple[Job, bytes] | None:
        """Take a job for execution. Worker side.

        Returns None when there is nothing to run — the job or its upload
        expired, or it has already burned through MAX_ATTEMPTS, in which case it
        is marked failed here so the client gets an answer rather than polling a
        job that no worker will ever pick up again.
        """
        raise NotImplementedError

    def set_stage(self, job_id: str, stage: str) -> None:
        raise NotImplementedError

    def complete(self, job_id: str, body: dict) -> None:
        raise NotImplementedError

    def fail(self, job_id: str, error: str) -> None:
        raise NotImplementedError

    def queue_depth(self) -> int:
        """Parse tasks published but not yet picked up. Drives load shedding."""
        raise NotImplementedError


def _encode_result(body: dict) -> bytes:
    # Stored gzipped and served through untouched, so the result is compressed
    # exactly once no matter how many times it is polled for.
    return gzip.compress(json.dumps(body).encode("utf-8"), compresslevel=6)


class MemoryJobStore(JobStore):
    """In-process store. No cross-replica visibility — dev and tests only."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._jobs: dict[str, Job] = {}
        self._uploads: dict[str, bytes] = {}
        self._results: dict[str, bytes] = {}

    def submit(self, filename: str, payload: bytes) -> Job:
        job = Job(id=uuid.uuid4().hex, filename=filename)
        with self._lock:
            self._jobs[job.id] = job
            self._uploads[job.id] = payload
        return job

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            return self._jobs.get(job_id)

    def result(self, job_id: str) -> bytes | None:
        with self._lock:
            return self._results.get(job_id)

    def begin(self, job_id: str) -> tuple[Job, bytes] | None:
        with self._lock:
            job = self._jobs.get(job_id)
            payload = self._uploads.get(job_id)
            if job is None or payload is None:
                return None
            if job.attempts >= MAX_ATTEMPTS:
                self._fail_locked(job, _exhausted_message(job))
                return None
            job.attempts += 1
            job.state = RUNNING
            job.stage = "parsing"
            job.started_at = time.time()
            return job, payload

    def set_stage(self, job_id: str, stage: str) -> None:
        with self._lock:
            if job_id in self._jobs:
                self._jobs[job_id].stage = stage

    def complete(self, job_id: str, body: dict) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            self._results[job_id] = _encode_result(body)
            job.state = DONE
            job.stage = "done"
            job.finished_at = time.time()
            self._uploads.pop(job_id, None)

    def fail(self, job_id: str, error: str) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is not None:
                self._fail_locked(job, error)

    def _fail_locked(self, job: Job, error: str) -> None:
        job.state = FAILED
        job.stage = "failed"
        job.error = error
        job.finished_at = time.time()
        self._uploads.pop(job.id, None)

    def queue_depth(self) -> int:
        # Nothing is queued in this backend: with no broker, the task runs
        # inline (Celery eager mode) or not at all.
        return 0


def _exhausted_message(job: Job) -> str:
    return (
        f"Parsing {job.filename or 'this model'} failed after {job.attempts} "
        "attempts — the worker did not survive it. The model may be too large "
        "for the available memory."
    )


class RedisJobStore(JobStore):
    """Redis-backed store: the hosted deployment's shared state.

    Celery owns dispatch — which worker runs which job, and redelivery when one
    dies. This holds everything Celery deliberately does not: the job record the
    client polls, the uploaded bytes, and the finished payload.

    Keys, all TTL'd so an abandoned job cannot leak:
      glimpse:job:<id>      hash   - the Job record
      glimpse:upload:<id>   string - the uploaded bytes, dropped once terminal
      glimpse:result:<id>   string - the gzipped payload
    """

    def __init__(self, url: str, ttl: int = RESULT_TTL_SECONDS) -> None:
        self._url = url
        self._ttl = ttl
        self._client = None
        self._client_pid: int | None = None

    @property
    def _redis(self):
        """The Redis client for *this* process.

        gunicorn runs with --preload, so the app is imported once in the master
        and the workers are forked from it. A connection pool created before the
        fork would be shared by every worker, which corrupts protocol state the
        moment two of them use it at once. Keying the client on the pid means
        each process lazily builds its own on first use, and the inherited one is
        never touched.
        """
        pid = os.getpid()
        if self._client is None or self._client_pid != pid:
            import redis  # imported here so the memory backend needs no redis-py

            self._client = redis.Redis.from_url(
                self._url,
                socket_timeout=30,
                socket_connect_timeout=5,
                socket_keepalive=True,
                health_check_interval=30,
            )
            self._client_pid = pid
        return self._client

    # -- key helpers --------------------------------------------------------
    @staticmethod
    def _job_key(job_id: str) -> str:
        return f"glimpse:job:{job_id}"

    @staticmethod
    def _upload_key(job_id: str) -> str:
        return f"glimpse:upload:{job_id}"

    @staticmethod
    def _result_key(job_id: str) -> str:
        return f"glimpse:result:{job_id}"

    def _write(self, job: Job) -> None:
        # Stored as a single JSON string rather than a hash: the record is small,
        # always read whole, and this keeps None/float round-tripping exact.
        self._redis.set(self._job_key(job.id), json.dumps(asdict(job)), ex=self._ttl)

    def _read(self, job_id: str) -> Job | None:
        raw = self._redis.get(self._job_key(job_id))
        return Job(**json.loads(raw)) if raw else None

    # -- JobStore -----------------------------------------------------------
    def submit(self, filename: str, payload: bytes) -> Job:
        job = Job(id=uuid.uuid4().hex, filename=filename)
        pipe = self._redis.pipeline()
        pipe.set(self._upload_key(job.id), payload, ex=self._ttl)
        pipe.set(self._job_key(job.id), json.dumps(asdict(job)), ex=self._ttl)
        pipe.execute()
        return job

    def get(self, job_id: str) -> Job | None:
        return self._read(job_id)

    def result(self, job_id: str) -> bytes | None:
        return self._redis.get(self._result_key(job_id))

    def begin(self, job_id: str) -> tuple[Job, bytes] | None:
        job = self._read(job_id)
        payload = self._redis.get(self._upload_key(job_id))
        if job is None or payload is None:
            # The job expired between being queued and being run.
            return None

        if job.attempts >= MAX_ATTEMPTS:
            self.fail(job_id, _exhausted_message(job))
            return None

        # Read-modify-write rather than an atomic INCR: Celery hands a task to
        # one worker at a time, so there is no concurrent writer here as long as
        # the visibility timeout exceeds the task time limit (see tasks.py).
        job.attempts += 1
        job.state = RUNNING
        job.stage = "parsing"
        job.started_at = time.time()
        self._write(job)
        # The upload deliberately stays in Redis until the job is terminal. It
        # is the only copy, and a redelivered attempt after a worker loss has
        # nothing to parse without it.
        return job, payload

    def set_stage(self, job_id: str, stage: str) -> None:
        job = self._read(job_id)
        if job is None:
            return
        job.stage = stage
        self._write(job)

    def complete(self, job_id: str, body: dict) -> None:
        job = self._read(job_id)
        if job is None:
            return
        job.state = DONE
        job.stage = "done"
        job.finished_at = time.time()
        pipe = self._redis.pipeline()
        pipe.set(self._result_key(job_id), _encode_result(body), ex=self._ttl)
        pipe.set(self._job_key(job_id), json.dumps(asdict(job)), ex=self._ttl)
        pipe.delete(self._upload_key(job_id))
        pipe.execute()

    def fail(self, job_id: str, error: str) -> None:
        job = self._read(job_id)
        if job is None:
            return
        job.state = FAILED
        job.stage = "failed"
        job.error = error
        job.finished_at = time.time()
        pipe = self._redis.pipeline()
        pipe.set(self._job_key(job_id), json.dumps(asdict(job)), ex=self._ttl)
        pipe.delete(self._upload_key(job_id))
        pipe.execute()

    def queue_depth(self) -> int:
        try:
            return int(self._redis.llen(PARSE_QUEUE))
        except Exception:  # noqa: BLE001 - depth is advisory; never fail a request on it
            return 0


def build_job_store() -> JobStore:
    """The store this process should use, chosen by GLIMPSE_REDIS_URL."""
    url = os.environ.get("GLIMPSE_REDIS_URL", "").strip()
    return RedisJobStore(url) if url else MemoryJobStore()
