//! ForceAtlas2 iteration, ported 1:1 from graphology-layout-forceatlas2/iterate.js.
//!
//! Works on the same flat matrices graphology builds (`graphToByteArrays`): 10 f32
//! per node, 3 f32 per edge (source/target are node *offsets*). Intermediate math is
//! f64 like JS numbers; every store into the matrices rounds to f32 like a Float32Array.

const NODE_X: usize = 0;
const NODE_Y: usize = 1;
const NODE_DX: usize = 2;
const NODE_DY: usize = 3;
const NODE_OLD_DX: usize = 4;
const NODE_OLD_DY: usize = 5;
const NODE_MASS: usize = 6;
const NODE_CONVERGENCE: usize = 7;
const NODE_SIZE: usize = 8;
const NODE_FIXED: usize = 9;

const PPN: usize = 10;
const PPE: usize = 3;

const SUBDIVISION_ATTEMPTS: u32 = 3;
const MAX_FORCE: f64 = 10.0;

#[derive(Clone, Copy)]
struct Region {
    node: isize, // node offset, -1 when empty
    center_x: f64,
    center_y: f64,
    size: f64,
    next_sibling: isize,
    first_child: isize,
    mass: f64,
    mass_center_x: f64,
    mass_center_y: f64,
}

impl Region {
    fn new(center_x: f64, center_y: f64, size: f64, next_sibling: isize) -> Self {
        Region {
            node: -1,
            center_x,
            center_y,
            size,
            next_sibling,
            first_child: -1,
            mass: 0.0,
            mass_center_x: 0.0,
            mass_center_y: 0.0,
        }
    }
}

struct Settings {
    adjust_sizes: bool,
    barnes_hut_optimize: bool,
    barnes_hut_theta: f64,
    scaling_ratio: f64,
    gravity: f64,
    strong_gravity_mode: bool,
    lin_log_mode: bool,
    outbound_attraction_distribution: bool,
    edge_weight_influence: f64,
    slow_down: f64,
}

/// Quadrant child index of `r` for point (x, y).
#[inline]
fn quadrant(r: &Region, x: f64, y: f64) -> usize {
    let c = r.first_child as usize;
    match (x < r.center_x, y < r.center_y) {
        (true, true) => c,
        (true, false) => c + 1,
        (false, true) => c + 2,
        (false, false) => c + 3,
    }
}

/// Step 1: remember last step's forces and clear them.
fn reset(nm: &mut [f32]) {
    for n in (0..nm.len()).step_by(PPN) {
        nm[n + NODE_OLD_DX] = nm[n + NODE_DX];
        nm[n + NODE_OLD_DY] = nm[n + NODE_DY];
        nm[n + NODE_DX] = 0.0;
        nm[n + NODE_DY] = 0.0;
    }
}

