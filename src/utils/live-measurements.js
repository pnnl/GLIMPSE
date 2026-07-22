// Pure formatting helpers for the live GridAPPS-D measurement overlay: voltage
// on bus nodes (PNV) and power flow on edges (VA). These values are display-only
// — they live in graphHelper.liveMeasurements, are never written into a model's
// own attributes, and are cleared when the simulation ends.
//
// Kept dependency-free (no React, no socket client) so graphHelper can import
// them without creating an import cycle; the React hook lives separately in
// src/hooks/useSimLiveTick.js.

// Stable phase ordering so A/B/C (and split-phase s1/s2) always render in the
// same sequence regardless of the order measurements arrive in.
const PHASE_ORDER = ["A", "B", "C", "s1", "s2", "s12", "N"];

/**
 * Normalize a CIM phase string. GridAPPS-D may send "A", "PhaseCode.A", "s1",
 * etc.; keep just the trailing token and fall back to a dash when absent.
 */
export const cleanPhase = (phases) => {
    if (phases === null || phases === undefined || phases === "") return "-";
    const s = String(phases);
    const token = s.includes(".") ? s.split(".").pop() : s;
    return token || "-";
};

const orderedKeys = (obj) =>
    Object.keys(obj).sort((a, b) => {
        const ia = PHASE_ORDER.indexOf(a);
        const ib = PHASE_ORDER.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
    });

/**
 * ["A 2401.3 V", "B 2398.0 V", ...] from a per-phase voltage overlay entry.
 */
export const formatVoltageLines = (voltage) => {
    if (!voltage) return [];
    return orderedKeys(voltage).map((ph) => {
        const mag = Number(voltage[ph]?.magnitude);
        return `${ph} ${Number.isFinite(mag) ? mag.toFixed(1) : "-"} V`;
    });
};

/**
 * ["A 12.30 kW, 4.50 kVAR", ...] from a per-phase power overlay entry.
 * Real/imaginary parts are in VA, converted to kW / kVAR for display.
 */
export const formatPowerLines = (power) => {
    if (!power) return [];
    return orderedKeys(power).map((ph) => {
        const real = Number(power[ph]?.real) / 1000;
        const imag = Number(power[ph]?.imag) / 1000;
        const r = Number.isFinite(real) ? real.toFixed(2) : "-";
        const x = Number.isFinite(imag) ? imag.toFixed(2) : "-";
        return `${ph} ${r} kW, ${x} kVAR`;
    });
};
