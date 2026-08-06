// ── Searched-edge focus pulse ───────────────────────────────────────────────
// When the user searches for (or steps Prev/Next to) an edge we pulse it and
// raise its zIndex so it draws — and hit-tests — on top of any edges stacked
// underneath it (e.g. when two nodes share the same coordinates). The pulse
// plays for PULSE_DURATION then eases into a steady emphasis that holds until
// the focus is cleared or another edge is focused.

export const PULSE_DURATION = 2600; // ms
export const PULSE_PERIOD = 650; // ms — one grow/shrink cycle
export const FOCUS_COLOR = "#ff9500";

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export class EdgeFocus {
    #edgeId = null;
    #pulseStart = 0;

    get edgeId() {
        return this.#edgeId;
    }

    set(graph, edgeId) {
        // restore the previously focused edge's normal stacking order
        if (this.#edgeId && this.#edgeId !== edgeId && graph.hasEdge(this.#edgeId)) {
            graph.setEdgeAttribute(this.#edgeId, "zIndex", 0);
        }

        this.#edgeId = edgeId;
        this.#pulseStart = now();

        // zIndex is a layout-impacting field, so setting it triggers a re-index +
        // z-order re-sort on the next (full) refresh — this is what actually
        // brings the edge to the top for drawing and click/double-click picking.
        if (edgeId && graph.hasEdge(edgeId)) {
            graph.setEdgeAttribute(edgeId, "zIndex", 1000);
        }
    }

    clear(graph) {
        if (this.#edgeId && graph.hasEdge(this.#edgeId)) {
            graph.setEdgeAttribute(this.#edgeId, "zIndex", 0);
        }
        this.#edgeId = null;
        this.#pulseStart = 0;
    }

    // True only while the attention pulse is still animating, so the render
    // ticker knows to keep issuing frames. Once false the edge keeps its steady
    // emphasis from the last rendered frame without any ongoing refreshes.
    isPulseActive() {
        if (!this.#edgeId) return false;
        return now() - this.#pulseStart <= PULSE_DURATION;
    }

    /**
     * A pulsed/emphasized copy of `attrs` when `edgeId` is the focused edge,
     * otherwise null. Called from the Sigma edge reducer BEFORE any dimming
     * logic so the focused edge is never greyed out.
     */
    styleFor(edgeId, attrs) {
        if (!this.#edgeId || edgeId !== this.#edgeId) return null;

        const elapsed = now() - this.#pulseStart;
        // Amplitude eases full → 0 across the pulse window; afterward `decay` is 0
        // so the edge holds a steady 2× emphasis instead of oscillating forever.
        const decay = Math.max(0, 1 - elapsed / PULSE_DURATION);
        const wave = 0.5 + 0.5 * Math.sin((elapsed / PULSE_PERIOD) * 2 * Math.PI);
        const base = attrs.size || 2;

        const styled = {
            ...attrs,
            color: FOCUS_COLOR,
            size: base * (2 + 2 * wave * decay),
            zIndex: 1000,
            label: attrs.attributes?.name ?? edgeId,
            forceLabel: true,
        };

        // Icon edges pulse their symbol too, without overwriting a switch's
        // open/closed status color (which stays meaningful).
        const iconScale = 1 + 0.6 * wave * decay;
        if (attrs.iconType === "switch") styled.switchSize = (attrs.switchSize || 8) * iconScale;
        else if (attrs.iconType === "regulator")
            styled.regulatorSize = (attrs.regulatorSize || 16) * iconScale;
        else if (attrs.iconType === "transformer")
            styled.transformerSize = (attrs.transformerSize || 16) * iconScale;

        return styled;
    }
}
