"""Celery app and the CIM parse task.

The parse runs here, in its own fleet of worker processes, rather than in the
web tier: a CIM parse is seconds to minutes of pure CPU and peaks near 600 MB of
RSS for the largest bundled model. Keeping it out of the web workers means a
slow parse cannot starve health checks or fast requests, and a rolling deploy of
the web tier cannot kill a parse in flight.

Celery owns dispatch and redelivery. Everything the client actually reads — the
job record it polls and the finished payload it collects — lives in jobstore, on
the same Redis, so any web replica can answer for any job.

Run the workers with:

    celery -A tasks worker --queues glimpse.parse --concurrency 1
"""

from __future__ import annotations

import os
import tempfile
import time
import traceback

from celery import Celery
from werkzeug.utils import secure_filename

import jobstore

# Imported at module scope, in the worker parent, on purpose. The prefork pool
# forks its children from this process, so importing the (heavy) parse stack
# here means every child inherits it copy-on-write. Deferring it into the task
# would make each child import cimgraph itself, which with
# worker_max_tasks_per_child=1 would be several seconds added to every job.
import cimhelper

# The worker never serves HTTP, but it must parse the way the hosted server
# does — no Socket.IO, no GridAPPS-D, helpers released after every parse.
os.environ.setdefault("GLIMPSE_MODE", "hosted")

BROKER_URL = os.environ.get("GLIMPSE_REDIS_URL", "").strip()

# Hard ceiling on a single parse. IEEE 9500 (56 MB, ~13,600 objects) parses in
# about 8 s in this image, so 15 minutes is ~110x headroom; the limit exists to
# stop one pathological upload from occupying a worker forever. The soft limit
# fires first and raises inside the task, which lets it record a real error on
# the job instead of the worker being killed and the client polling a job stuck
# at "parsing" until its TTL.
#
# Keep this as low as your largest realistic model allows. It sets the floor for
# the visibility timeout below, which in turn bounds how long a job waits after
# an ungraceful loss of the whole worker container.
PARSE_TIME_LIMIT = int(os.environ.get("GLIMPSE_PARSE_TIME_LIMIT", "900"))
PARSE_SOFT_TIME_LIMIT = int(os.environ.get("GLIMPSE_PARSE_SOFT_TIME_LIMIT", str(PARSE_TIME_LIMIT - 60)))

# Redis has no real ack: kombu re-queues a task whose worker has not finished
# within the visibility timeout. If that were shorter than the time limit, a
# long-but-healthy parse would be handed to a second worker while the first was
# still running it — two workers, 600 MB each, on the same job. Keeping it above
# the hard limit means redelivery only ever happens after the first attempt is
# genuinely over.
#
# It is also the recovery time for the one failure the pool cannot see: the
# whole container disappearing at once (instance loss, spot reclaim, `docker
# kill`). A lost *child* — what an OOM kill actually produces — is caught by the
# pool and redelivered in seconds; a lost parent leaves the message parked in
# the broker's unacked set until this expires. Deploys don't hit either path,
# because a warm shutdown finishes the task first.
VISIBILITY_TIMEOUT = int(os.environ.get("GLIMPSE_VISIBILITY_TIMEOUT", str(PARSE_TIME_LIMIT + 300)))

celery_app = Celery("glimpse", broker=BROKER_URL or None)

