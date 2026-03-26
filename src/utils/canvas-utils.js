// ============================================================================
// canvas-utils.js — Custom Sigma.js canvas renderers for node labels,
// hover tooltips, and shadow/halo effects.
// ============================================================================

// ── Global Style Constants ──────────────────────────────────────────────────
// Change these to adjust colors across ALL renderers at once.
const TEXT_COLOR = "#000000"; // Main text color for labels & hover
const HOVER_BG_COLOR = "#fff"; // Hover tooltip background
const HOVER_SHADOW_COLOR = "#000"; // Hover tooltip drop-shadow color
const LABEL_BG_COLOR = "#ffffffcc"; // Label background (with alpha for translucency)
const LABEL_TEXT_COLOR = "#000"; // Label text drawn under each node

// ── Hover Tooltip Layout ────────────────────────────────────────────────────
// These control spacing inside the hover card that appears on node hover.
const HOVER_LABEL_SIZE_BOOST = 5; // Added to settings.labelSize for the main id text
const HOVER_OBJECT_TYPE_SIZE_OFFSET = 2; // Subtracted from boosted size for the "group" subtitle
const HOVER_CORNER_RADIUS = 5; // Border radius of the hover rounded rect
const HOVER_SHADOW_OFFSET_X = 0;
const HOVER_SHADOW_OFFSET_Y = 2;
const HOVER_SHADOW_BLUR = 8;
const HOVER_VERTICAL_PADDING = 12; // Top padding above the object-type label in the card

// ── Node Label Layout ───────────────────────────────────────────────────────
// These control the small persistent label rendered below each node.
const LABEL_PADDING_X = 6; // Horizontal padding around label background
const LABEL_PADDING_Y = 4; // Vertical padding around label background
const LABEL_LINE_HEIGHT_MULTIPLIER = 1.2; // Multiplied by font size to get line spacing
const LABEL_NODE_SPACING = 6; // Pixels between the bottom of the node circle and the label

// ── Shadow / Halo ───────────────────────────────────────────────────────────
// These control the subtle halo drawn behind a hovered node.
const SHADOW_HALO_EXTRA_RADIUS = 3; // Extra pixels beyond node radius for the halo
const SHADOW_HALO_FILL = "rgba(0,0,0,0.12)"; // Halo fill color & opacity
const SHADOW_HALO_SHADOW_COLOR = "rgba(0,0,0,0.45)";
const SHADOW_HALO_BLUR = 6;

// ============================================================================
// drawRoundRect — Traces a rounded-corner rectangle path (does NOT fill/stroke)
// ============================================================================
// Use this as a building block: call it, then context.fill() or context.stroke()
// yourself. Adjust `radius` to make corners sharper (0) or rounder.
//
// Parameters:
//   ctx    – CanvasRenderingContext2D
//   x, y   – top-left corner
//   width  – rectangle width
//   height – rectangle height
//   radius – corner radius (px)
// ============================================================================
export function drawRoundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