/// Step 2: repulsion for node offsets `from..to` (the Barnes-Hut tree always spans every node).
fn repulse(s: &Settings, nm: &mut [f32], regions: &mut Vec<Region>, from: usize, to: usize) {
    let order = nm.len();
    let g = |nm: &[f32], i: usize| nm[i] as f64;
    macro_rules! add {
        ($i:expr, $v:expr) => {{
            let i = $i;
            nm[i] = (nm[i] as f64 + $v) as f32;
        }};
    }

    // 1.bis) Barnes-Hut tree
    if s.barnes_hut_optimize {
        let (mut min_x, mut max_x, mut min_y, mut max_y) =
            (f64::INFINITY, f64::NEG_INFINITY, f64::INFINITY, f64::NEG_INFINITY);
        for n in (0..order).step_by(PPN) {
            min_x = min_x.min(g(nm, n + NODE_X));
            max_x = max_x.max(g(nm, n + NODE_X));
            min_y = min_y.min(g(nm, n + NODE_Y));
            max_y = max_y.max(g(nm, n + NODE_Y));
        }
        let (dx, dy) = (max_x - min_x, max_y - min_y);
        if dx > dy {
            min_y -= (dx - dy) / 2.0;
            max_y = min_y + dx;
        } else {
            min_x -= (dy - dx) / 2.0;
            max_x = min_x + dy;
        }

        regions.clear();
        regions.push(Region::new(
            (min_x + max_x) / 2.0,
            (min_y + max_y) / 2.0,
            (max_x - min_x).max(max_y - min_y),
            -1,
        ));

        for n in (0..order).step_by(PPN) {
            let (nx, ny, nmass) = (g(nm, n + NODE_X), g(nm, n + NODE_Y), g(nm, n + NODE_MASS));
            let mut r = 0usize;
            let mut attempts = SUBDIVISION_ATTEMPTS;

            loop {
                if regions[r].first_child >= 0 {
                    let q = quadrant(&regions[r], nx, ny);
                    let reg = &mut regions[r];
                    reg.mass_center_x = (reg.mass_center_x * reg.mass + nx * nmass) / (reg.mass + nmass);
                    reg.mass_center_y = (reg.mass_center_y * reg.mass + ny * nmass) / (reg.mass + nmass);
                    reg.mass += nmass;
                    r = q;
                    continue;
                }

                if regions[r].node < 0 {
                    regions[r].node = n as isize;
                    break;
                }

                // Split the leaf into four sub-regions
                let first = regions.len();
                let parent = regions[r];
                let w = parent.size / 2.0;
                regions.push(Region::new(parent.center_x - w, parent.center_y - w, w, (first + 1) as isize));
                regions.push(Region::new(parent.center_x - w, parent.center_y + w, w, (first + 2) as isize));
                regions.push(Region::new(parent.center_x + w, parent.center_y - w, w, (first + 3) as isize));
                regions.push(Region::new(parent.center_x + w, parent.center_y + w, w, parent.next_sibling));
                regions[r].first_child = first as isize;

                let old = parent.node as usize;
                let (ox, oy) = (g(nm, old + NODE_X), g(nm, old + NODE_Y));
                let q = quadrant(&regions[r], ox, oy);

                let reg = &mut regions[r];
                reg.mass = g(nm, old + NODE_MASS);
                reg.mass_center_x = ox;
                reg.mass_center_y = oy;
                reg.node = -1;
                regions[q].node = old as isize;

                let q2 = quadrant(&regions[r], nx, ny);
                if q == q2 {
                    if attempts > 0 {
                        attempts -= 1;
                        r = q;
                        continue;
                    }
                    // Out of precision: drop n from the tree, as the JS does
                    break;
                }
                regions[q2].node = n as isize;
                break;
            }
        }
    }

    // 2) Repulsion
    let coefficient = s.scaling_ratio;
    if s.barnes_hut_optimize {
        let theta_squared = s.barnes_hut_theta * s.barnes_hut_theta;
        for n in (from..to).step_by(PPN) {
            let (nx, ny, nmass) = (g(nm, n + NODE_X), g(nm, n + NODE_Y), g(nm, n + NODE_MASS));
            let mut r = 0isize;
            loop {
                let reg = regions[r as usize];
                if reg.first_child >= 0 {
                    let x_dist = nx - reg.mass_center_x;
                    let y_dist = ny - reg.mass_center_y;
                    let distance = x_dist * x_dist + y_dist * y_dist;
                    if (4.0 * reg.size * reg.size) / distance < theta_squared {
                        // distance < 0 (anti-collision branch) is unreachable for a sum of squares
                        if distance > 0.0 {
                            let factor = coefficient * nmass * reg.mass / distance;
                            add!(n + NODE_DX, x_dist * factor);
                            add!(n + NODE_DY, y_dist * factor);
                        }
                        r = reg.next_sibling;
                        if r < 0 {
                            break;
                        }
                    } else {
                        r = reg.first_child;
                    }
                } else {
                    let rn = reg.node;
                    if rn >= 0 && rn as usize != n {
                        let rn = rn as usize;
                        let x_dist = nx - g(nm, rn + NODE_X);
                        let y_dist = ny - g(nm, rn + NODE_Y);
                        let distance = x_dist * x_dist + y_dist * y_dist;
                        if distance > 0.0 {
                            let factor = coefficient * nmass * g(nm, rn + NODE_MASS) / distance;
                            add!(n + NODE_DX, x_dist * factor);
                            add!(n + NODE_DY, y_dist * factor);
                        }
                    }
                    r = reg.next_sibling;
                    if r < 0 {
                        break;
                    }
                }
            }
        }
    } else if from == 0 && to == order {
        for n1 in (0..order).step_by(PPN) {
            for n2 in (0..n1).step_by(PPN) {
                let x_dist = g(nm, n1 + NODE_X) - g(nm, n2 + NODE_X);
                let y_dist = g(nm, n1 + NODE_Y) - g(nm, n2 + NODE_Y);
                // Same multiplication order as the JS, so f64 rounding matches
                let masses = coefficient * g(nm, n1 + NODE_MASS) * g(nm, n2 + NODE_MASS);
                let factor;
                if s.adjust_sizes {
                    let distance = (x_dist * x_dist + y_dist * y_dist).sqrt()
                        - g(nm, n1 + NODE_SIZE)
                        - g(nm, n2 + NODE_SIZE);
                    if distance > 0.0 {
                        factor = masses / distance / distance;
                    } else if distance < 0.0 {
                        factor = 100.0 * masses;
                    } else {
                        continue;
                    }
                } else {
                    let distance = (x_dist * x_dist + y_dist * y_dist).sqrt();
                    if distance > 0.0 {
                        factor = masses / distance / distance;
                    } else {
                        continue;
                    }
                }
                add!(n1 + NODE_DX, x_dist * factor);
                add!(n1 + NODE_DY, y_dist * factor);
                add!(n2 + NODE_DX, -(x_dist * factor));
                add!(n2 + NODE_DY, -(y_dist * factor));
            }
        }
    } else {
        // Slice of a parallel run: each node sums over every other node, touching only itself
        for n1 in (from..to).step_by(PPN) {
            for n2 in (0..order).step_by(PPN) {
                if n1 == n2 {
                    continue;
                }
                let x_dist = g(nm, n1 + NODE_X) - g(nm, n2 + NODE_X);
                let y_dist = g(nm, n1 + NODE_Y) - g(nm, n2 + NODE_Y);
                let masses = coefficient * g(nm, n1 + NODE_MASS) * g(nm, n2 + NODE_MASS);
                let mut distance = (x_dist * x_dist + y_dist * y_dist).sqrt();
                if s.adjust_sizes {
                    distance -= g(nm, n1 + NODE_SIZE) + g(nm, n2 + NODE_SIZE);
                }
                let factor = if distance > 0.0 {
                    masses / distance / distance
                } else if distance < 0.0 && s.adjust_sizes {
                    100.0 * masses
                } else {
                    continue;
                };
                add!(n1 + NODE_DX, x_dist * factor);
                add!(n1 + NODE_DY, y_dist * factor);
            }
        }
    }
}

