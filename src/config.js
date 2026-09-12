import axios from "axios";

const runtimeEnv = typeof window !== "undefined" ? window.__GLIMPSE_ENV__ : undefined;

const rawBaseUrl =
    runtimeEnv && typeof runtimeEnv.API_URL === "string"
        ? runtimeEnv.API_URL
        : import.meta.env.VITE_API_URL || "http://127.0.0.1:5052";

// Strip any trailing slash so callers can safely do `${API_BASE_URL}/path`.
export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, "");

export const API_TOKEN = (runtimeEnv && runtimeEnv.API_TOKEN) || import.meta.env.VITE_API_TOKEN || "";

// Attach the token to every axios request app-wide when one is configured.
if (API_TOKEN) {
    axios.defaults.headers.common["Authorization"] = `Bearer ${API_TOKEN}`;
}

/**
 * Ceiling on any request that doesn't set its own. Without a default axios waits
 * forever, so a backend that accepts a connection and then stalls leaves the UI
 * spinning with nothing to recover from.
 */
export const REQUEST_TIMEOUT_MS = 30_000;

/**
 * For requests that parse a model server-side. IEEE 9500 takes ~6.5s and larger
 * models legitimately take longer, so these get their own, much longer ceiling —
 * a bound that exists to end a hang, not to pace a slow parse.
 */
export const PARSE_TIMEOUT_MS = 10 * 60_000;

axios.defaults.timeout = REQUEST_TIMEOUT_MS;