// ============================================================================
// drawHover — Renders the tooltip card when the user hovers over a node.
// ============================================================================
// The card shows up to THREE text sections stacked vertically:
//   1. Object type label (group name) — top, smaller font
//   2. ID label (node label / name)   — middle, larger font
//   3. Attributes label               — bottom, smaller font, multi-line
//
// DATA CONTRACT (properties read from `data`):
//   data.label           – primary display name (string)
//   data.group           – object type / category (string, optional)
//   data.attributesLabel – extra info, supports "\n" for multiple lines (string, optional)
//   data.x, data.y       – node center in canvas coords
//   data.size             – node rendered radius
//   data.color            – node color (used for attributes text)
//
// TO CUSTOMIZE:
//   • Card background  → change HOVER_BG_COLOR
//   • Drop shadow      → change HOVER_SHADOW_* constants
//   • Font sizes       → change HOVER_LABEL_SIZE_BOOST / HOVER_OBJECT_TYPE_SIZE_OFFSET
//   • Corner roundness → change HOVER_CORNER_RADIUS
//   • Spacing          → change HOVER_VERTICAL_PADDING
// ============================================================================
export function drawHover(context, data, settings) {
    // ── Derive font sizes from sigma settings ──
    const idLabelSize = settings.labelSize + HOVER_LABEL_SIZE_BOOST;
    const objectTypeLabelSize = idLabelSize - HOVER_OBJECT_TYPE_SIZE_OFFSET;
    const font = settings.labelFont;
    const weight = settings.labelWeight;

    // ── Extract text content ──
    const idLabel = data.label;
    const objectTypeLabel = data.group; // may be undefined/null
    const attributesLines = data.attributesLabel ? String(data.attributesLabel).split(/\r?\n/) : [];

    // ── Measure text widths to size the background card ──
    context.font = `${weight} ${idLabelSize}px ${font}`;
    const idLabelWidth = context.measureText(idLabel).width;

    context.font = `${weight} ${objectTypeLabelSize}px ${font}`;
    const objectTypeLabelWidth = objectTypeLabel ? context.measureText(objectTypeLabel).width : 0;

    let attributesMaxWidth = 0;
    for (const line of attributesLines) {
        const w = context.measureText(line).width;
        if (w > attributesMaxWidth) attributesMaxWidth = w;
    }

    const textWidth = Math.max(idLabelWidth, objectTypeLabelWidth, attributesMaxWidth);

    // ── Compute card dimensions ──
    // Tweak these formulas to adjust card sizing relative to the node.
    const x = Math.round(data.x);
    const y = Math.round(data.y);
    const cardWidth = Math.round(textWidth + idLabelSize / 2 + data.size + 3);

    const idLabelHeight = Math.round(idLabelSize); // height reserved for the id text
    const objectTypeLabelHeight = objectTypeLabel ? Math.round(objectTypeLabelSize / 2 + 9) : 0;

    // Line height for multi-line attributes
    // ➤ To increase line spacing, increase the "+ 4" value below.
    const lineHeight = Math.round(objectTypeLabelSize + 4);

    const attributesBlockHeight =
        attributesLines.length > 0
            ? attributesLines.length * lineHeight
            : Math.round(objectTypeLabelSize / 2 + 9);

    const cardHeight =
        attributesBlockHeight + idLabelHeight + objectTypeLabelHeight + HOVER_VERTICAL_PADDING;

    // ── Draw background card with shadow ──
    context.beginPath();
    context.fillStyle = HOVER_BG_COLOR;
    context.shadowOffsetX = HOVER_SHADOW_OFFSET_X;
    context.shadowOffsetY = HOVER_SHADOW_OFFSET_Y;
    context.shadowBlur = HOVER_SHADOW_BLUR;
    context.shadowColor = HOVER_SHADOW_COLOR;

    drawRoundRect(
        context,
        x,
        y - objectTypeLabelHeight - HOVER_VERTICAL_PADDING,
        cardWidth,
        cardHeight,
        HOVER_CORNER_RADIUS,
    );
    context.closePath();
    context.fill();

    // Reset shadow so it doesn't bleed into text
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;
    context.shadowBlur = 0;

    // ── Draw the ID label (main name) ──
    // Positioned to the right of the node circle.
    // ➤ To move text further from the node, increase the "+ 3" offset.
    const textStartX = data.x + data.size + 3;

    context.fillStyle = TEXT_COLOR;
    context.font = `${weight} ${idLabelSize}px ${font}`;
    context.fillText(idLabel, textStartX, data.y + idLabelSize / 3);

    // ── Draw the object-type label (group subtitle) ──
    // Sits above the ID label. Only drawn if `data.group` is truthy.
    if (objectTypeLabel) {
        context.fillStyle = TEXT_COLOR;
        context.font = `${weight} ${objectTypeLabelSize}px ${font}`;
        context.fillText(objectTypeLabel, textStartX, data.y - (2 * idLabelSize) / 3 - 2);
    }

    // ── Draw attributes lines (stacked below the ID label) ──
    // Uses the node's own color so it visually ties to the node.
    // ➤ To use a fixed color instead, replace `data.color` with a constant.
    context.fillStyle = data.color;
    context.font = `${weight} ${objectTypeLabelSize}px ${font}`;

    const attributesStartY = data.y + idLabelSize / 3 + 3 + objectTypeLabelSize;
    for (let i = 0; i < attributesLines.length; i++) {
        context.fillText(attributesLines[i], textStartX, attributesStartY + i * lineHeight);
    }
}