celery_app.conf.update(
    task_default_queue=jobstore.PARSE_QUEUE,
    task_routes={"tasks.parse_cim": {"queue": jobstore.PARSE_QUEUE}},
    # No result backend on purpose. A parsed 9500 is ~27 MB of JSON, and it is
    # already stored — gzipped, once — by jobstore. Letting Celery keep its own
    # copy of every return value would double the Redis footprint that this
    # deployment is sized around for nothing: the client polls /api/jobs/<id>,
    # never Celery.
    task_ignore_result=True,
    # The reliability pair. acks_late holds the ack until the task finishes, so a
    # worker that is OOM-killed or replaced mid-parse has its task redelivered
    # rather than dropped; reject_on_worker_lost is what makes that also apply to
    # a hard kill, which no exception handler can catch. jobstore.MAX_ATTEMPTS
    # bounds the resulting redelivery so a model that reliably kills its worker
    # cannot take down the whole fleet in sequence.
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    # A parse occupies its worker for the whole task, so prefetching a second one
    # would leave it queued behind a job of unknown length while another worker
    # sat idle. One at a time is what makes the queue depth mean anything.
    worker_prefetch_multiplier=1,
    task_time_limit=PARSE_TIME_LIMIT,
    task_soft_time_limit=PARSE_SOFT_TIME_LIMIT,
    broker_transport_options={"visibility_timeout": VISIBILITY_TIMEOUT},
    broker_connection_retry_on_startup=True,
    # Recycle the child process after every parse. cimgraph's object graph is
    # large and the allocator does not reliably return it to the OS, so RSS
    # ratchets upward across parses in a long-lived process — which on a 2 GB
    # worker ends as an OOM kill several jobs in. The replacement is forked from
    # the parent, which imported the parse stack above, so this costs a fork
    # rather than a cold start.
    worker_max_tasks_per_child=int(os.environ.get("GLIMPSE_WORKER_MAX_TASKS", "1")),
    worker_send_task_events=True,
    task_send_sent_event=True,
)


def run_parse(store: jobstore.JobStore, job: jobstore.Job, payload: bytes) -> None:
    """Parse one uploaded model into the store. Never raises.

    Split out from the task so it can be tested directly, without a broker.
    """
    from celery.exceptions import SoftTimeLimitExceeded

    # A fresh helper per job: nothing carries over from the previous parse, and
    # the whole object graph becomes collectable the moment this returns.
    helper = cimhelper.CIMHelper()
    tmpdir = tempfile.mkdtemp(prefix="glimpse_job_")
    try:
        filename = secure_filename(job.filename) or "model.xml"
        path = os.path.join(tmpdir, filename)
        with open(path, "wb") as handle:
            handle.write(payload)

        started = time.time()
        print(
            f"[parse] {job.id}: parsing {filename} "
            f"({len(payload) / 1024 / 1024:.1f} MB, attempt {job.attempts})",
            flush=True,
        )

        data, object_details = helper.cim_to_gjs(filepaths=[path])

        if helper.count_objects(data) == 0:
            # cimgraph logged and returned an empty graph instead of raising.
            # Reporting success here would load a blank canvas with no
            # explanation of what went wrong.
            store.fail(
                job.id,
                f"No CIM objects could be read from {filename}. "
                "Check that it is a valid CIM XML model.",
            )
            print(f"[parse] {job.id}: parsed to an empty graph; failing", flush=True)
            return

        store.set_stage(job.id, "serializing")
        store.complete(
            job.id,
            {"data": data, "themeData": None, "objectDetails": object_details, "isCIM": True},
        )
        print(f"[parse] {job.id}: done in {time.time() - started:.1f}s", flush=True)
    except SoftTimeLimitExceeded:
        store.fail(job.id, f"Parsing took longer than {PARSE_SOFT_TIME_LIMIT}s and was stopped.")
        print(f"[parse] {job.id}: exceeded the soft time limit", flush=True)
    except Exception as exc:  # noqa: BLE001 - a bad upload must not kill the worker
        traceback.print_exc()
        store.fail(job.id, str(exc))
    finally:
        import shutil

        shutil.rmtree(tmpdir, ignore_errors=True)


@celery_app.task(name="tasks.parse_cim")
def parse_cim(job_id: str) -> None:
    """Parse the upload behind `job_id`. Failures are reported on the job.

    The task takes only an id: the uploaded bytes stay in Redis under the job,
    so a 56 MB model is never carried around inside a broker message.

    Deliberately no automatic retry. A parse failure here is deterministic — a
    malformed or unsupported model fails identically every time — so retrying
    would burn minutes of CPU and hundreds of MB to reach the same answer more
    slowly. The failures worth re-running are the ones that kill the process
    outright, and acks_late already redelivers those.
    """
    store = jobstore.build_job_store()
    started = store.begin(job_id)
    if started is None:
        # Expired, already terminal, or out of attempts — begin() has recorded
        # whichever it was. Nothing to run.
        print(f"[parse] {job_id}: nothing to run", flush=True)
        return
    run_parse(store, *started)
