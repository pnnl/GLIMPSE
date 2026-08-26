# Hosted deployment

GLIMPSE ships in two shapes from one codebase, selected by `GLIMPSE_MODE`:

| | `desktop` (default) | `hosted` |
|---|---|---|
| Users | One, on their own machine | Many, concurrently |
| Transport | Flask + Socket.IO on gevent, bound to loopback | Flask under gunicorn, behind a proxy |
| Features | Everything: GridAPPS-D, simulation, live agent feed, mermaid diagrams | Model upload, parse, inspect, export |
| Server state | Keeps the parsed model resident between requests | Keeps nothing |

The hosted mode exists because the desktop server is a *single session*: one set of
helper singletons, one loaded model, one GridAPPS-D connection, and Socket.IO
broadcasts that reach every connected client. That is correct for one user at a
desk and actively wrong for several strangers sharing an instance.

## What makes it multi-user

**Responses are self-contained.** Parsing a CIM model also resolves every
object's attributes and associations (`CIMHelper._build_object_details`), and
those ship with the model. The client never asks the server "tell me about object
X" — it already knows — so the server needn't still be holding that model, and no
request depends on reaching the replica that served the previous one.

This is the property everything else rests on. `local-server/tests/` guards it,
in particular `test_inspection_works_across_replicas` and
`test_any_replica_can_serve_any_job`. If someone reintroduces server-retained
state, those fail; a single-instance smoke test would not notice.

**Desktop-only endpoints are not registered.** `desktop_route` and
`desktop_socket_event` skip registration in hosted mode, so `/api/gridappsd/*`,
`/api/cim/objects`, `/api/cim/objects/mermaid` and the Socket.IO layer return 404
rather than failing at request time. The frontend hides the matching UI via
`FEATURES` in `src/config.js`. `requirements-hosted.txt` omits `flask-socketio`,
`gevent`, and `gridappsd-python` entirely — if a hosted code path ever imports
one, the image fails to start instead of quietly working.

**Measurements are never parsed.** Every consumer of CIM measurements is a
simulation feature, and every one of them is desktop-only: `/api/cim/measurements`
is a `desktop_route`, simulation output arrives over Socket.IO, and the frontend
reads measurement mRIDs only from the plot components. IEEE 9500 carries 24,003
`Analog`/`Discrete` elements — a quarter of every object in the file — so
`cimhelper.MeasurementFreeXMLFile` skips them at parse time in hosted mode.
Worth about 12% of the parse and 1.7 MB of the payload, and free: the object
graph and the inspectable details are identical either way, because measurements
were never rendered. `test_skipping_measurements_costs_the_visualization_nothing`
is the guard on that.

**cimgraph's edge construction is patched.** `local-server/cimgraph_patch.py`
replaces `ConnectionInterface.create_edge`, which dedupes list-valued
associations with a linear scan and is therefore O(n^2) in the size of the list
it is filling. Loading IEEE 9500 runs that scan 102,646,261 times — the single
largest block of self time in the parse. A set of object ids makes it O(1) and
takes about a third off the load, with byte-identical output (hashed and
asserted in `test_the_patch_changes_nothing_about_the_output`).

It is a monkeypatch on a third-party library, so it checks that the code it is
replacing still looks the way it did when it was written and declines to patch
if not — a cim-graph upgrade falls back to the library's own implementation
rather than silently running a stale copy of it. `GLIMPSE_CIMGRAPH_PATCH=0`
turns it off at runtime. This belongs upstream in cim-graph; until it is there,
the patch keeps it in one reviewable place.

**Editing is off.** Hosted GLIMPSE is model exploration only. `FEATURES.editing`
renders the attributes panel read-only, matching the backend, where
`/api/cim/objects` is not registered — without the flag the Save button appears
and every save fails on a 404.

## Large models

IEEE 9500 — the largest bundled model, 56 MB of CIM XML, ~13,600 graph objects —
parses in about 6.5 seconds and peaks around 600 MB of RSS. Two mechanisms exist,
for two different situations.