// ============================================================================
// drawLabel — Renders the persistent label beneath each visible node.
// ============================================================================
// Sigma calls this for every node whose label should be shown (based on
// labelDensity, labelRenderedSizeThreshold, etc. in your sigma settings).
//
// Labels support multi-line text: embed "\n" in `data.label`.
// A semi-transparent background rect is drawn behind the text for readability.
//
// DATA CONTRACT:
//   data.label – text to display (string, supports "\n")
//   data.x, data.y – node center
//   data.size       – node rendered radius
//
// TO CUSTOMIZE:
//   • Background color / opacity → LABEL_BG_COLOR
//   • Text color                 → LABEL_TEXT_COLOR
//   • Padding                    → LABEL_PADDING_X, LABEL_PADDING_Y
//   • Gap below node             → LABEL_NODE_SPACING
//   • Line spacing               → LABEL_LINE_HEIGHT_MULTIPLIER
// ============================================================================
export function drawLabel(context, data, settings) {
    if (!data.label) return;

    const size = settings.labelSize;
    const font = settings.labelFont;
    const weight = settings.labelWeight;

    const text = String(data.label);
    const lines = text.split(/\r?\n/);

    context.font = `${weight} ${size}px ${font}`;

    // ── Measure all lines to find the widest ──
    let maxWidth = 0;
    for (const line of lines) {
        const w = context.measureText(line).width;
        if (w > maxWidth) maxWidth = w;
    }

    // ── Background rectangle dimensions ──
    const rectWidth = Math.ceil(maxWidth + LABEL_PADDING_X * 2);
    const lineHeight = Math.ceil(size * LABEL_LINE_HEIGHT_MULTIPLIER);
    const rectHeight = Math.ceil(lines.length * lineHeight + LABEL_PADDING_Y * 2);

    // ── Position: centered horizontally, just below the node ──
    const centerX = Math.round(data.x);
    const topY = Math.round(data.y + data.size + LABEL_NODE_SPACING);

    // ── Draw background ──
    context.textAlign = "center";
    context.textBaseline = "top";
    context.fillStyle = LABEL_BG_COLOR;
    context.fillRect(centerX - rectWidth / 2, topY, rectWidth, rectHeight);

    // ── Draw each text line ──
    context.fillStyle = LABEL_TEXT_COLOR;
    for (let i = 0; i < lines.length; i++) {
        const line = String(lines[i]);
        const yLine = topY + LABEL_PADDING_Y + i * lineHeight;
        context.fillText(line, centerX, yLine);
    }

    // ── Restore canvas defaults ──
    // Other sigma renderers may expect these defaults.
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
}

// ============================================================================
// drawShadow — Draws a soft halo / outline behind a node on hover.
// ============================================================================
// Called by sigma when a node is hovered. Gives the node a "glow" effect
// to make it stand out.
//
// TO CUSTOMIZE:
//   • Halo size    → SHADOW_HALO_EXTRA_RADIUS (px beyond the node edge)
//   • Halo opacity → SHADOW_HALO_FILL  (rgba string)
//   • Blur amount  → SHADOW_HALO_BLUR
//   • Shadow color → SHADOW_HALO_SHADOW_COLOR
// ============================================================================
export function drawShadow(context, data, settings) {
    const x = Math.round(data.x || 0);
    const y = Math.round(data.y || 0);

    // Determine the node's visual radius; fall back to labelSize or a default.
    const nodeSize = typeof data.size === "number" ? data.size : (settings?.labelSize ?? 8);

    const outerRadius = nodeSize + SHADOW_HALO_EXTRA_RADIUS;

    context.save();

    // Draw halo circle with soft shadow
    context.beginPath();
    context.arc(x, y, outerRadius, 0, Math.PI * 2);
    context.fillStyle = SHADOW_HALO_FILL;
    context.shadowColor = SHADOW_HALO_SHADOW_COLOR;
    context.shadowBlur = SHADOW_HALO_BLUR;
    context.fill();

    context.restore();
}
