"""Parse jobs: the path large CIM uploads take in the hosted deployment.

Celery owns dispatch — which worker runs a task, and redelivery when one dies —
so that is not retested here; what is tested is everything the deployment layers
on top of it. In particular the two properties that only matter under load:

  * a worker lost mid-parse must be able to run the job again (the upload has to
    still be there), and
  * that redelivery must be bounded, or a model that kills whatever parses it
    takes down every worker in turn.

Store semantics are exercised against the memory backend (no infrastructure
needed). The parts that only mean anything across processes — a worker on one
machine finishing a job a web replica on another must be able to serve — run
against a real Redis, and skip when none is configured.
"""

import gzip
import importlib
import json
import os
import sys

import pytest

import jobstore
from conftest import cim_model, load_server

REDIS_URL = os.environ.get("GLIMPSE_TEST_REDIS_URL", "").strip()


@pytest.fixture
def memory_store():
    return jobstore.MemoryJobStore()


@pytest.fixture
def redis_store():
    if not REDIS_URL:
        pytest.skip("set GLIMPSE_TEST_REDIS_URL to run the Redis-backed job tests")
    try:
        store = jobstore.RedisJobStore(REDIS_URL)
        store._redis.ping()
    except Exception as exc:  # noqa: BLE001
        pytest.skip(f"Redis unreachable at {REDIS_URL}: {exc}")
    store._redis.flushdb()
    return store


# --------------------------------------------------------------------------
# Store semantics — both backends must behave identically
# --------------------------------------------------------------------------
def _exercise_lifecycle(store):
    job = store.submit("IEEE123.xml", b"<xml/>")
    assert store.get(job.id).state == jobstore.QUEUED

    started = store.begin(job.id)
    assert started is not None, "a queued job must be runnable"
    begun_job, payload = started
    assert begun_job.id == job.id
    assert payload == b"<xml/>"
    assert store.get(job.id).state == jobstore.RUNNING
    assert store.get(job.id).attempts == 1

    store.complete(job.id, {"data": {"f": {"objects": []}}, "objectDetails": {}})
    done = store.get(job.id)
    assert done.state == jobstore.DONE
    assert done.finished_at is not None

    body = json.loads(gzip.decompress(store.result(job.id)))
    assert body["data"] == {"f": {"objects": []}}


def test_memory_store_lifecycle(memory_store):
    _exercise_lifecycle(memory_store)


def test_redis_store_lifecycle(redis_store):
    _exercise_lifecycle(redis_store)


def test_failure_is_recorded_and_reported(memory_store):
    job = memory_store.submit("broken.xml", b"nope")
    memory_store.begin(job.id)
    memory_store.fail(job.id, "unreadable")

    failed = memory_store.get(job.id)
    assert failed.state == jobstore.FAILED
    assert failed.error == "unreadable"
    assert failed.finished_at is not None


def test_beginning_an_unknown_job_returns_none(memory_store):
    assert memory_store.begin("nosuchjob") is None


def _exercise_redelivery(store):
    """A worker lost mid-parse must be able to run the job again.

    acks_late redelivers the task, which is worthless if the upload was dropped
    when the first attempt picked it up — the retry would have nothing to parse.
    """
    job = store.submit("IEEE123.xml", b"<xml/>")

    first = store.begin(job.id)
    assert first is not None
    # The worker dies here: no complete(), no fail(), nothing reported.

    second = store.begin(job.id)
    assert second is not None, "a redelivered job must still have its upload"
    assert second[1] == b"<xml/>"
    assert store.get(job.id).attempts == 2


def test_memory_store_keeps_the_upload_for_a_redelivery(memory_store):
    _exercise_redelivery(memory_store)


def test_redis_store_keeps_the_upload_for_a_redelivery(redis_store):
    _exercise_redelivery(redis_store)


