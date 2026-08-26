import axios from "axios";
import { API_BASE_URL } from "../config";

const FIRST_INTERVAL_MS = 500;
const MAX_INTERVAL_MS = 5000;
const BACKOFF = 1.5;

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

    for (;;) {
        if (signal?.aborted) throw new Error("Upload cancelled.");

        const { data: job } = await axios.get(`${API_BASE_URL}/api/jobs/${jobId}`, { signal });

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
