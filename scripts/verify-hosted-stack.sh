#!/usr/bin/env bash
# Verify a running GLIMPSE hosted stack behaves the way EC2 will.
#
#   docker compose -f docker-compose.prod.yml up --build -d --scale backend=3
#   ./scripts/verify-hosted-stack.sh
#
# The interesting checks are the ones a single-replica smoke test cannot make:
# that no request depends on reaching the replica that handled the previous one.
set -uo pipefail

command -v python3 >/dev/null || { echo "This script needs python3."; exit 2; }

# Small stand-in for jq so the script has no dependency beyond python3.
#   jsonq <expr>   reads JSON on stdin, prints the expression, "" on any error.
# `d` is the parsed document.
jsonq() {
    python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
    v = eval(sys.argv[1], {"d": d})
    if isinstance(v, bool): print(str(v).lower())
    elif isinstance(v, (list, tuple)): print(" ".join(str(x) for x in v))
    elif v is None: print("")
    else: print(v)
except Exception:
    print("")
' "$1"
}

BASE="${GLIMPSE_BASE_URL:-https://localhost:8443}"
CURL=(curl -sS --insecure)          # --insecure: local certs are self-signed
PASS=0; FAIL=0

ok()   { printf '  \033[32mPASS\033[0m %s\n' "$1"; PASS=$((PASS+1)); }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$1"; FAIL=$((FAIL+1)); }
note() { printf '\n\033[1m%s\033[0m\n' "$1"; }

note "1. Reachability and mode"
health=$("${CURL[@]}" "$BASE/healthz" || echo '{}')
[[ $(jsonq 'd["mode"]' <<<"$health") == hosted ]] \
    && ok "backend reports hosted mode" || bad "expected hosted mode, got: $health"
[[ $(jsonq 'd["features"]["mermaid"]' <<<"$health") == false ]] \
    && ok "mermaid is off (desktop-only feature)" || bad "mermaid should be disabled"
[[ $(jsonq 'd["features"]["asyncUploads"]' <<<"$health") == true ]] \
    && ok "async uploads enabled (job store configured)" || bad "async uploads should be on"

note "2. Desktop-only endpoints are absent"
for path in /api/cim/objects/mermaid /api/gridappsd/status /api/cim/measurements; do
    code=$("${CURL[@]}" -o /dev/null -w '%{http_code}' "$BASE$path")
    [[ $code == 404 ]] && ok "$path -> 404" || bad "$path -> $code (expected 404)"
done

note "3. Example listing"
listed=$("${CURL[@]}" "$BASE/api/examples" | jsonq '[e["id"] for e in d["examples"]]')
[[ -n $listed ]] && ok "examples offered: $listed" || bad "no examples offered"
first_example=${listed%% *}

note "4. Compression"
# Deliberately measured on a model payload, not on /api/examples: that response
# is a few hundred bytes, below nginx's gzip_min_length, so it proves nothing.
if [[ -n $first_example ]]; then
    enc=$("${CURL[@]}" -H 'Accept-Encoding: gzip' -X POST "$BASE/api/examples/load" \
          -H 'Content-Type: application/json' -d "{\"id\":\"$first_example\"}" \
          -o /dev/null -D - | tr -d '\r' | awk -F': ' '/[Cc]ontent-[Ee]ncoding/{print $2}')
    [[ $enc == gzip ]] && ok "model payloads are gzipped" || bad "expected gzip, got '${enc:-none}'"
else
    bad "no example available to test compression against"
fi

note "5. Examples load without parsing on demand"
# Generous enough to absorb TLS, transfer of a ~4 MB body and a loaded machine,
# while staying well under the ~6.5s an on-demand IEEE 9500 parse costs.
PREBUILT_MAX_MS=${PREBUILT_MAX_MS:-3000}
for id in ieee123 ieee9500; do
    if ! grep -qw "$id" <<<"$listed"; then
        bad "$id not offered"; continue
    fi
    start=$(date +%s%N)
    size=$("${CURL[@]}" -H 'Accept-Encoding: gzip' -X POST "$BASE/api/examples/load" \
           -H 'Content-Type: application/json' -d "{\"id\":\"$id\"}" -o /dev/null -w '%{size_download}')
    ms=$(( ($(date +%s%N) - start) / 1000000 ))
    # A prebuilt payload is a file read plus transfer; parsing IEEE 9500 costs
    # ~6.5s and ~600 MB on top of that. The gap is what distinguishes them, so
    # the threshold has to sit between the two rather than merely be "not slow".
    if (( ms < PREBUILT_MAX_MS )); then
        ok "$id loaded in ${ms}ms (${size} bytes) — served prebuilt"
    elif (( ms < 60000 )); then
        bad "$id took ${ms}ms — parsed on demand; this build has no precomputed artifact for it"
    else
        bad "$id took ${ms}ms — far slower than a parse should be"
    fi
