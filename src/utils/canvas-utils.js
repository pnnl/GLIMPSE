import { buildHoverAttributes } from "./hover-attributes";

let _isDark = false;
export const setCanvasDarkMode = (val) => {
    _isDark = val;
};

// ── Global Style Constants ──────────────────────────────────────────────────
// Change these to adjust colors across ALL renderers at once.
export const textColor = () => (_isDark ? "#ffffff" : "#000000");
export const hoverBackgroundColor = () => (_isDark ? "#1f1f1f" : "#ffffff");
export const labelBackgroundColor = () => (_isDark ? "#1f1f1fcc" : "#ffffffcc");

// ── Hover Card Layout ───────────────────────────────────────────────────────
export const LABEL_SIZE = 13;
const CARD_FONT = "Arial, sans-serif";
const CARD_FONT_SIZE = LABEL_SIZE + 3;
const CARD_LINE_HEIGHT = CARD_FONT_SIZE + 4;
const CARD_PADDING_X = 4;

const cardFont = (bold) => `${bold ? "bold" : "normal"} ${CARD_FONT_SIZE}px ${CARD_FONT}`;
const measureContext = document.createElement("canvas").getContext("2d");

/**
 * Sigma label attachment drawn under a hovered/focused node's label: its group,
 * the live vitals (severity-colored), the model attributes and a truncation hint.
 * Built only when sigma asks for it; the card background and the name are
 * sigma's own backdrop and label.
 *
 * @param {Object} ctx - sigma's LabelAttachmentContext
 * @param {Array<{text: string, color?: string}>} vitals - from graphHelper.getNodeVitals
 */
export function nodeCard({ attributes, pixelRatio }, vitals) {
    const { lines: attributeLines, hidden: hiddenCount } = buildHoverAttributes(attributes.attributes);

    const rows = [
        ...(attributes.group ? [{ text: attributes.group }] : []),
        // Bold and severity-colored so a violation reads at a glance.
        ...vitals.map((vital) => ({ text: vital.text, color: vital.color, bold: true })),
        // The node's own color ties the list to the node.
        ...attributeLines.map((text, i) => ({
            text,
            color: attributes.color,
            ruleAbove: i === 0 && vitals.length > 0, // separates live readings from the model
        })),
        ...(hiddenCount > 0
            ? [{ text: `+${hiddenCount} more — see Model Data View`, alpha: 0.55 }]
            : []),
    ];
    if (rows.length === 0) return null;

    let width = 0;
    for (const row of rows) {
        measureContext.font = cardFont(row.bold);
        width = Math.max(width, measureContext.measureText(row.text).width);
    }
    width = Math.ceil(width) + CARD_PADDING_X * 2;
    const ruleHeight = CARD_LINE_HEIGHT / 2;
    const height = rows.reduce((sum, row) => sum + CARD_LINE_HEIGHT + (row.ruleAbove ? ruleHeight : 0), 0);

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * pixelRatio);
    canvas.height = Math.ceil(height * pixelRatio);
    const context = canvas.getContext("2d");
    context.scale(pixelRatio, pixelRatio);
    context.textBaseline = "middle";

    let y = 0;
    for (const row of rows) {
        if (row.ruleAbove) {
            const ruleY = Math.round(y + ruleHeight / 2) + 0.5;
            context.globalAlpha = 0.18;
            context.strokeStyle = textColor();
            context.beginPath();
            context.moveTo(CARD_PADDING_X, ruleY);
            context.lineTo(width - CARD_PADDING_X, ruleY);
            context.stroke();
            y += ruleHeight;
        }

        context.globalAlpha = row.alpha ?? 1;
        context.fillStyle = row.color ?? textColor();
        context.font = cardFont(row.bold);
        context.fillText(row.text, CARD_PADDING_X, y + CARD_LINE_HEIGHT / 2);
        y += CARD_LINE_HEIGHT;
    }

    return { type: "canvas", canvas };
}