def _exercise_attempt_bound(store):
    """Redelivery is bounded, and running out is reported to the client.

    Without this, a model that OOM-kills its worker is redelivered forever and
    takes down the whole fleet one worker at a time.
    """
    job = store.submit("poison.xml", b"<xml/>")

    for expected in range(1, jobstore.MAX_ATTEMPTS + 1):
        assert store.begin(job.id) is not None
        assert store.get(job.id).attempts == expected

    assert store.begin(job.id) is None, "must not hand out a job past MAX_ATTEMPTS"

    exhausted = store.get(job.id)
    assert exhausted.state == jobstore.FAILED
    assert "attempts" in exhausted.error


def test_memory_store_bounds_attempts(memory_store):
    _exercise_attempt_bound(memory_store)


def test_redis_store_bounds_attempts(redis_store):
    _exercise_attempt_bound(redis_store)


def _exercise_upload_release(store):
    """A terminal job releases its upload — that memory is the scaling limit."""
    job = store.submit("IEEE123.xml", b"<xml/>")
    store.begin(job.id)
    store.complete(job.id, {"data": {}, "objectDetails": {}})

    assert store.begin(job.id) is None, "a finished job has no upload to re-run"


def test_memory_store_releases_a_finished_upload(memory_store):
    _exercise_upload_release(memory_store)


def test_redis_store_releases_a_finished_upload(redis_store):
    _exercise_upload_release(redis_store)
    # Not just unreachable through the API — actually gone from Redis.
    assert redis_store._redis.keys("glimpse:upload:*") == []


# --------------------------------------------------------------------------
# The parse itself
# --------------------------------------------------------------------------
def test_parse_writes_a_real_model_into_the_store(memory_store):
    import tasks

    job = memory_store.submit("IEEE123.xml", cim_model().read_bytes())
    begun_job, payload = memory_store.begin(job.id)

    tasks.run_parse(memory_store, begun_job, payload)

    assert memory_store.get(job.id).state == jobstore.DONE
    body = json.loads(gzip.decompress(memory_store.result(job.id)))
    feeder = next(iter(body["data"]))
    assert body["isCIM"] is True
    assert len(body["data"][feeder]["objects"]) > 0
    # The whole point: the result carries its own object details.
    assert len(body["objectDetails"][feeder]) > 0


def test_parse_records_a_failure_without_dying(memory_store):
    import tasks

    job = memory_store.submit("broken.xml", b"this is not CIM XML")
    begun_job, payload = memory_store.begin(job.id)

    tasks.run_parse(memory_store, begun_job, payload)  # must not raise

    failed = memory_store.get(job.id)
    assert failed.state == jobstore.FAILED
    assert failed.error


def test_the_task_finds_its_own_job(redis_store, monkeypatch):
    """parse_cim takes only an id and resolves everything else from Redis.

    That is what lets a 56 MB upload stay out of the broker message, and what
    lets any worker run any job.
    """
    monkeypatch.setenv("GLIMPSE_REDIS_URL", REDIS_URL)
    sys.modules.pop("tasks", None)
    import tasks

    job = redis_store.submit("IEEE123.xml", cim_model().read_bytes())
    tasks.parse_cim(job.id)  # runs the task body inline, no broker involved

    assert redis_store.get(job.id).state == jobstore.DONE
    assert redis_store.result(job.id)


def test_the_task_is_a_no_op_for_an_expired_job(redis_store, monkeypatch):
    monkeypatch.setenv("GLIMPSE_REDIS_URL", REDIS_URL)
    sys.modules.pop("tasks", None)
    import tasks

    tasks.parse_cim("nosuchjob")  # must not raise


# --------------------------------------------------------------------------
# HTTP surface (needs a shared store, so Redis)
# --------------------------------------------------------------------------
@pytest.fixture
def async_server(redis_store):
    previous = os.environ.get("GLIMPSE_REDIS_URL")
    os.environ["GLIMPSE_REDIS_URL"] = REDIS_URL
    # tasks reads the broker URL at import, and server binds the task object at
    # import; both have to be rebuilt for this environment.
    for name in ("jobstore", "tasks"):
        sys.modules.pop(name, None)
    try:
        module = load_server("hosted")
        assert module.ASYNC_UPLOADS is True
        yield module
    finally:
        if previous is None:
            os.environ.pop("GLIMPSE_REDIS_URL", None)
        else:
            os.environ["GLIMPSE_REDIS_URL"] = previous
        for name in ("server", "cimhelper", "tasks"):
            sys.modules.pop(name, None)


