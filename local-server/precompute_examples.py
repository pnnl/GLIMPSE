#!/usr/bin/env python3

import gzip
import json
import os
import sys
import time


def precompute(example_ids=None) -> int:
    # Imported here so --help works without the (heavy) cimgraph import chain.
    import server

    target_dir = server.PRECOMPUTED_DIR
    os.makedirs(target_dir, exist_ok=True)

    ids = example_ids or list(server.EXAMPLE_MODELS)
    failures = 0

    for example_id in ids:
        entry = server.EXAMPLE_MODELS.get(example_id)
        if entry is None:
            print(f"[precompute] unknown example: {example_id}", file=sys.stderr)
            failures += 1
            continue

        path = server._example_model_path(example_id)
        if path is None:
            # The model file isn't in this build; the example won't be offered.
            print(f"[precompute] skip {example_id}: model file not present")
            continue

        print(f"[precompute] {example_id}: parsing {os.path.basename(path)} ...", flush=True)
        started = time.time()
        try:
            body = server.build_example_payload(entry, path)
        except Exception as exc:  # noqa: BLE001 - report and continue to the next model
            print(f"[precompute] FAILED {example_id}: {exc}", file=sys.stderr)
            failures += 1
            continue

        destination = os.path.join(target_dir, f"{example_id}.json.gz")
        # mtime=0 so rebuilds of an unchanged model produce an identical file and
        # don't invalidate the Docker layer cache.
        raw = json.dumps(body).encode("utf-8")
        with gzip.GzipFile(destination, "wb", compresslevel=6, mtime=0) as handle:
            handle.write(raw)

        print(
            f"[precompute] {example_id}: {time.time() - started:.1f}s  "
            f"{len(raw) / 1024 / 1024:.2f} MB raw -> "
            f"{os.path.getsize(destination) / 1024 / 1024:.2f} MB gz  {destination}",
            flush=True,
        )

    return failures


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    if "-h" in sys.argv or "--help" in sys.argv:
        print(__doc__)
        raise SystemExit(0)
    raise SystemExit(1 if precompute(args or None) else 0)
