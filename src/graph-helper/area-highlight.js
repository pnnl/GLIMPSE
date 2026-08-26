import graphHelper from "./GraphHelper";
import { notify } from "../utils/notify";

export const MAX_HIGHLIGHT_AREAS = 10;

const AREA_PALETTE = {
    light: [
        "#1F6FB4",
        "#C06A00",
        "#3F8F5E",
        "#9C2B2B",
        "#A884A8",
        "#545460",
        "#843C84",
        "#9090CC",
        "#CC8490",
        "#603CD8",
    ],
    dark: [
        "#5BA8E8",
        "#E6A32E",
        "#5FCF8E",
        "#F0705C",
        "#6C6C78",
        "#CCC0D8",
        "#A848A8",
        "#5460D8",
        "#84A89C",
        "#B44854",
    ],
};

class AreaHighlight {
    #selection = []; // area ids, any level
    #slots = {}; // areaId -> AREA_PALETTE index, stable while an area stays selected
    #darkMode = false;
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

    setDarkMode(darkMode) {
        const next = Boolean(darkMode);
        if (next === this.#darkMode) return;
        this.#darkMode = next;
        this.#colorsCache = null;
        if (this.#selection.length > 0) this.#notify();
    }

    isSelected(areaId) {
        return this.#selection.includes(areaId);
    }

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
            if (id in this.#slots) {
                continue;
            }

            let slot = 0;
            while (taken.has(slot)) {
                slot += 1;
            }

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