def _upload(client, name="IEEE123.xml"):
    with open(cim_model(), "rb") as handle:
        return client.post(
            "/api/upload/cim",
            data={"files": (handle, name)},
            content_type="multipart/form-data",
        )


def test_upload_returns_a_job_instead_of_blocking(async_server):
    response = _upload(async_server.app.test_client())

    assert response.status_code == 202
    body = response.get_json()
    assert body["state"] == jobstore.QUEUED
    assert body["statusUrl"].endswith(body["jobId"])


def test_upload_publishes_a_task_for_the_worker_tier(async_server, redis_store):
    """The 202 is only honest if something was actually queued."""
    job_id = _upload(async_server.app.test_client()).get_json()["jobId"]

    assert redis_store._redis.llen(jobstore.PARSE_QUEUE) == 1
    queued = json.loads(redis_store._redis.lindex(jobstore.PARSE_QUEUE, 0))
    assert queued["headers"]["id"] == job_id, "the task id is the job id"
    assert queued["headers"]["task"] == "tasks.parse_cim"
    # The upload itself must not be in the broker message.
    assert len(redis_store._redis.lindex(jobstore.PARSE_QUEUE, 0)) < 4096


def test_a_full_queue_sheds_load_instead_of_accepting_work(async_server, monkeypatch):
    """Past the depth budget the answer is 429, not a job that will never run."""
    monkeypatch.setattr(async_server, "MAX_QUEUE_DEPTH", 0)

    response = _upload(async_server.app.test_client())

    assert response.status_code == 429
    assert response.headers["Retry-After"]
    assert "queue" in response.get_json()["error"].lower()


def test_any_replica_can_serve_any_job(async_server):
    """The cross-replica guarantee for jobs.

    Upload lands on replica A; the poll and the result fetch are served by
    replica B, which never saw the upload and never ran the parse.
    """
    replica_a = async_server.app.test_client()
    job_id = _upload(replica_a).get_json()["jobId"]

    replica_b = importlib.import_module("server").app.test_client()
    assert replica_b.get(f"/api/jobs/{job_id}").get_json()["id"] == job_id

    # Unfinished is 409 (exists, not ready), not 404 (never existed).
    assert replica_b.get(f"/api/jobs/{job_id}/result").status_code == 409

    # Run it out of band, as a worker would, then collect from replica B.
    import tasks

    tasks.parse_cim(job_id)

    result = replica_b.get(
        f"/api/jobs/{job_id}/result", headers={"Accept-Encoding": "gzip"}
    )
    assert result.status_code == 200
    assert result.headers["Content-Encoding"] == "gzip"
    assert result.headers["Vary"] == "Accept-Encoding"
    body = json.loads(gzip.decompress(result.data))
    assert body["objectDetails"]

    # A client that doesn't advertise gzip must get readable JSON, not
    # undeclared compressed bytes.
    plain = replica_b.get(f"/api/jobs/{job_id}/result", headers={"Accept-Encoding": "identity"})
    assert plain.status_code == 200
    assert "Content-Encoding" not in plain.headers
    assert json.loads(plain.data) == body


def test_unknown_job_is_404(async_server):
    client = async_server.app.test_client()
    assert client.get("/api/jobs/nosuchjob").status_code == 404
    assert client.get("/api/jobs/nosuchjob/result").status_code == 404


def test_health_advertises_async_uploads_and_queue_pressure(async_server):
    body = async_server.app.test_client().get("/").get_json()
    assert body["features"]["asyncUploads"] is True
    # Autoscaling and on-call both read this.
    assert body["queue"]["maxDepth"] == async_server.MAX_QUEUE_DEPTH
    assert body["queue"]["depth"] >= 0
