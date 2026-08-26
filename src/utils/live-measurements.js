const PHASE_ORDER = ["A", "B", "C", "s1", "s2", "s12", "N"];

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

export const formatVoltageLines = (voltage) => {
    if (!voltage) return [];
    return orderedKeys(voltage).map((ph) => {
        const mag = Number(voltage[ph]?.magnitude);
        return `${ph} ${Number.isFinite(mag) ? mag.toFixed(1) : "-"} V`;
    });
};

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
