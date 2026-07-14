// Central API config for the GLIMPSE backend (Flask + SocketIO server).
//
// Resolution order (same for API_URL and API_TOKEN):
//   1. window.__GLIMPSE_ENV__.*  — runtime injection (see public/env.js).
//      Lets a single prebuilt image target any backend via env vars.
//   2. import.meta.env.VITE_*    — build-time override.
//   3. built-in default.
import axios from "axios";

const runtimeEnv =
    typeof window !== "undefined" ? window.__GLIMPSE_ENV__ : undefined;

const rawBaseUrl =
    (runtimeEnv && runtimeEnv.API_URL) ||
    import.meta.env.VITE_API_URL ||
    "http://127.0.0.1:5052";

// Strip any trailing slash so callers can safely do `${API_BASE_URL}/path`.
export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, "");

// Shared bearer token. Empty by default (loopback desktop use needs no auth).
// When the backend is deployed with GLIMPSE_API_TOKEN set, provide the matching
// value here so requests are authorized.
export const API_TOKEN =
    (runtimeEnv && runtimeEnv.API_TOKEN) || import.meta.env.VITE_API_TOKEN || "";

// Attach the token to every axios request app-wide when one is configured.
if (API_TOKEN) {
    axios.defaults.headers.common["Authorization"] = `Bearer ${API_TOKEN}`;
}
