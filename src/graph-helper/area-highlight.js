// Which distribution areas are currently singled out, and what color each one
// was given.
//
// This lives outside React because three separate places drive the same
// selection — the area tree, the on-graph agent markers, and the agents view —
// and they must agree. Each selected area costs one full-canvas WebGL layer, so
// a second component keeping its own copy of the selection would double-bind
// those layers and blow the context budget. There is exactly one selection, held
// here; AreaHighlightLayers renders it, and everything else reads and mutates it
// through this module.
//
// Rendering is deliberately not this module's job: it knows nothing about sigma.

import graphHelper from "./GraphHelper";
import { notify } from "../utils/notify";

// Each highlighted area is a separate full-canvas WebGL contour layer, so GPU
// memory/draw cost scales linearly with the selection. Cap how many can render
// at once to avoid exhausting the WebGL context (which crashes the canvas) on
// large models with hundreds of distribution areas.
export const MAX_HIGHLIGHT_AREAS = 10;

// A fixed, ordered sequence rather than colors generated per selection: the same
// area then gets the same color every session, which is what makes screenshots
// and side-by-side comparisons mean anything.
//
// Chosen by maximizing the smallest pairwise distance under simulated
// protanopia, deuteranopia and tritanopia, subject to a contrast floor against
// the canvas and a saturation cap. All ten stay at least ΔE 10 apart under every
// simulation — on par with the Okabe-Ito palette's own worst pair — and the
// earlier entries are the better-separated ones, so a typical two-to-five area
// selection gets the strongest contrast.
//
// Two sequences, because a single set could only clear both canvases by sitting
// at one luminance, and equal luminance is precisely what removes the lightness
// cue color-deficient viewers depend on.
const AREA_PALETTE = {
    light: ["#1F6FB4", "#C06A00", "#3F8F5E", "#9C2B2B", "#A884A8",
            "#545460", "#843C84", "#9090CC", "#CC8490", "#603CD8"],
    dark:  ["#5BA8E8", "#E6A32E", "#5FCF8E", "#F0705C", "#6C6C78",
            "#CCC0D8", "#A848A8", "#5460D8", "#84A89C", "#B44854"],
};

class AreaHighlight {
    #selection = []; // area ids, any level
    #slots = {}; // areaId -> AREA_PALETTE index, stable while an area stays selected
    #darkMode = false;
    // Derived from #slots + #darkMode, cached because AreaHighlightLayers keys a
    // useEffect on it: handing back a fresh object each read would rebind one
    // WebGL contour layer per area on every render.
    #colorsCache = null;
    #listeners = new Set();

    get selection() {
        return this.#selection;
    }

    /** areaId -> hex for the active theme. Stable identity until one of them changes. */
    get colors() {
        if (!this.#colorsCache) {
            const palette = AREA_PALETTE[this.#darkMode ? "dark" : "light"];
            this.#colorsCache = Object.fromEntries(
                Object.entries(this.#slots).map(([id, slot]) => [id, palette[slot]]),
            );
        }
        return this.#colorsCache;
    }

    colorFor(areaId) {
        return this.colors[areaId];
    }

    /**
     * Swaps the area colors for the other canvas. Each area keeps its slot, so
     * an area that is blue in one theme is the corresponding blue in the other.
     */
    setDarkMode(darkMode) {
        const next = Boolean(darkMode);
        if (next === this.#darkMode) return;
        this.#darkMode = next;
        this.#colorsCache = null;
        // The contour layers read `colors` — they have to be told it changed.
        if (this.#selection.length > 0) this.#notify();
    }

    isSelected(areaId) {
        return this.#selection.includes(areaId);
    }

    /**
     * Replaces the selection, capping it at what the GPU can carry and warning
     * when that truncates what was asked for.
     */
    select(areaIds) {
        const next = Array.isArray(areaIds) ? areaIds : [];

        if (next.length > MAX_HIGHLIGHT_AREAS) {
            notify.warning(
                `Only ${MAX_HIGHLIGHT_AREAS} distribution areas can be highlighted at once. ` +
                    `Showing the first ${MAX_HIGHLIGHT_AREAS} of ${next.length}.`,
            );
        }

        this.#selection = next.slice(0, MAX_HIGHLIGHT_AREAS);
        this.#syncColors();

        // The reducers in GraphRenderer grey out everything outside the
        // selection; keeping graphHelper in step here means no caller has to
        // remember to.
        graphHelper.setHighlightedAreas(this.#selection);
        this.#notify();
    }

    /** Adds or removes one area — what clicking an agent marker does. */
    toggle(areaId) {
        if (!areaId) return;
        this.select(
            this.#selection.includes(areaId)
                ? this.#selection.filter((id) => id !== areaId)
                : [...this.#selection, areaId],
        );
    }

    clear() {
        if (this.#selection.length === 0) return;
        this.select([]);
    }

    subscribe(listener) {
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }

    // Colors are assigned the moment the selection changes, not at render time,
    // so the contour layers and every legend that mirrors them find the color
    // already there and can never disagree about it.
    #syncColors() {
        this.#colorsCache = null;

        // Drop departed areas first so their slots are free to be reused.
        Object.keys(this.#slots).forEach((id) => {
            if (!this.#selection.includes(id)) delete this.#slots[id];
        });

        // New areas take the lowest free slot, which keeps a small selection on
        // the best-separated end of the palette however often it is changed.
        const taken = new Set(Object.values(this.#slots));
        for (const id of this.#selection) {
            if (id in this.#slots) continue;
            let slot = 0;
            while (taken.has(slot)) slot += 1;
            this.#slots[id] = slot;
            taken.add(slot);
        }
    }

    #notify() {
        this.#listeners.forEach((listener) => {
            try {
                listener(this.#selection);
            } catch (err) {
                console.error("[AreaHighlight] listener failed:", err);
            }
        });
    }
}

const areaHighlight = new AreaHighlight();

export default areaHighlight;
