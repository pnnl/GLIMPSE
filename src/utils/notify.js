// ============================================================================
// notify.js — the single place user-facing feedback goes.
// ============================================================================
// Failures used to land in console.error only, which meant a bad upload or a
// failed GridAPPS-D load looked identical to nothing happening. Everything that
// a user needs to know about now goes through here.
//
// antd's *static* `message.error()` / `Modal.confirm()` can't read the
// ConfigProvider context, so in dark mode they render with light-theme colors.
// `<AntApp>` (see app/App.jsx) hands out context-aware instances instead;
// NotificationBridge registers them here at startup. The static API stays as a
// fallback for the brief window before that happens, and for calls made from
// non-React code (graph-helper, socket-client-helper).

import { message as staticMessage, Modal as staticModal } from "antd";
import graphHelper from "../graph-helper/GraphHelper";

let api = null;

/** Called once by NotificationBridge with the result of AntApp.useApp(). */
export const registerNotifier = (instance) => {
    api = instance;
};

const messageApi = () => api?.message ?? staticMessage;
const modalApi = () => api?.modal ?? staticModal;

/**
 * Pull the most specific message out of a caught value. Backend errors arrive
 * as an axios error wrapping a `{ error: ... }` body; parser/validation
 * failures are plain Errors; a few paths throw strings.
 */
export const errorText = (err, fallback = "Something went wrong.") => {
    if (!err) return fallback;
    if (typeof err === "string") return err;

    const data = err.response?.data;
    if (typeof data === "string" && data.trim()) return data;

    return data?.error ?? data?.message ?? err.message ?? fallback;
};

export const notify = {
    // Errors linger longer than confirmations — they usually need reading.
    error: (content, duration = 6) => messageApi().error({ content, duration }),
    success: (content, duration = 3) => messageApi().success({ content, duration }),
    info: (content, duration = 4) => messageApi().info({ content, duration }),
    warning: (content, duration = 5) => messageApi().warning({ content, duration }),
    confirm: (config) => modalApi().confirm(config),
};

/**
 * Report a caught error to the user and keep the full object in the console for
 * debugging. `context` is a short human phrase describing what was being tried,
 * e.g. reportError("Failed to load model", err).
 */
export const reportError = (context, err, fallback) => {
    console.error(`${context}:`, err);
    const detail = errorText(err, fallback ?? "");
    notify.error(detail ? `${context}: ${detail}` : context);
};

/**
 * Gate an action that would throw away unsaved model edits. Resolves true when
 * it's safe to continue — immediately if there is nothing to lose.
 *
 * @param {string} action - what's about to happen, e.g. "Loading a new model"
 * @returns {Promise<boolean>}
 */
export const confirmDiscardChanges = (action) => {
    if (!graphHelper.hasUnsavedChanges()) return Promise.resolve(true);

    return new Promise((resolve) => {
        notify.confirm({
            title: "Discard unsaved changes?",
            content: `${action} will discard edits you have made to the current model. Export the model first if you want to keep them.`,
            okText: "Discard changes",
            okButtonProps: { danger: true },
            cancelText: "Cancel",
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
        });
    });
};
