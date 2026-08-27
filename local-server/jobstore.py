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
MAX_ATTEMPTS = int(os.environ.get("GLIMPSE_JOB_MAX_ATTEMPTS", "2"))
PARSE_QUEUE = os.environ.get("GLIMPSE_PARSE_QUEUE", "glimpse.parse")


@dataclass
class Job:
    id: str
    state: str = QUEUED
    stage: str = "queued"
    filename: str = ""
    error: str | None = None
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
    def __init__(self, url: str, ttl: int = RESULT_TTL_SECONDS) -> None:
        self._url = url
        self._ttl = ttl
        self._client = None
        self._client_pid: int | None = None

    @property
    def _redis(self):
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

        job.attempts += 1
        job.state = RUNNING
        job.stage = "parsing"
        job.started_at = time.time()
        self._write(job)
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
