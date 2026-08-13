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

import iwanthue from "iwanthue";
import graphHelper from "./GraphHelper";
import { notify } from "../utils/notify";

// Each highlighted area is a separate full-canvas WebGL contour layer, so GPU
// memory/draw cost scales linearly with the selection. Cap how many can render
// at once to avoid exhausting the WebGL context (which crashes the canvas) on
// large models with hundreds of distribution areas.
export const MAX_HIGHLIGHT_AREAS = 10;

class AreaHighlight {
    #selection = []; // area ids, any level
    #colors = {}; // areaId -> hex, stable while an area stays selected
    #listeners = new Set();

    get selection() {
        return this.#selection;
    }

    get colors() {
        return this.#colors;
    }

    colorFor(areaId) {
        return this.#colors[areaId];
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
        const unassigned = this.#selection.filter((id) => !this.#colors[id]);

        if (unassigned.length > 0) {
            const palette = iwanthue(unassigned.length, {
                colorSpace: [0, 360, 20, 100, 15, 80],
            });
            unassigned.forEach((id, i) => {
                this.#colors[id] = palette[i];
            });
        }

        Object.keys(this.#colors).forEach((id) => {
            if (!this.#selection.includes(id)) delete this.#colors[id];
        });
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
