import axios from "axios";
import { API_BASE_URL, PARSE_TIMEOUT_MS } from "../config";

const FIRST_INTERVAL_MS = 500;
const MAX_INTERVAL_MS = 5000;
const BACKOFF = 1.5;
// A job whose worker tier is gone sits at "queued" indefinitely, and the poll
// itself stays healthy, so the loop needs its own ceiling to ever give up.
const MAX_WAIT_MS = PARSE_TIMEOUT_MS;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** True when an upload response is a job handoff rather than a parsed model. */
export const isJobHandoff = (response) => Boolean(response && response.jobId);

const describe = (job) => {
    const seconds = Math.round(job.elapsed ?? 0);
    const elapsed =
        seconds < 60
            ? `${seconds}s`
            : `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
    if (job.state === "queued") {
        // queueDepth is how much work is waiting overall, not this job's place
        // in line, so it's phrased as a workload rather than a position.
        const depth = job.queueDepth ?? 0;
        if (depth > 1) return `Queued — ${depth} models waiting… ${elapsed}`;
        return `Queued… ${elapsed}`;
    }
    return `Parsing model… ${elapsed}`;
};

export const awaitParseJob = async (jobId, { onProgress, signal } = {}) => {
    let interval = FIRST_INTERVAL_MS;
    const deadline = Date.now() + MAX_WAIT_MS;

    for (;;) {
        if (signal?.aborted) throw new Error("Upload cancelled.");
        if (Date.now() > deadline) {
            throw new Error(
                "This model is still queued after a long wait. The server may have no parse " +
                    "workers running — try again later.",
            );
        }

        const { data: job } = await axios.get(`${API_BASE_URL}/api/jobs/${jobId}`, { signal });

        if (!job || typeof job !== "object") {
            throw new Error("The server returned an unreadable job status.");
        }
        if (job.state === "failed") {
            throw new Error(job.error || "The server could not parse this model.");
        }
        if (job.state === "done") {
            onProgress?.("Loading model…");
            const { data } = await axios.get(`${API_BASE_URL}/api/jobs/${jobId}/result`, { signal });
            return data;
        }

        onProgress?.(describe(job));
        await sleep(interval);
        interval = Math.min(interval * BACKOFF, MAX_INTERVAL_MS);
    }
};
