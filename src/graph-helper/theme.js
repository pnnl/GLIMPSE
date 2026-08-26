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
