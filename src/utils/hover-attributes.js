// ============================================================================
// hover-attributes.js — chooses which model attributes appear on a hover card.
// ============================================================================
// The hover card is a canvas drawing, so it can't have a collapsible section.
// Instead the noisy identifier/bookkeeping fields are dropped, the rest is
// sorted with electrically-interesting fields first and capped, and the count
// of everything omitted is reported so the card can point at the Model Data
// View — which is where the exhaustive list belongs.
//
// Pure and dependency-free so it can be unit-tested directly (see
// js-testing/hover-attributes.test.mjs).

// Identifiers and association bookkeeping: essential in the data view, useless
// on hover, where they push the interesting fields off the card. `dist_areas`
// is dropped because area membership already has its own selector and
// highlighting.
export const HIDDEN_ATTRIBUTES = new Set([
    "mRID",
    "id",
    "feeder_id",
    "feeder_area_id",
    "switch_area_id",
    "secondary_area_id",
    "feeder_area_name",
    "switch_area_name",
    "secondary_area_name",
    "dist_areas",
    "dist_area_id",
    "dist_area_type",
    "dist_area_name",
    "Location",
    "x",
    "y",
    "name", // already the card's headline
]);

// Shown first when present — the fields an engineer looks for on a feeder.
export const PRIORITY_ATTRIBUTES = [
    "phases",
    "nominal_voltage",
    "status",
    "class_type",
    "length",
    "rated_current",
    "ratedS",
    "ratedU",
    "sections",
    "normalSections",
    "step",
    "parent",
    "from",
    "to",
];

export const MAX_ATTRIBUTES = 8;

const isEmpty = (v) => v === null || v === undefined || v === "";

/**
 * @param {Object} attributes - a node's or edge's model attributes
 * @returns {{ lines: string[], hidden: number }} display lines, and how many
 *   attributes were omitted (filtered out *and* truncated) so the caller can
 *   render a "+N more" hint.
 */
export const buildHoverAttributes = (attributes) => {
    if (!attributes || typeof attributes !== "object") return { lines: [], hidden: 0 };

    // `name` is excluded from the total too — it is displayed as the card's
    // headline, so counting it as "omitted" would overstate what's missing.
    const displayable = Object.entries(attributes).filter(
        ([key, val]) => key !== "name" && !isEmpty(val),
    );

    const interesting = displayable.filter(([key]) => !HIDDEN_ATTRIBUTES.has(key));

    interesting.sort(([a], [b]) => {
        const ia = PRIORITY_ATTRIBUTES.indexOf(a);
        const ib = PRIORITY_ATTRIBUTES.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
    });

    let shown = interesting.slice(0, MAX_ATTRIBUTES);

    // Some object types carry nothing but identifiers and area bookkeeping — a
    // CIM connectivity_node has only id/name/feeder_id/area fields/x/y, all of
    // which are hidden. Falling back to the identifier keeps the card from
    // rendering as an empty box.
    if (shown.length === 0) {
        const idKey = !isEmpty(attributes.mRID) ? "mRID" : "id";
        if (!isEmpty(attributes[idKey])) shown = [[idKey, attributes[idKey]]];
    }

    const lines = shown.map(([key, val]) => {
        // Nested values would otherwise render as "[object Object]".
        const display = val !== null && typeof val === "object" ? JSON.stringify(val) : val;
        return `${key}: ${display}`;
    });

    return { lines, hidden: Math.max(0, displayable.length - shown.length) };
};
