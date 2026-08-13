// Colors shared by the agent marker overlay, the agent panel and the bus
// diagram, so the same thing reads the same way wherever it appears.
//
// The agent/bus/device hues come from the GridAPPS-D distributed-architecture
// diagram this view reproduces — a green coordinating agent, orange distributed
// agents, purple field devices on pale-yellow message buses. They are held at
// the same value in both themes because they are categorical: recoloring them
// per theme would make a dark-mode screenshot and a light-mode one look like
// they described different systems. Only the surfaces and text around them
// change.

export const STATUS_COLORS = {
    online: "#45AB48", // the app's green accent
    offline: "#cf3b3b",
    unknown: "#8c8c8c",
};

// Fills for the boxes in the bus diagram, keyed by what the box is.
export const NODE_COLORS = {
    coordinating: "#8DC63F",
    distributed: "#F5A25D",
    device: "#C89BD9",
    bus: "#F5E9A8",
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
