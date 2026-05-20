// utils/fa2-presets.js
export function getFA2Settings(graph) {
    const order = graph.order;

    // -------- SMALL GRAPHS (~250 or fewer) --------
    if (order <= 250) {
        return {
            barnesHutOptimize: false,
            barnesHutTheta: 0.5,
            linLogMode: false,
            adjustSizes: true,
            edgeWeightInfluence: 1,
            outboundAttractionDistribution: false,
            scalingRatio: 40, // ↑ from 25 — more breathing room for edge icons
            gravity: 0.15, // ↓ from 0.3 — less inward pull
            strongGravityMode: false,
            slowDown: 12, // ↑ from 8 — smoother settle, no jitter risk at this size
        };
    }

    // -------- LARGE GRAPHS (> 1000) --------
    if (order > 1000) {
        return {
            barnesHutOptimize: true,
            barnesHutTheta: 0.5, // ↓ from 0.6 — more accurate
            linLogMode: false, // ← turn OFF (was your earlier good state)
            adjustSizes: false,
            edgeWeightInfluence: 2.5, // ← was 2 — now uniform attraction
            outboundAttractionDistribution: true,
            scalingRatio: 60, // ↓ from 85 — sufficient with linLog off
            gravity: 0.02, // ↓ from 0.05 — let chains stretch
            strongGravityMode: false,
            slowDown: 15, // ↑ from 10 — smoother settle
        };
    }

    // -------- MEDIUM (250 < n <= 1000) --------
    return {
        barnesHutOptimize: order > 500,
        barnesHutTheta: 0.5,
        linLogMode: false,
        adjustSizes: true,
        edgeWeightInfluence: 1,
        outboundAttractionDistribution: true, // helps hubs open up
        scalingRatio: 25, // ↑ from 15
        gravity: 0.2, // ↓ from 0.4
        strongGravityMode: false,
        slowDown: 14, // ↑ from 10
    };
}
