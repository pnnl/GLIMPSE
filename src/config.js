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
    // Hosted GLIMPSE is model exploration only. Editing an object PUTs to
    // /api/cim/objects, which is a desktop_route and therefore not registered
    // there — without this flag the inputs and Save button render, and every
    // save fails with a 404 the user has no way to interpret.
    editing: !IS_HOSTED,
    // Whether the backend still holds the parsed model and can therefore be
    // asked about an object the payload didn't ship. A model ships details only
    // for the objects it draws, so every association pointing at something
    // undrawn — BaseVoltage, Location, Terminal, PerLengthImpedance — is
    // resolvable only this way. Hosted mode keeps no model, so there the
    // payload is all there is.
    objectLookup: !IS_HOSTED,
};
