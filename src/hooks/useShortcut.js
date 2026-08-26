import { useEffect, useRef } from "react";

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
    const parts = combo
        .toLowerCase()
        .split("+")
        .map((p) => p.trim());
    return {
        ctrl: parts.includes("ctrl") || parts.includes("cmd") || parts.includes("mod"),
        shift: parts.includes("shift"),
        alt: parts.includes("alt"),
        key: normalizeKey(parts[parts.length - 1]),
    };
};

const matches = (parsed, e) => {
    if (normalizeKey(e.key) !== parsed.key) {
        return false;
    }
    if (parsed.ctrl !== (e.ctrlKey || e.metaKey)) {
        return false;
    }
    if (parsed.alt !== e.altKey) {
        return false;
    }
    if (parsed.shift && !e.shiftKey) {
        return false;
    }
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
