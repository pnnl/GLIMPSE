// utils/fa2-presets.js
export function getFA2Settings(graph) {
    const order = graph.order;

    // -------- SMALL GRAPHS (~250 or fewer) --------
    if (order <= 250) {
        return {
            // Structural
            barnesHutOptimize: false, // not needed < ~1k, exact is smoother
            linLogMode: false, // linear → Vis.js-like "smooth"
            adjustSizes: true, // avoid node overlap (like avoidOverlap)
            edgeWeightInfluence: 1,
            outboundAttractionDistribution: false,

            // Forces
            scalingRatio: 10, // repulsion strength (↑ = more spread)
            gravity: 0.5, // weak, mimics centralGravity 0.01
            strongGravityMode: false, // distance-dependent, gentler unravel
            slowDown: 6, // ≈ damping; higher = less jitter
            barnesHutTheta: 0.5,
        };
    }

    // -------- LARGE GRAPHS (> 1000) --------
    if (order > 1000) {
        return {
            barnesHutOptimize: true, // O(n·log n) — required at this size
            barnesHutTheta: 0.8, // a touch faster; 0.5 is more accurate
            linLogMode: true, // produces tighter, cleaner clusters
            adjustSizes: false, // turn off during unraveling, enable later
            edgeWeightInfluence: 1,
            outboundAttractionDistribution: false, // helps dense hubs spread nicely

            scalingRatio: 2, // lower; linLog already spreads things
            gravity: 0.5,
            strongGravityMode: false,
            slowDown: 2, // big graphs need more damping to settle
        };
    }

    // -------- MEDIUM (250 < n <= 1000) --------
    return {
        barnesHutOptimize: order > 500,
        barnesHutTheta: 0.5,
        linLogMode: false,
        adjustSizes: true,
        edgeWeightInfluence: 1,
        outboundAttractionDistribution: false,

        scalingRatio: 5,
        gravity: 0.8,
        strongGravityMode: false,
        slowDown: 8,
    };
}
