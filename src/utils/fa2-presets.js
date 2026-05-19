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
            scalingRatio: 25, // repulsion strength (↑ = more spread) — increased to prevent overlap
            gravity: 0.3, // reduced to allow more natural spreading
            strongGravityMode: false, // distance-dependent, gentler unravel
            slowDown: 8, // ≈ damping; higher = less jitter
            barnesHutTheta: 0.5,
        };
    }

    // -------- LARGE GRAPHS (> 1000) --------
    if (order > 1000) {
        return {
            barnesHutOptimize: true, // O(n·log n) — required at this size
            barnesHutTheta: 0.8, // a touch faster; 0.5 is more accurate
            linLogMode: true, // produces tighter, cleaner clusters
            adjustSizes: true, // keep enabled to prevent node overlap
            edgeWeightInfluence: 1,
            outboundAttractionDistribution: false, // helps dense hubs spread nicely

            scalingRatio: 8, // increased to improve node separation
            gravity: 0.2, // reduced to allow more natural spacing
            strongGravityMode: false,
            slowDown: 4, // big graphs need more damping to settle
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

        scalingRatio: 15, // increased to spread nodes and prevent overlap
        gravity: 0.4, // reduced to allow more spreading
        strongGravityMode: false,
        slowDown: 10, // increased damping for stability
    };
}
