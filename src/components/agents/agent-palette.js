// Colors shared by the agent marker overlay, the agent panel and the bus
// diagram, so the same thing reads the same way wherever it appears.
//
// The agent/bus/device hues follow the GridAPPS-D distributed-architecture
// diagram this view reproduces — a green coordinating agent, purple field
// devices — but the distributed-agent orange and pale-yellow bus have been
// re-picked: against the green they sat only ΔE 5 apart under simulated
// red-green color vision deficiency, which is well inside the range where two
// fills read as the same color. The replacements hold every pair at ΔE 17 or
// better under protanopia, deuteranopia and tritanopia while staying light
// enough for dark label text.
//
// They are held at the same value in both themes because they are categorical:
// recoloring them per theme would make a dark-mode screenshot and a light-mode
// one look like they described different systems. Only the surfaces and text
// around them change.

// Status keeps the IEC 60073 reading — green is normal, red is a fault — but
// pushes green toward teal and red toward orange, which is what separates them
// for a red-green deficient viewer. Plain green/red sat at ΔE 10; these sit at
// ΔE 15.6 against each other and against "unknown".
export const STATUS_COLORS = {
    online: "#1F9E6E",
    offline: "#E04A1F",
    unknown: "#8C9296",
};

// Fills for the boxes in the bus diagram, keyed by what the box is.
export const NODE_COLORS = {
    coordinating: "#8DC63F",
    distributed: "#F2938A",
    device: "#C89BD9",
    bus: "#CDEDE2",
};

// Outlines. One dark stroke keeps every box legible over either surface.
export const STROKE = "#4a4a4a";

/** Surfaces and text for whichever theme is active. */
export const surfaceFor = (darkMode) =>
    darkMode
        ? {
              bg: "#1f1f1f",
              panelBg: "rgba(31,31,31,0.92)",
              text: "#e0e0e0",
              sub: "#8c8c8c",
              border: "#3a3a3a",
              hover: "#2c2c2c",
          }
        : {
              bg: "#ffffff",
              panelBg: "rgba(255,255,255,0.92)",
              text: "#1f1f1f",
              sub: "#8c8c8c",
              border: "#e0e0e0",
              hover: "#f0f0f0",
          };
