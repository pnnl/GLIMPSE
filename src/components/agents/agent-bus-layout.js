// Geometry for the layered message-bus diagram.
//
// GridAPPS-D's distributed architecture is drawn as a stack of horizontal
// message buses — the distribution-system bus at the top, then the feeder bus,
// then one bus per switch area, then one per secondary area — with agent boxes
// above each bus and the field devices it carries below it.
//
// The layout is a single bottom-up pass. Widths are decided by the leaves: a
// secondary bus is as wide as its own content needs, a switch bus is as wide as
// the secondary buses beneath it, and so on up. That is what keeps each subtree
// visually contained under its parent instead of overlapping its neighbours,
// which is the whole point of the picture.
//
// Two limits keep that from running away on a real feeder. The 9500-bus model
// has ~110 switch areas and ~1275 secondary areas; drawn in full the diagram is
// tens of thousands of pixels wide, and zooming it to fit makes every box too
// small to read. So the caller sets how many levels to draw, and any one bus
// draws at most MAX_SIBLINGS children — the rest are reported as a count the
// view offers to expand. Nothing is silently dropped.
//
// Kept free of React and of any color decision so the arithmetic can be reasoned
// about (and tested) on its own; AgentsView paints what this returns.

// Vertical distance between bus levels. A row has to clear the tallest stack a
// bus can hold — its devices chip, an opened device row and the "+N areas" chip
// — before the next row's agent boxes start, or the two collide.
const ROW_HEIGHT = 175;
const BUS_HEIGHT = 12;
const BOX_WIDTH = 96;
const BOX_HEIGHT = 46;
const DEVICE_WIDTH = 148; // two lines: the device's own name over its CIM class
const DEVICE_HEIGHT = 34;
const GAP = 16; // horizontal breathing room between sibling subtrees
const LABEL_GUTTER = 190; // left column holding the row labels
const AGENT_BUS_GAP = 14; // between an agent box and the bus it sits on
const CHIP_WIDTH = 104;
const CHIP_HEIGHT = 22;

// Agent boxes hang *above* their bus, so the first row needs enough headroom for
// one or the coordinating agent is drawn off the top of the diagram.
const PADDING = BOX_HEIGHT + AGENT_BUS_GAP + 24;

// How many children one bus draws before the rest become a "+N more" chip.
// Twelve is about where a row still reads as a row rather than a smear.
export const MAX_SIBLINGS = 12;

// Deeper rows multiply: twelve switch areas each drawing twelve secondaries is
// 144 columns, and the fan-out is the same shape all the way down. Halving the
// cap below the first fan-out keeps the total bounded without hiding the shape.
const MAX_SIBLINGS_DEEP = 6;

const siblingCap = (depth) => (depth <= 1 ? MAX_SIBLINGS : MAX_SIBLINGS_DEEP);

// Rows, top to bottom, with the depth each sits at. Only levels the roster
// actually reaches get drawn.
const ROWS = [
    { level: "system", label: "Distribution System\nMessage Bus" },
    { level: "feeder", label: "Feeder\nMessage Buses" },
    { level: "switch", label: "Switch Area\nMessage Buses" },
    { level: "secondary", label: "Distribution Secondary\nMessage Buses" },
];

const rowWidth = (count, itemWidth) => count * itemWidth + Math.max(0, count - 1) * GAP;

/**
 * Width one bus needs for its own contents: its agents side by side, plus its
 * devices side by side, whichever is wider.
 */
const intrinsicWidth = (agentCount, devicesWidth, hasChip) =>
    Math.max(rowWidth(agentCount, BOX_WIDTH), devicesWidth, hasChip ? CHIP_WIDTH : 0, BOX_WIDTH);

