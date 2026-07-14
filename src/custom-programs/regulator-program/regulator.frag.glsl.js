// language=GLSL
const SHADER_SOURCE = /*glsl*/ `
precision mediump float;

varying vec4 v_color;
varying vec2 v_corner;
varying float v_size;

// highp to match the vertex shader's default float precision (uniforms must
// have the same precision in both stages, or program linking fails).
uniform highp float u_sizeRatio;

const vec4 transparent = vec4(0.0, 0.0, 0.0, 0.0);

// Distance from point p to the line segment a-b.
float segmentDistance(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

void main(void) {
  // Local icon space: v_corner is in [-1, 1] on both axes,
  // x along the edge, y across it.
  vec2 p = v_corner;

  // --- Two overlapping windings (IEEE adjustable transformer) ---
  const float windingRadius = 0.40;
  const float windingThickness = 0.065;
  vec2 primaryCenter = vec2(-0.27, 0.0);
  vec2 secondaryCenter = vec2(0.27, 0.0);

  // abs(distToCircle - radius) gives the ring outline; subtract the stroke
  // half-thickness so the value is negative inside the stroke.
  float dPrimary = abs(length(p - primaryCenter) - windingRadius) - windingThickness;
  float dSecondary = abs(length(p - secondaryCenter) - windingRadius) - windingThickness;

  // --- Diagonal tap-changer arrow (adjustable / regulating) ---
  const float lineThickness = 0.06;
  vec2 tail = vec2(-0.50, -0.42);
  vec2 tip = vec2(0.52, 0.42);
  float dShaft = segmentDistance(p, tail, tip) - lineThickness;

  // Arrowhead barbs splayed back from the tip.
  vec2 back = -normalize(tip - tail);
  const float c = 0.883; // cos(28 deg)
  const float s = 0.469; // sin(28 deg)
  vec2 barbA = tip + 0.22 * vec2(back.x * c - back.y * s, back.x * s + back.y * c);
  vec2 barbB = tip + 0.22 * vec2(back.x * c + back.y * s, -back.x * s + back.y * c);
  float dBarbA = segmentDistance(p, tip, barbA) - lineThickness;
  float dBarbB = segmentDistance(p, tip, barbB) - lineThickness;

  // Nearest stroke surface (negative => inside a stroke).
  float d = min(min(dPrimary, dSecondary), min(dShaft, min(dBarbA, dBarbB)));

  // Screen-space anti-aliasing: 1 local unit == (v_size) screen px, so this keeps
  // the edge feather ~1px crisp at any zoom (same idea as sigma's correctionRatio).
  float aa = clamp(u_sizeRatio / v_size, 0.004, 0.06);

#ifdef PICKING_MODE
  // Whole quad is pickable so the regulator stays easy to select, like switches.
  gl_FragColor = v_color;
#else
  float alpha = 1.0 - smoothstep(-aa, aa, d);
  if (alpha <= 0.0) discard;
  gl_FragColor = mix(transparent, v_color, alpha);
  // Sigma blends premultiplied (gl.ONE, gl.ONE_MINUS_SRC_ALPHA), so the RGB must
  // also be scaled by the (zoom-faded) v_color.a. Without this the color leaks /
  // brightens toward white at full view instead of fading out as alpha -> 0.
  gl_FragColor.rgb *= v_color.a;
#endif
}
`;

export default SHADER_SOURCE;
