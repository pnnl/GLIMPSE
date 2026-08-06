// Theme resolution and the per-type counters derived from it.
//
// A theme is `{ groups: { <nodeType>: {...sigma attrs} }, edgeOptions: { <edgeType>: {...} } }`.
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

/**
 * The theme to use for a given selection. Anything other than the custom theme
 * falls back to the bundled power-grid theme.
 *
 * @param {string} themeName - graphHelper.themeName
 * @param {Object|null} jsonTheme - the uploaded `<name>.theme.json`, when there is one
 * @returns {Object|null} the theme, or null when a custom theme was selected without a file
 *   (the caller then keeps the previous type lists — see setThemeObject)
 */
export const resolveTheme = (themeName, jsonTheme = null) => {
    if (themeName === CUSTOM_THEME_NAME) return jsonTheme ?? null;
    return POWER_GRID_THEME;
};

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
