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

export const MODE = (runtimeEnv && runtimeEnv.MODE) || import.meta.env.VITE_GLIMPSE_MODE || "desktop";

export const IS_HOSTED = MODE === "hosted";

export const FEATURES = {
    mermaid: !IS_HOSTED,
    gridappsd: !IS_HOSTED,
    simulation: !IS_HOSTED,
    editing: !IS_HOSTED,
    objectLookup: !IS_HOSTED,
};
