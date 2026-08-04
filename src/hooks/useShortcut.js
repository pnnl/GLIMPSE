import { useEffect, useRef } from "react";

// ============================================================================
// useShortcut — declarative keyboard shortcuts.
// ============================================================================
// Each component registers the shortcuts for the actions it already owns, so
// there is no central key table to keep in sync with the buttons. Combos are
// written as "n", "ctrl+f", "shift+/", "escape", "space" — case-insensitive,
// modifiers in any order.
//
// Shortcuts never fire while the user is typing (see isTypingTarget), which
// matters here because the app has an always-present search box.

const isTypingTarget = (el) => {
    if (!el || !el.tagName) return false;
    const tag = el.tagName.toUpperCase();
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable === true;
};

// Normalize KeyboardEvent.key so combos can be written the readable way.
const normalizeKey = (key) => {
    const k = key.toLowerCase();
    if (k === " ") return "space";
    if (k === "esc") return "escape";
    return k;
};

const parseCombo = (combo) => {
    const parts = combo.toLowerCase().split("+").map((p) => p.trim());
    return {
        // ctrl and meta are treated as the same modifier so the same combo
        // works on Windows/Linux (Ctrl) and macOS (Cmd).
        ctrl: parts.includes("ctrl") || parts.includes("cmd") || parts.includes("mod"),
        shift: parts.includes("shift"),
        alt: parts.includes("alt"),
        key: normalizeKey(parts[parts.length - 1]),
    };
};

const matches = (parsed, e) => {
    if (normalizeKey(e.key) !== parsed.key) return false;
    if (parsed.ctrl !== (e.ctrlKey || e.metaKey)) return false;
    if (parsed.alt !== e.altKey) return false;
    // Only enforce shift when the combo asks for it: keys like "?" and "/"
    // already require shift on many layouts, and demanding an exact match
    // would make them unreachable.
    if (parsed.shift && !e.shiftKey) return false;
    return true;
};

/**
 * @param {string} combo - e.g. "n", "ctrl+f", "escape"
 * @param {Function} handler - run when the combo fires; receives the event
 * @param {Object} [options]
 * @param {boolean} [options.enabled=true] - skip registration when false
 * @param {boolean} [options.allowInInput=false] - also fire while typing
 */
export const useShortcut = (combo, handler, { enabled = true, allowInInput = false } = {}) => {
    // Held in a ref so a handler that closes over changing state doesn't
    // re-register the listener (or go stale) on every render. Written in an
    // effect rather than during render — refs must not be touched while
    // rendering.
    const handlerRef = useRef(handler);
    useEffect(() => {
        handlerRef.current = handler;
    });

    useEffect(() => {
        if (!enabled) return;

        const parsed = parseCombo(combo);

        const onKeyDown = (e) => {
            if (!allowInInput && isTypingTarget(e.target)) return;
            if (!matches(parsed, e)) return;
            e.preventDefault();
            handlerRef.current(e);
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [combo, enabled, allowInInput]);
};

// The canonical list, rendered by ShortcutsModal. Keeping it here (rather than
// in the modal) puts the labels next to the matcher they describe.
export const SHORTCUTS = [
    { combo: "/", label: "Focus search" },
    { combo: "n", label: "Focus next highlighted object" },
    { combo: "p", label: "Focus previous highlighted object" },
    { combo: "r", label: "Reset highlighting" },
    { combo: "v", label: "Color by voltage & loading violations (during a simulation)" },
    { combo: "f", label: "Center & fit the graph" },
    { combo: "l", label: "Start / stop the force layout" },
    { combo: "m", label: "Toggle the map background" },
    { combo: "d", label: "Toggle dark mode" },
    { combo: "Esc", label: "Close menu / clear search focus" },
    { combo: "?", label: "Show this help" },
];
