export function getFA2Settings(graph) {
    const order = graph.order;
    // ------- SMALL (n <= 250) --------
    if (order <= 250) {
        return {
            barnesHutOptimize: false, // exact forces are fine (and better) at this size
            barnesHutTheta: 0.5,
            linLogMode: false,
            adjustSizes: false,
            edgeWeightInfluence: 1,
            outboundAttractionDistribution: false,
            scalingRatio: 1,
            gravity: 1, // ↑ from 0.3 — rein in drifting leaf nodes
            strongGravityMode: false, // pull ∝ distance: kills outliers that wreck autoRescale
            slowDown: 5,
        };
    }

    // -------- LARGE (n > 1000) --------
    if (order > 1_000) {
        return {
            barnesHutOptimize: order > 2_500,
            barnesHutTheta: 0.5, // tighter approx = cleaner untangling
            linLogMode: false, // ← untangle: log attraction reveals structure
            adjustSizes: false, // optional final-polish anti-overlap (slows convergence)
            edgeWeightInfluence: 1,
            outboundAttractionDistribution: false, // dissuade hubs → branches fan out
            scalingRatio: 1, // moderate: separates without overpowering attraction
            gravity: 1, // ↓ very low so it expands into its real shape
            strongGravityMode: false,
            slowDown: 5, // enough damping to settle cleanly while still moving
        };
    }

    // -------- MEDIUM (250 < n <= 1000) --------
    return {
        barnesHutOptimize: false,
        barnesHutTheta: 0.6,
        linLogMode: false,
        adjustSizes: false,
        edgeWeightInfluence: 1,
        outboundAttractionDistribution: false, // helps hubs open up
        scalingRatio: 1,
        gravity: 1,
        strongGravityMode: false,
        slowDown: 5,
    };
}
