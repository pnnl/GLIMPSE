// What the user has singled out in the graph, and the cursor used to step
// through it with Prev/Next.
//
// Three independent selections feed the Sigma reducers in GraphRenderer:
//   • node groups and edge types  — toggled from the legend, dim everything else
//   • distribution areas          — toggled from the area tree
// The matching node/edge ids are also flattened into `objects`, which the
// toolbar walks with next()/previous().

export class HighlightState {
    #groups = [];
    #edgeTypes = [];
    #areas = []; // selected distribution-area ids (any level)

    nodeIDs = []; // [{ type: "node", id }]
    edgeIDs = []; // [{ type: "edge", id }]
    objects = []; // nodeIDs + edgeIDs, in Prev/Next order
    focusIndex = -1;

    #syncObjects() {
        this.objects = [...this.nodeIDs, ...this.edgeIDs];
    }

    /** Toggles a node group's highlight and recomputes the matching node ids. */
    toggleGroup(graph, groupName) {
        this.#groups = toggle(this.#groups, groupName);
        this.nodeIDs = graph
            .filterNodes((n, attrs) => this.#groups.includes(attrs.group))
            .map((n) => ({ type: "node", id: n }));
        this.#syncObjects();
    }

    /** Toggles an edge type's highlight and recomputes the matching edge ids. */
    toggleEdgeType(graph, edgeType) {
        this.#edgeTypes = toggle(this.#edgeTypes, edgeType);
        this.edgeIDs = graph
            .filterEdges((e, attrs) => this.#edgeTypes.includes(attrs.group))
            .map((e) => ({ type: "edge", id: e }));
        this.#syncObjects();
    }

    get groups() {
        return this.#groups;
    }

    get edgeTypes() {
        return this.#edgeTypes;
    }

    /** True for a group or edge-type name that is currently highlighted. */
    isHighlighted(name) {
        return this.#groups.includes(name) || this.#edgeTypes.includes(name);
    }

    // Distribution-area highlighting. Selected ids may be at any level
    // (feeder / switch / secondary); a node or edge is "in" the selection if any
    // of its area ids match. Because a member carries its full ancestry, selecting
    // a switch area also matches the nodes/edges in that switch area's secondary
    // areas, and selecting a feeder area matches everything under it.
    setAreas(areaIds) {
        this.#areas = Array.isArray(areaIds) ? areaIds : [];
    }

    get areas() {
        return this.#areas;
    }

    /** With no area selected everything counts as in-area, so nothing is dimmed. */
    isInArea(attrs) {
        if (this.#areas.length === 0) return true;
        const a = (attrs && attrs.attributes) || {};
        return (
            this.#areas.includes(a.feeder_area_id) ||
            this.#areas.includes(a.switch_area_id) ||
            this.#areas.includes(a.secondary_area_id)
        );
    }

    // ── Prev/Next cursor (wraps in both directions) ─────────────────────────

    next() {
        this.focusIndex++;
        if (this.focusIndex === this.objects.length) this.focusIndex = 0;
        return this.objects[this.focusIndex];
    }

    previous() {
        this.focusIndex--;
        if (this.focusIndex < 0) this.focusIndex = this.objects.length - 1;
        return this.objects[this.focusIndex];
    }

    current() {
        if (this.focusIndex === -1 || this.objects.length === 0) return null;
        return this.objects[this.focusIndex];
    }

    clear() {
        this.#groups = [];
        this.#edgeTypes = [];
        this.#areas = [];
        this.nodeIDs = [];
        this.edgeIDs = [];
        this.objects = [];
        this.focusIndex = -1;
    }
}

const toggle = (list, value) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