done

note "6. Upload is handed to a worker, not answered inline"
model="${GLIMPSE_TEST_MODEL:-models/CIM/IEEE123.xml}"
if [[ ! -f $model ]]; then
    bad "no model at $model (set GLIMPSE_TEST_MODEL)"
else
    resp=$("${CURL[@]}" -X POST "$BASE/api/upload/cim" -F "files=@$model")
    job=$(jsonq 'd.get("jobId","")' <<<"$resp")
    [[ -n $job ]] && ok "upload accepted as job $job" || bad "expected a jobId, got: $resp"

    if [[ -n $job ]]; then
        note "7. Any replica can serve the job (round-robin, no stickiness)"
        # Each curl is a new connection, so nginx round-robins across replicas.
        # A poll landing on a replica that never saw the upload must still work.
        state=queued
        waited=0
        for _ in $(seq 1 240); do
            state=$(jsonq 'd["state"]' <<<"$("${CURL[@]}" "$BASE/api/jobs/$job")")
            [[ $state == done || $state == failed ]] && break
            # Still queued long after submission means nothing is consuming the
            # queue. Say so and stop, rather than polling out the full timeout:
            # a stack brought up without the worker service otherwise looks like
            # a slow parse for eight minutes.
            if [[ $state == queued ]] && (( waited >= 30 )); then
                bad "job still queued after ${waited}s — is the 'worker' service running?"
                break
            fi
            sleep 2
            waited=$((waited + 2))
        done
        if [[ $state == done ]]; then
            ok "job finished (polled across replicas)"
        elif [[ $state != queued ]]; then
            bad "job ended in state '$state'"
        fi

        if [[ $state == done ]]; then
            body=$("${CURL[@]}" --compressed "$BASE/api/jobs/$job/result")
            details=$(jsonq 'sum(len(v) for v in d["objectDetails"].values())' <<<"$body")
            objects=$(jsonq 'sum(len(v["objects"]) for v in d["data"].values())' <<<"$body")
            [[ ${details:-0} -gt 0 ]] \
                && ok "result carries $details object details for $objects objects" \
                || bad "result has no objectDetails — inspection would need the server"
        fi
    fi
fi

note "8. Traffic really is spread over every replica"
# Counting replicas is not enough. nginx will happily pin every request to one
# address and pass every other check in this script, which would make the
# cross-replica results above meaningless. Measure the distribution instead.
containers=$(docker compose -f docker-compose.prod.yml ps -q backend 2>/dev/null)
replicas=$(wc -l <<<"$containers")
if (( replicas < 2 )); then
    bad "only $replicas replica — rerun with --scale backend=3 for a real test"
else
    ok "$replicas backend replicas running"
    before=$(for c in $containers; do docker logs "$c" 2>&1 | grep -c 'GET /api/examples' || true; done)
    for _ in $(seq 1 15); do "${CURL[@]}" -o /dev/null "$BASE/api/examples"; done
    served=0
    idx=0
    for c in $containers; do
        idx=$((idx+1))
        now=$(docker logs "$c" 2>&1 | grep -c 'GET /api/examples' || true)
        was=$(sed -n "${idx}p" <<<"$before")
        (( now > was )) && served=$((served+1))
    done
    (( served == replicas )) \
        && ok "all $replicas replicas served traffic (no stickiness)" \
        || bad "only $served of $replicas replicas served traffic — nginx is pinning to a subset"
fi

printf '\n\033[1m%d passed, %d failed\033[0m\n' "$PASS" "$FAIL"
exit $(( FAIL > 0 ))
