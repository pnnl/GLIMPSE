import POWER_GRID_THEME from "../themes/PowerGrid.theme.json";

const CUSTOM_THEME_NAME = "custom-theme";

const randomColor = () =>
    `#${Math.floor(Math.random() * 0x1000000).toString(16).padStart(6, "0").toUpperCase()}`;

/** Theme keys whose value may be a `{ light, dark }` pair. */
const MODE_KEYS = ["color", "borderColor"];

/** One side of a `{ light, dark }` pair, or the value itself when it isn't one. */
const pickMode = (value, darkMode) => {
    if (value === null || typeof value !== "object") return value;
    // Fall back to the other mode so a pair that only defines one side still renders.
    return darkMode ? (value.dark ?? value.light) : (value.light ?? value.dark);
};

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
 * The unflattened theme for a selection: the uploaded file for the custom theme
 * (null when none came with the upload), otherwise the bundled power-grid theme.
 */
export const themeSourceFor = (themeName, jsonTheme = null) =>
    themeName === CUSTOM_THEME_NAME ? jsonTheme : POWER_GRID_THEME;

export const nodeTypesOf = (theme) => Object.keys(theme.groups ?? {});

export const edgeTypesOf = (theme) => Object.keys(theme.edgeOptions ?? {});

export const emptyTypeCounts = (theme) => ({
    nodes: Object.fromEntries(nodeTypesOf(theme).map((type) => [type, 0])),
    edges: Object.fromEntries(edgeTypesOf(theme).map((type) => [type, 0])),
});

export const ensureNodeGroup = (theme, objectType) => {
    if (objectType in theme.groups) return;
    theme.groups[objectType] = { size: 4, color: randomColor() };
};

export const ensureEdgeOption = (theme, objectType) => {
    if (objectType in theme.edgeOptions) return;
    theme.edgeOptions[objectType] = { color: randomColor(), size: 2 };
};
