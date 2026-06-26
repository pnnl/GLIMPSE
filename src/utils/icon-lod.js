// utils/icon-lod.js
//
// Edge-icon level-of-detail gate.
//
// The switch / regulator / transformer vertex shaders fade their icon out as the
// camera zooms toward the full-graph view, so large models read as clean topology
// instead of a wall of symbols. That fade is only wanted on LARGE models: small
// models (and the legend, which is its own tiny sigma graph) should keep every
// icon at full detail at full view. Camera ratio is ~1 at full view regardless of
// model size, so zoom alone can't tell them apart — graph order can. We compute a
// 0..1 gate from the order and feed it to the shaders as the `u_fade` uniform:
//   order <= ICON_FADE_START → 0 → never fade (small models + legend)
//   order >= ICON_FADE_END   → 1 → full zoom fade (large models)
//   in between               → smoothstep ramp
//
// Thresholds mirror the FA2 small/large tiers in fa2-presets.js.
export const ICON_FADE_START = 250;
export const ICON_FADE_END = 1000;

export function iconFadeForOrder(order) {
    const t = Math.min(1, Math.max(0, (order - ICON_FADE_START) / (ICON_FADE_END - ICON_FADE_START)));
    return t * t * (3 - 2 * t); // smoothstep
}