**Bundled examples are precomputed at build time.** A bundled example is a fixed
input, so its parse result is identical for every visitor. `precompute_examples.py`
runs during the image build and stores each result as a gzipped payload;
`/api/examples/load` returns those bytes directly — roughly 1 ms instead of 6.5 s,
and none of the 600 MB. That headroom is the point: it is the difference between
a demo instance serving one visitor at a time and serving many. Precomputed
artifacts are byte-identical to parsing on demand — `build_example_payload` is
shared by both paths so they cannot drift.

**User uploads can become jobs.** At 6.5 s a 9500-scale upload is comfortably a
synchronous request, and that remains the default: leave `GLIMPSE_REDIS_URL`
unset and there is no Redis, no Celery, and no worker tier to run.

Set `GLIMPSE_REDIS_URL` when uploads arrive concurrently — several users at once
each pinning 600 MB in a web worker is how the web tier falls over — or when
uploads are much larger than the bundled models, where a parse could outlive a
load balancer's idle timeout and a dropped connection would waste the whole
thing. `/api/upload/cim` then answers `202` with a job id, a Celery worker tier
parses, and the client polls.

With the job pipeline on, scale the tiers independently: web replicas stay small
(512 MB is ample, since they never parse), workers need ~2 GB each and set how
many parses run at once.

## The parse pipeline

### How a job flows

1. `/api/upload/cim` writes the job record and the uploaded bytes to Redis
   (`jobstore.py`), then publishes `tasks.parse_cim` with the job id as the task
   id. The bytes never go into the broker message — a task stays a few hundred
   bytes whatever the model weighs.
2. A Celery worker takes the task and calls `store.begin()`, which counts the
   attempt and flips the job to `running`, then parses.
3. The worker writes the gzipped result back to Redis and marks the job `done`.
4. The client polls `/api/jobs/<id>`, then collects `/api/jobs/<id>/result`. Any
   web replica can answer both, because nothing about a job lives in a process.

### When a worker dies

A parse peaks near 600 MB, so an OOM kill is the realistic failure, and a rolling
deploy SIGTERMs workers mid-parse by design. The task runs with `task_acks_late`
and `task_reject_on_worker_lost`, so a task whose worker never finished it is
redelivered rather than dropped silently.

That guarantee rests on two things this deployment has to provide itself:

- **The upload outlives the attempt.** `jobstore` holds the uploaded bytes until
  the job is *terminal*, not until it is first picked up — a redelivered task
  with nothing left to parse would be worthless. Guarded by
  `test_*_keeps_the_upload_for_a_redelivery`.
- **Redelivery is bounded.** A model that reliably kills whatever parses it would
  otherwise be handed to every worker in turn, taking down the fleet one process
  at a time. `begin()` counts attempts on the job record and fails the job past
  `GLIMPSE_JOB_MAX_ATTEMPTS`, so the client gets a real error instead of polling
  forever. Guarded by `test_*_bounds_attempts`.

Parse *failures* are deliberately not retried. A malformed or unsupported model
fails identically every time, so a retry would burn minutes of CPU and hundreds
of MB to reach the same answer more slowly. The failures worth re-running are the
ones that kill the process outright, and `acks_late` already covers those.

#### How fast recovery is, by failure

Redis has no real ack, so the two failures recover on different mechanisms.
Measured on the compose stack, killing a worker mid-parse of IEEE 9500:

| Failure | Mechanism | Observed |
|---|---|---|
| Parse child killed (what an OOM kill produces) | Pool raises `WorkerLostError`, task requeued at once | job completed on attempt 2, **~9 s** end to end |
| Rolling deploy / scale-in (SIGTERM) | Celery warm shutdown finishes the task first | no redelivery at all, within `stop_grace_period` |
| Whole container lost at once (instance loss, spot reclaim, `docker kill`) | Message sits in the broker's `unacked` set until the visibility timeout | up to `GLIMPSE_VISIBILITY_TIMEOUT` (20 min by default) |