/// Steps 3-5: gravity, attraction, then move the nodes.
fn finish(s: &Settings, nm: &mut [f32], em: &[f32]) {
    let order = nm.len();
    let size = em.len();
    let g = |nm: &[f32], i: usize| nm[i] as f64;
    macro_rules! add {
        ($i:expr, $v:expr) => {{
            let i = $i;
            nm[i] = (nm[i] as f64 + $v) as f32;
        }};
    }

    // 3) Gravity
    let coefficient = s.scaling_ratio;
    let gr = s.gravity / s.scaling_ratio;
    for n in (0..order).step_by(PPN) {
        let x_dist = g(nm, n + NODE_X);
        let y_dist = g(nm, n + NODE_Y);
        let distance = (x_dist * x_dist + y_dist * y_dist).sqrt();
        let mut factor = 0.0;
        if distance > 0.0 {
            factor = coefficient * g(nm, n + NODE_MASS) * gr;
            if !s.strong_gravity_mode {
                factor /= distance;
            }
        }
        add!(n + NODE_DX, -(x_dist * factor));
        add!(n + NODE_DY, -(y_dist * factor));
    }

    // 4) Attraction
    let mut outbound_att_compensation = 0.0;
    if s.outbound_attraction_distribution {
        for n in (0..order).step_by(PPN) {
            outbound_att_compensation += g(nm, n + NODE_MASS);
        }
        outbound_att_compensation /= (order / PPN) as f64;
    }
    let coefficient = if s.outbound_attraction_distribution { outbound_att_compensation } else { 1.0 };
    for e in (0..size).step_by(PPE) {
        let n1 = em[e] as usize;
        let n2 = em[e + 1] as usize;
        let ewc = (em[e + 2] as f64).powf(s.edge_weight_influence);
        let x_dist = g(nm, n1 + NODE_X) - g(nm, n2 + NODE_X);
        let y_dist = g(nm, n1 + NODE_Y) - g(nm, n2 + NODE_Y);
        let n1_mass = g(nm, n1 + NODE_MASS);

        let mut distance = (x_dist * x_dist + y_dist * y_dist).sqrt();
        if s.adjust_sizes {
            distance -= g(nm, n1 + NODE_SIZE) + g(nm, n2 + NODE_SIZE);
        } else if !s.lin_log_mode {
            distance = 1.0; // linear attraction ignores distance
        }
        if distance <= 0.0 {
            continue;
        }

        let mut factor = -coefficient * ewc;
        if s.lin_log_mode {
            factor = factor * (1.0 + distance).ln() / distance;
        }
        if s.outbound_attraction_distribution {
            factor /= n1_mass;
        }

        add!(n1 + NODE_DX, x_dist * factor);
        add!(n1 + NODE_DY, y_dist * factor);
        add!(n2 + NODE_DX, -(x_dist * factor));
        add!(n2 + NODE_DY, -(y_dist * factor));
    }

    // 5) Apply forces
    for n in (0..order).step_by(PPN) {
        if nm[n + NODE_FIXED] == 1.0 {
            continue;
        }
        if s.adjust_sizes {
            let force = (g(nm, n + NODE_DX).powi(2) + g(nm, n + NODE_DY).powi(2)).sqrt();
            if force > MAX_FORCE {
                nm[n + NODE_DX] = (g(nm, n + NODE_DX) * MAX_FORCE / force) as f32;
                nm[n + NODE_DY] = (g(nm, n + NODE_DY) * MAX_FORCE / force) as f32;
            }
        }
        let (dx, dy) = (g(nm, n + NODE_DX), g(nm, n + NODE_DY));
        let (odx, ody) = (g(nm, n + NODE_OLD_DX), g(nm, n + NODE_OLD_DY));
        let swinging = g(nm, n + NODE_MASS) * ((odx - dx) * (odx - dx) + (ody - dy) * (ody - dy)).sqrt();
        let traction = ((odx + dx) * (odx + dx) + (ody + dy) * (ody + dy)).sqrt() / 2.0;

        let nodespeed = if s.adjust_sizes {
            0.1 * (1.0 + traction).ln() / (1.0 + swinging.sqrt())
        } else {
            let sp = g(nm, n + NODE_CONVERGENCE) * (1.0 + traction).ln() / (1.0 + swinging.sqrt());
            nm[n + NODE_CONVERGENCE] =
                (sp * (dx * dx + dy * dy) / (1.0 + swinging.sqrt())).sqrt().min(1.0) as f32;
            sp
        };

        nm[n + NODE_X] = (g(nm, n + NODE_X) + dx * (nodespeed / s.slow_down)) as f32;
        nm[n + NODE_Y] = (g(nm, n + NODE_Y) + dy * (nodespeed / s.slow_down)) as f32;
    }
}

