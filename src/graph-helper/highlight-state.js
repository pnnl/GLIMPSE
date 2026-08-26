export class HighlightState {
    #groups = [];
    #edgeTypes = [];
    #areas = [];
    nodeIDs = [];
    edgeIDs = [];
    objects = [];
    focusIndex = -1;

    #syncObjects() {
        this.objects = [...this.nodeIDs, ...this.edgeIDs];
    }

    toggleGroup(graph, groupName) {
        this.#groups = toggle(this.#groups, groupName);
        this.nodeIDs = graph
            .filterNodes((n, attrs) => this.#groups.includes(attrs.group))
            .map((n) => ({ type: "node", id: n }));
        this.#syncObjects();
    }

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

    isHighlighted(name) {
        return this.#groups.includes(name) || this.#edgeTypes.includes(name);
    }

    setAreas(areaIds) {
        this.#areas = Array.isArray(areaIds) ? areaIds : [];
    }

    get areas() {
        return this.#areas;
    }

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