The last row is the one to size deliberately. A cgroup OOM kills the child — the
process holding the 600 MB — so the common memory failure takes the fast path;
losing the parent as well means nothing is left to notice, and only the
visibility timeout can recover it. Lower `GLIMPSE_PARSE_TIME_LIMIT` to whatever
your largest realistic model needs and the visibility timeout follows it down.

`GLIMPSE_VISIBILITY_TIMEOUT` must stay above `GLIMPSE_PARSE_TIME_LIMIT`: kombu
re-queues a task whose worker has not finished within the visibility timeout, so
a shorter one would hand a long-but-healthy parse to a second worker while the
first was still running it — two workers, 600 MB each, on the same job.

Nothing is lost in any of these cases: the task stays in the broker and the
upload stays in Redis until the job is terminal. What differs is only how long
the user waits.

### Backpressure

Every queued job holds its upload in Redis until a worker finishes with it, so
queue depth is a memory budget, not just a patience one:

```
worst-case resident uploads ~= GLIMPSE_MAX_QUEUE_DEPTH x MAX_UPLOAD_MB
```

Past that depth `/api/upload/cim` answers `429` with `Retry-After` rather than
accepting work it has nowhere to put. Redis runs `--maxmemory-policy noeviction`
for the same reason: with queued uploads and finished results both living there,
it is the system of record for work in flight, not a cache. An eviction policy
would silently discard a live job — or the queue list itself, dropping every
pending job at once — and users would see "unknown or expired job" with nothing
logged anywhere. Refusing the write instead lets the upload endpoint answer `503`
while jobs already accepted still finish.

`GET /` reports `queue.depth` and `queue.maxDepth`. A depth sitting near the
maximum means the worker tier is undersized; it is the right signal to scale on.

## Running it locally

```bash
# Three replicas, deliberately with NO sticky sessions.
# TLS is self-provisioning; see "Prerequisites" below to supply your own cert.
docker compose -f docker-compose.prod.yml up --build -d --scale backend=3

./scripts/verify-hosted-stack.sh
```

Scale the tiers separately — `--scale worker=4` for parse throughput, `--scale
backend=3` for request capacity. Workers are plain Celery, so the usual
introspection works:

```bash
docker compose -f docker-compose.prod.yml exec worker celery -A tasks inspect active
docker compose -f docker-compose.prod.yml exec worker celery -A tasks inspect stats
```

`PRECOMPUTE_EXAMPLES=none` skips the precompute step while iterating. The
verification script checks mode and feature gating, that
desktop-only endpoints 404, that JSON is gzipped, that examples load prebuilt
rather than parsing, and that a job uploaded to one replica can be polled and
collected from another.

Run the backend suite with Redis available to include the job tests:

```bash
cd local-server
GLIMPSE_TEST_REDIS_URL=redis://127.0.0.1:6379/1 python -m pytest tests
```

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `GLIMPSE_MODE` | `desktop` | `hosted` enables everything on this page |
| `GLIMPSE_REDIS_URL` | unset | Set it to move uploads onto the job pipeline (broker *and* job store) |
| `GLIMPSE_JOB_TTL` | `3600` | Seconds a job and its result stay collectable |
| `GLIMPSE_MAX_QUEUE_DEPTH` | `24` | Queued jobs before uploads are refused with `429`. Multiply by `MAX_UPLOAD_MB` to size Redis |
| `GLIMPSE_JOB_MAX_ATTEMPTS` | `2` | Times a job may be handed to a worker before it is failed. Bounds poison-pill redelivery |
| `GLIMPSE_PARSE_TIME_LIMIT` | `900` | Hard ceiling on one parse, seconds (~110x IEEE 9500) |
| `GLIMPSE_VISIBILITY_TIMEOUT` | time limit + 300 | Must exceed the time limit, and bounds recovery from whole-container loss — see "When a worker dies" |
| `GLIMPSE_WORKER_MAX_TASKS` | `1` | Parses before a worker child is recycled. Keeps RSS from ratcheting across jobs |
| `GLIMPSE_CIMGRAPH_PATCH` | `1` | `0` runs cimgraph's own `create_edge` instead of the patched one |
| `GLIMPSE_PARSE_QUEUE` | `glimpse.parse` | Celery queue name. The web tier reads its depth by this key, so change both or neither |
| `WORKER_CONCURRENCY` | `1` | Parses at once per worker container. Raise only with the RAM to match |
| `REDIS_MAXMEMORY` | `6gb` | Sized from the queue-depth formula above |
| `GLIMPSE_PRECOMPUTED_DIR` | `<models>/precomputed` | Where prebuilt example payloads live |
| `CORS_ORIGINS` | dev ports | Pin to the real origin; never `*` in production |
| `MAX_UPLOAD_MB` | `65` | Raise it — IEEE 9500 alone is 56 MB. nginx's `client_max_body_size` must match or exceed it |
| `GLIMPSE_API_TOKEN` | unset | Shared bearer token. Note it is served to the browser in `env.js`, so it gates non-browser clients only — put real auth (ALB + OIDC) in front for anything sensitive |

## A local-only wrinkle: nginx and DNS

nginx resolves a hostname in an `upstream` block once, at config load, and caches
it for the process lifetime. In Docker, where replicas get new addresses when
they are recreated, that means a replica started later receives no traffic while
nginx keeps dialling one that has gone. Both were observed here — with three
replicas up, one served zero requests.

`docker/nginx.prod.conf` therefore routes through a variable with an explicit
`resolver`, which forces re-resolution per request. `verify-hosted-stack.sh`
asserts that *every* replica serves traffic, because a proxy pinned to one
address passes every other check in the script while making the cross-replica
results meaningless.

An ALB tracks its own targets, so none of this applies on EC2.

## Moving to EC2

The compose stack maps over directly: nginx → ALB, the `backend` service → a
target group, `worker` → its own service scaled separately, `redis` →
ElastiCache.

- **ElastiCache must be `noeviction`.** The default parameter group for a cache
  is `volatile-lru`, which is wrong here for the reason given under
  "Backpressure": these keys are work in flight, not cache. Set
  `maxmemory-policy` in a custom parameter group, and size the node from
  `GLIMPSE_MAX_QUEUE_DEPTH x MAX_UPLOAD_MB` plus headroom.
- **Scale the worker tier on queue depth**, not CPU. `GET /` reports
  `queue.depth`; publish it as a CloudWatch metric and target it. CPU is a poor
  proxy — an idle-but-backlogged fleet looks identical to an idle one when the
  jobs are queued rather than running.
- **ALB idle timeout** defaults to 60s, which the job pipeline makes largely moot:
  the upload returns `202` immediately and polls are short. It still bounds the
  *upload* itself, so raise it if clients push very large files over slow links.
- **ACM certificates** and IAM/instance-profile behaviour.
- **Log delivery** — the containers log to stdout; wire up the `awslogs` driver
  or the CloudWatch agent. Celery logs each task start and finish, so worker
  throughput and failures are visible without extra instrumentation.

## Prerequisites for local verification

`scripts/verify-hosted-stack.sh` needs only `curl` and `python3`.

TLS needs nothing: the frontend container generates a self-signed certificate on
startup when none is mounted, so `docker compose up` works from a clean checkout.
Browsers will warn on it. To use a trusted local certificate instead, drop one at
`docker/certs/glimpse.{crt,key}` and it takes precedence:

```bash
mkcert -cert-file docker/certs/glimpse.crt -key-file docker/certs/glimpse.key localhost 127.0.0.1
```

If `docker/certs/` was created by Docker it will be root-owned; `sudo chown -R
"$USER" docker/certs` before writing into it.