fn iterate(s: &Settings, nm: &mut [f32], em: &[f32], regions: &mut Vec<Region>) {
    reset(nm);
    repulse(s, nm, regions, 0, nm.len());
    finish(s, nm, em);
}

// ---- WASM exports -----------------------------------------------------------
// JS writes into buffers owned here, sets the settings once, then drives either
// `fa2_iterate` (single thread) or `fa2_reset` → `fa2_repulse` slices → `fa2_finish`.
// SAFETY (all `unsafe` below): each wasm instance runs on one thread; nothing else
// touches these statics.

static mut NODES: Vec<f32> = Vec::new();
static mut EDGES: Vec<f32> = Vec::new();
static mut REGIONS: Vec<Region> = Vec::new();
static mut SETTINGS: Settings = Settings {
    adjust_sizes: false,
    barnes_hut_optimize: false,
    barnes_hut_theta: 0.5,
    scaling_ratio: 1.0,
    gravity: 1.0,
    strong_gravity_mode: false,
    lin_log_mode: false,
    outbound_attraction_distribution: false,
    edge_weight_influence: 1.0,
    slow_down: 1.0,
};

fn resize(v: &mut Vec<f32>, len: usize) -> *mut f32 {
    v.resize(len, 0.0);
    v.as_mut_ptr()
}

