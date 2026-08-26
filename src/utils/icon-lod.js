export const ICON_FADE_START = 250;
export const ICON_FADE_END = 1000;

export function iconFadeForOrder(order) {
    const t = Math.min(1, Math.max(0, (order - ICON_FADE_START) / (ICON_FADE_END - ICON_FADE_START)));
    return t * t * (3 - 2 * t); // smoothstep
}
