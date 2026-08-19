// Theme resolution and the per-type counters derived from it.
//
// A theme is `{ groups: { <nodeType>: {...sigma attrs} }, edgeOptions: { <edgeType>: {...} } }`.
//
// `color` and `borderColor` may each be either a plain CSS color or a
// `{ light, dark }` pair. resolveTheme flattens those pairs down to one string
// for the active mode before anything else sees the theme, so every consumer
// (element-factory, graph-builder, legend, simulation) keeps working with plain
// color strings and single-color themes uploaded by users still load unchanged.
// `groups` keys define the known node types, `edgeOptions` keys the known edge types — which is
// also how a parsed object's `objectType` is classified as a node or an edge (see graph-builder).
// Types that aren't in the theme get an entry minted on the fly (see ensureNodeGroup /
// ensureEdgeOption) so socket-added or unrecognized objects still render.

import POWER_GRID_THEME from "../themes/PowerGrid.theme.json";

export const CUSTOM_THEME_NAME = "custom-theme";

/** Generates a random color in hexadecimal format. */
export const randomColor = () => {
    const letters = "0123456789ABCDEF";
    let color = "#";

    while (color.length < 7) color += letters[Math.floor(Math.random() * 16)];

    return color;
};

/** Theme keys whose value may be a `{ light, dark }` pair. */
const MODE_KEYS = ["color", "borderColor"];

/** One side of a `{ light, dark }` pair, or the value itself when it isn't one. */
const pickMode = (value, darkMode) => {
    if (value === null || typeof value !== "object") return value;
    // Fall back to the other mode so a pair that only defines one side still renders.
    return darkMode ? (value.dark ?? value.light) : (value.light ?? value.dark);
};

/**
 * A copy of the theme with every `{ light, dark }` pair collapsed to the value
 * for the active mode. The source theme is never mutated — GraphHelper keeps it
 * so it can re-flatten when the mode is toggled.
 */
export const flattenTheme = (theme, darkMode) => {
    const section = (entries = {}) =>
        Object.fromEntries(
            Object.entries(entries).map(([type, attrs]) => {
                const flat = { ...attrs };
                for (const key of MODE_KEYS) {
                    if (key in flat) flat[key] = pickMode(flat[key], darkMode);
                }
                return [type, flat];
            }),
        );

    return {
        ...theme,
        groups: section(theme.groups),
        edgeOptions: section(theme.edgeOptions),
    };
};

/**
 * The theme to use for a given selection. Anything other than the custom theme
 * falls back to the bundled power-grid theme.
 *
 * @param {string} themeName - graphHelper.themeName
 * @param {Object|null} jsonTheme - the uploaded `<name>.theme.json`, when there is one
 * @param {boolean} [darkMode] - which side of any `{ light, dark }` pair to use
 * @returns {Object|null} the theme, or null when a custom theme was selected without a file
 *   (the caller then keeps the previous type lists — see setThemeObject)
 */
export const resolveTheme = (themeName, jsonTheme = null, darkMode = false) => {
    const theme = themeSourceFor(themeName, jsonTheme);
    return theme ? flattenTheme(theme, darkMode) : null;
};

/**
 * The theme as authored, with any `{ light, dark }` pairs intact. GraphHelper
 * holds on to this so toggling the mode can re-flatten without needing the
 * original upload again.
 */
export const themeSourceFor = (themeName, jsonTheme = null) =>
    themeName === CUSTOM_THEME_NAME ? jsonTheme : POWER_GRID_THEME;

/** Every node type the theme knows about. */
export const nodeTypesOf = (theme) => Object.keys(theme.groups ?? {});

/** Every edge type the theme knows about. */
export const edgeTypesOf = (theme) => Object.keys(theme.edgeOptions ?? {});

/** A fresh `{ nodes: { <type>: 0 }, edges: { <type>: 0 } }` tally for the theme's types. */
export const emptyTypeCounts = (theme) => ({
    nodes: Object.fromEntries(nodeTypesOf(theme).map((type) => [type, 0])),
    edges: Object.fromEntries(edgeTypesOf(theme).map((type) => [type, 0])),
});

/** Registers a node type the theme doesn't know about, so it still gets drawn. */
export const ensureNodeGroup = (theme, objectType) => {
    if (objectType in theme.groups) return;
    theme.groups[objectType] = { size: 4, color: randomColor() };
};

/** Registers an edge type the theme doesn't know about, so it still gets drawn. */
export const ensureEdgeOption = (theme, objectType) => {
    if (objectType in theme.edgeOptions) return;
    // `size` (not `width`) — that's the key every consumer of the theme reads,
    // and what PowerGrid.theme.json uses.
    theme.edgeOptions[objectType] = { color: randomColor(), size: 2 };
};
