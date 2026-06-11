// utils/fa2-presets.js
export function getFA2Settings(graph) {
    const order = graph.order;

    // -------- SMALL GRAPHS (~250 or fewer) --------
    if (order <= 250) {
        return {
            barnesHutOptimize: false,
            barnesHutTheta: 0.5,
            linLogMode: false,
            adjustSizes: false,
            edgeWeightInfluence: 1,
            outboundAttractionDistribution: false,
            scalingRatio: 3, // ↑ from 25 — more breathing room for edge icons
            gravity: 0.3, // ↓ from 0.3 — less inward pull
            strongGravityMode: false,
            slowDown: 8, // ↑ from 8 — smoother settle, no jitter risk at this size
        };
    }

    // -------- LARGE GRAPHS (> 1000) --------
    if (order > 1_000) {
        return {
            barnesHutOptimize: true,
            barnesHutTheta: 0.8, // ↑ faster repulsion approximation on big graphs
            linLogMode: false,
            adjustSizes: false, // OFF: anti-collision damps movement; rely on scalingRatio for spacing
            edgeWeightInfluence: 1,
            outboundAttractionDistribution: false,
            scalingRatio: 50, // ↑ from 25 — much stronger repulsion spreads nodes farther apart
            gravity: 0.04, // ↓ from 0.5 — minimal inward pull so the graph keeps expanding
            strongGravityMode: false, // OFF — strong gravity was crushing the graph into a tight disc
            slowDown: 10, // larger value keeps the bigger forces from jittering
        };
    }

    // -------- MEDIUM (250 < n <= 1000) --------
    return {
        barnesHutOptimize: order > 500,
        barnesHutTheta: 0.6,
        linLogMode: false,
        adjustSizes: false,
        edgeWeightInfluence: 1,
        outboundAttractionDistribution: false, // helps hubs open up
        scalingRatio: 2, // ↑ from 15
        gravity: 0.2, // ↓ from 0.4
        strongGravityMode: false,
        slowDown: 10, // ↑ from 10
    };
}
