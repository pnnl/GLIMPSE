const TEXT_COLOR = "#000000";

/**
 * This function draw in the input canvas 2D context a rectangle.
 * It only deals with tracing the path, and does not fill or stroke.
 */
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

/**
 * Custom hover renderer
 */
export function drawHover(context, data, settings) {
   const size = settings.labelSize + 5;
   const font = settings.labelFont;
   const weight = settings.labelWeight;
   const objectTypeLabelSize = size - 2;

   const idLabel = data.label;
   const objectTypeLabel = data.group;
   const attributesLabel = data.attributesLabel;

   // Then we draw the label background
   context.beginPath();
   context.fillStyle = "#fff";
   context.shadowOffsetX = 0;
   context.shadowOffsetY = 2;
   context.shadowBlur = 8;
   context.shadowColor = "#000";

   context.font = `${weight} ${size}px ${font}`;
   const idLabelWidth = context.measureText(idLabel).width;
   context.font = `${weight} ${objectTypeLabelSize}px ${font}`;
   const objectTypeLabelWidth = objectTypeLabel ? context.measureText(objectTypeLabel).width : 0;
   context.font = `${weight} ${objectTypeLabelSize}px ${font}`;
   // Support multi-line attributes label
   const attributesLines = attributesLabel ? String(attributesLabel).split(/\r?\n/) : [];
   let attributesLabelWidth = 0;
   for (const line of attributesLines) {
      const w = context.measureText(line).width;
      if (w > attributesLabelWidth) attributesLabelWidth = w;
   }

   const textWidth = Math.max(idLabelWidth, objectTypeLabelWidth, attributesLabelWidth);

   const x = Math.round(data.x);
   const y = Math.round(data.y);
   const w = Math.round(textWidth + size / 2 + data.size + 3);
   const hIDLabel = Math.round(size);
   const hObjectTypeLabel = objectTypeLabel ? Math.round(objectTypeLabelSize / 2 + 9) : 0;
   const lineHeight = Math.round(objectTypeLabelSize + 4);
   const hAttributesLabel =
      attributesLines.length > 0
         ? attributesLines.length * lineHeight
         : Math.round(objectTypeLabelSize / 2 + 9);

   drawRoundRect(
      context,
      x,
      y - hObjectTypeLabel - 12,
      w,
      hAttributesLabel + hIDLabel + hObjectTypeLabel + 12,
      5
   );
   context.closePath();
   context.fill();

   context.shadowOffsetX = 0;
   context.shadowOffsetY = 0;
   context.shadowBlur = 0;

   // And finally we draw the labels
   context.fillStyle = TEXT_COLOR;
   context.font = `${weight} ${size}px ${font}`;
   context.fillText(idLabel, data.x + data.size + 3, data.y + size / 3);

   if (objectTypeLabel) {
      context.fillStyle = TEXT_COLOR;
      context.font = `${weight} ${objectTypeLabelSize}px ${font}`;
      context.fillText(objectTypeLabel, data.x + data.size + 3, data.y - (2 * size) / 3 - 2);
   }

   // Draw each attributes line stacked below the id label
   context.fillStyle = data.color;
   context.font = `${weight} ${objectTypeLabelSize}px ${font}`;
   const startY = data.y + size / 3 + 3 + objectTypeLabelSize;
   for (let i = 0; i < attributesLines.length; i++) {
      const line = attributesLines[i];
      context.fillText(line, data.x + data.size + 3, startY + i * lineHeight);
   }
}

/**
 * Custom label renderer
 */
export function drawLabel(context, data, settings) {
   if (!data.label) return;
   const size = settings.labelSize;
   const font = settings.labelFont;
   const weight = settings.labelWeight;

   const text = String(data.label);
   // Support multi-line labels separated by \n
   const lines = text.split(/\r?\n/);
   context.font = `${weight} ${size}px ${font}`;

   // Padding around the text in the background rect
   const paddingX = 6;
   const paddingY = 4;

   // Compute max width across lines
   let maxWidth = 0;
   for (const line of lines) {
      const w = context.measureText(line).width;
      if (w > maxWidth) maxWidth = w;
   }

   const rectWidth = Math.ceil(maxWidth + paddingX * 2);
   // lineHeight: a small multiplier of font size to space lines nicely
   const lineHeight = Math.ceil(size * 1.2);
   const rectHeight = Math.ceil(lines.length * lineHeight + paddingY * 2);

   // Position the label centered under the node
   const centerX = Math.round(data.x);
   const topY = Math.round(data.y + data.size + 6); // 6px spacing below node

   // Draw background rectangle centered under the node
   context.textAlign = "center";
   context.textBaseline = "top";
   context.fillStyle = "#ffffffcc";
   context.fillRect(centerX - rectWidth / 2, topY, rectWidth, rectHeight);

   // Draw each line centered
   context.fillStyle = "#000";
   for (let i = 0; i < lines.length; i++) {
      const line = String(lines[i]);
      const yLine = topY + paddingY + i * lineHeight;
      context.fillText(line, centerX, yLine);
   }

   // Restore defaults in case other renderers rely on them
   context.textAlign = "left";
   context.textBaseline = "alphabetic";
}

export function drawShadow(context, data, settings) {
   // Draw a subtle halo + outline under a node for hover emphasis
   const x = Math.round(data.x || 0);
   const y = Math.round(data.y || 0);
   const nodeSize =
      typeof data.size === "number"
         ? data.size
         : settings && settings.labelSize
         ? settings.labelSize
         : 8;

   // Radii
   const outerRadius = nodeSize + 3; // halo radius
   context.save();

   // Halo (soft shadow)
   context.beginPath();
   context.arc(x, y, outerRadius, 0, Math.PI * 2);
   context.fillStyle = "rgba(0,0,0,0.12)";
   context.shadowColor = "rgba(0,0,0,0.45)";
   context.shadowBlur = 6;
   context.fill();

   context.restore();
}
