// Central API base URL for the GLIMPSE backend (Flask + SocketIO server).
//
// Resolution order:
//   1. window.__GLIMPSE_ENV__.API_URL  — runtime injection (see public/env.js).
//      Lets a single prebuilt image target any backend via the API_URL env var.
//   2. import.meta.env.VITE_API_URL    — build-time override.
//   3. http://127.0.0.1:5052           — local dev default.
const runtimeEnv =
    typeof window !== "undefined" ? window.__GLIMPSE_ENV__ : undefined;

const rawBaseUrl =
    (runtimeEnv && runtimeEnv.API_URL) ||
    import.meta.env.VITE_API_URL ||
    "http://127.0.0.1:5052";

// Strip any trailing slash so callers can safely do `${API_BASE_URL}/path`.
export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, "");