/// Resizes the node buffer to `len` floats and returns its address.
#[no_mangle]
pub extern "C" fn fa2_nodes(len: usize) -> *mut f32 {
    unsafe { resize(&mut *std::ptr::addr_of_mut!(NODES), len) }
}

/// Resizes the edge buffer to `len` floats and returns its address.
#[no_mangle]
pub extern "C" fn fa2_edges(len: usize) -> *mut f32 {
    unsafe { resize(&mut *std::ptr::addr_of_mut!(EDGES), len) }
}

#[no_mangle]
pub extern "C" fn fa2_settings(
    adjust_sizes: u32,
    barnes_hut_optimize: u32,
    barnes_hut_theta: f64,
    scaling_ratio: f64,
    gravity: f64,
    strong_gravity_mode: u32,
    lin_log_mode: u32,
    outbound_attraction_distribution: u32,
    edge_weight_influence: f64,
    slow_down: f64,
) {
    unsafe {
        SETTINGS = Settings {
            adjust_sizes: adjust_sizes != 0,
            barnes_hut_optimize: barnes_hut_optimize != 0,
            barnes_hut_theta,
            scaling_ratio,
            gravity,
            strong_gravity_mode: strong_gravity_mode != 0,
            lin_log_mode: lin_log_mode != 0,
            outbound_attraction_distribution: outbound_attraction_distribution != 0,
            edge_weight_influence,
            slow_down,
        };
    }
}

#[no_mangle]
pub extern "C" fn fa2_iterate(iterations: u32) {
    unsafe {
        let s = &*std::ptr::addr_of!(SETTINGS);
        let nm = &mut *std::ptr::addr_of_mut!(NODES);
        let em = &*std::ptr::addr_of!(EDGES);
        let regions = &mut *std::ptr::addr_of_mut!(REGIONS);
        for _ in 0..iterations {
            iterate(s, nm, em, regions);
        }
    }
}

#[no_mangle]
pub extern "C" fn fa2_reset() {
    unsafe { reset(&mut *std::ptr::addr_of_mut!(NODES)) }
}

/// Repulsion for nodes `from..to` (node indices). Only their dx/dy are written, from zero.
#[no_mangle]
pub extern "C" fn fa2_repulse(from: usize, to: usize) {
    unsafe {
        let nm = &mut *std::ptr::addr_of_mut!(NODES);
        for n in (from * PPN..to * PPN).step_by(PPN) {
            nm[n + NODE_DX] = 0.0;
            nm[n + NODE_DY] = 0.0;
        }
        let s = &*std::ptr::addr_of!(SETTINGS);
        repulse(s, nm, &mut *std::ptr::addr_of_mut!(REGIONS), from * PPN, to * PPN);
    }
}

#[no_mangle]
pub extern "C" fn fa2_finish() {
    unsafe {
        let s = &*std::ptr::addr_of!(SETTINGS);
        finish(s, &mut *std::ptr::addr_of_mut!(NODES), &*std::ptr::addr_of!(EDGES));
    }
}