/**
 * Arranges a roster into positioned bus bars, agent boxes and device chips.
 *
 * @param {{buses: Array, agents: Array}} roster - normalized agent roster
 * @param {{maxDepth?: number, expanded?: Set<string>}} options
 *   maxDepth - how many levels below the root to draw (0 draws the top row only)
 *   expanded - bus ids whose children are drawn in full, ignoring both maxDepth
 *              and the sibling cap. This is the drill-down.
 *   collapseDevices - draw each bus's devices as one "N devices" chip instead of
 *              a chip per device. A switch-area row carries a dozen devices and
 *              the bus is sized to hold them, so drawing them all is what makes
 *              those bars run off the screen.
 *   devicesExpanded - bus ids whose devices are drawn in full despite that.
 * @returns {{
 *   width: number, height: number,
 *   rows: {level: string, label: string, y: number}[],
 *   buses: {busId, level, name, label, areaId, x, y, width, height, hiddenChildren, chip, deviceChip}[],
 *   agents: {agent, x, y, width, height}[],
 *   devices: {device, busId, x, y, width, height}[],
 *   truncated: boolean,
 * }}
 */
export const layoutAgentBuses = (
    roster,
    { maxDepth = Infinity, expanded, collapseDevices = false, devicesExpanded } = {},
) => {
    const open = expanded ?? new Set();
    const devicesOpen = devicesExpanded ?? new Set();
    const empty = {
        width: 0,
        height: 0,
        rows: [],
        buses: [],
        agents: [],
        devices: [],
        truncated: false,
    };
    if (!roster || roster.buses.length === 0) return empty;

    const agentsByBus = new Map();
    roster.agents.forEach((agent) => {
        const list = agentsByBus.get(agent.messageBusId) ?? [];
        list.push(agent);
        agentsByBus.set(agent.messageBusId, list);
    });

    const busById = new Map(roster.buses.map((bus) => [bus.busId, bus]));
    const childrenOf = new Map();
    const roots = [];

    roster.buses.forEach((bus) => {
        const parent = bus.parentBusId;
        // A bus with no parent, or one whose parent isn't in the roster, is
        // treated as a root — a partial roster still draws rather than silently
        // losing a subtree.
        if (parent == null || !busById.has(parent)) {
            roots.push(bus.busId);
            return;
        }
        const siblings = childrenOf.get(parent) ?? [];
        siblings.push(bus.busId);
        childrenOf.set(parent, siblings);
    });

    const buses = [];
    const agents = [];
    const devices = [];
    const rowsUsed = new Set();
    let truncated = false;

    /**
     * Places one bus and everything under it, starting at `left`, and reports
     * how wide the whole subtree turned out.
     */
    const place = (busId, left, depth, seen = new Set()) => {
        const bus = busById.get(busId);
        // childrenOf is built from parent ids the roster supplies, so it can name
        // a bus that isn't in busById, and those parent links can form a cycle.
        // Either one would otherwise take the whole app down from inside a
        // useMemo — an undefined read, or unbounded recursion.
        if (!bus || seen.has(busId)) return 0;
        const branch = new Set(seen).add(busId);

        const busAgents = agentsByBus.get(busId) ?? [];
        const busDevices = busAgents.flatMap((agent) =>
            agent.devices.map((device) => ({ device, agent })),
        );

        const allChildren = childrenOf.get(busId) ?? [];
        const isOpen = open.has(busId);
        // Drawing children is gated by depth; an explicitly expanded bus ignores
        // that, which is what makes drill-down work below the current depth.
        const canDescend = depth < maxDepth || isOpen;
        const children = !canDescend
            ? []
            : isOpen
              ? allChildren
              : allChildren.slice(0, siblingCap(depth));
        const hiddenChildren = allChildren.length - children.length;
        if (hiddenChildren > 0) truncated = true;

        // Children first: the parent can only be sized once its subtrees are.
        let cursor = left;
        let childrenWidth = 0;
        children.forEach((childId, i) => {
            const used = place(childId, cursor, depth + 1, branch);
            if (used === 0) return; // skipped: unknown bus, or a cycle
            const step = used + (i < children.length - 1 ? GAP : 0);
            cursor += step;
            childrenWidth += step;
        });

        // A collapsed bus still shows *that* it carries devices, and the chip is
        // the control that opens them, so it only disappears when there are none.
        const devicesCollapsed = collapseDevices && !devicesOpen.has(busId);
        const drawnDevices = devicesCollapsed ? [] : busDevices;
        const showDeviceChip = collapseDevices && busDevices.length > 0;

        const width = Math.max(
            childrenWidth,
            intrinsicWidth(
                busAgents.length,
                Math.max(
                    rowWidth(drawnDevices.length, DEVICE_WIDTH),
                    showDeviceChip ? CHIP_WIDTH : 0,
                ),
                hiddenChildren > 0,
            ),
        );

        const rowIndex = ROWS.findIndex((row) => row.level === bus.level);
        const y = PADDING + (rowIndex < 0 ? depth : rowIndex) * ROW_HEIGHT;
        rowsUsed.add(bus.level);

        // Below the bus, in order: the devices chip, the devices themselves, then
        // the "+N areas" chip. Each is skipped when it has nothing to show, but
        // the order never changes, so a bus doesn't reflow as it is opened.
        let stack = y + BUS_HEIGHT + 12;
        const deviceChipY = stack;
        if (showDeviceChip) stack += CHIP_HEIGHT + 6;
        const devicesY = stack;
        if (drawnDevices.length > 0) stack += DEVICE_HEIGHT + 8;
        const chipY = stack;

        buses.push({
            busId,
            level: bus.level,
            name: bus.name,
            label: bus.label ?? bus.name,
            areaId: bus.areaId,
            x: left,
            y,
            width,
            height: BUS_HEIGHT,
            hiddenChildren,
            chip:
                hiddenChildren > 0
                    ? {
                          x: left + (width - CHIP_WIDTH) / 2,
                          y: chipY,
                          width: CHIP_WIDTH,
                          height: CHIP_HEIGHT,
                          count: hiddenChildren,
                      }
                    : null,
            deviceChip: showDeviceChip
                ? {
                      x: left + (width - CHIP_WIDTH) / 2,
                      y: deviceChipY,
                      width: CHIP_WIDTH,
                      height: CHIP_HEIGHT,
                      count: busDevices.length,
                      collapsed: devicesCollapsed,
                  }
                : null,
        });

        // Agents sit above their bus, centered on it.
        const agentsWidth = rowWidth(busAgents.length, BOX_WIDTH);
        let agentX = left + (width - agentsWidth) / 2;
        busAgents.forEach((agent) => {
            agents.push({
                agent,
                x: agentX,
                y: y - BOX_HEIGHT - AGENT_BUS_GAP,
                width: BOX_WIDTH,
                height: BOX_HEIGHT,
            });
            agentX += BOX_WIDTH + GAP;
        });

        let deviceX = left + (width - rowWidth(drawnDevices.length, DEVICE_WIDTH)) / 2;
        drawnDevices.forEach(({ device }) => {
            devices.push({
                device,
                busId,
                x: deviceX,
                y: devicesY,
                width: DEVICE_WIDTH,
                height: DEVICE_HEIGHT,
            });
            deviceX += DEVICE_WIDTH + GAP;
        });

        return width;
    };

    let cursor = LABEL_GUTTER;
    roots.forEach((rootId) => {
        cursor += place(rootId, cursor, 0) + GAP;
    });

    // Rows come from what was actually drawn, so a depth-limited diagram doesn't
    // reserve vertical space for levels it never reached.
    const rows = ROWS.filter((row) => rowsUsed.has(row.level)).map((row) => ({
        ...row,
        y: PADDING + ROWS.findIndex((r) => r.level === row.level) * ROW_HEIGHT,
    }));

    const lowest = rows.length > 0 ? Math.max(...rows.map((r) => r.y)) : PADDING;

    return {
        width: cursor + PADDING,
        height: lowest + ROW_HEIGHT,
        rows,
        buses,
        agents,
        devices,
        truncated,
    };
};

/** Depth needed to reach a given level, for the view's depth control. */
export const depthOfLevel = (level) => ROWS.findIndex((row) => row.level === level);

export const LAYOUT_CONSTANTS = {
    ROW_HEIGHT,
    BUS_HEIGHT,
    BOX_WIDTH,
    BOX_HEIGHT,
    DEVICE_WIDTH,
    DEVICE_HEIGHT,
    LABEL_GUTTER,
};
