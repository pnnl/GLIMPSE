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

void main(void) {
  // Local icon space: v_corner is in [-1, 1] on both axes,
  // x along the edge, y across it.
  vec2 p = v_corner;

  // --- Two overlapping windings (IEEE transformer, no tap-changer arrow) ---
  const float windingRadius = 0.40;
  const float windingThickness = 0.065;
  vec2 primaryCenter = vec2(-0.27, 0.0);
  vec2 secondaryCenter = vec2(0.27, 0.0);

  // abs(distToCircle - radius) gives the ring outline; subtract the stroke
  // half-thickness so the value is negative inside the stroke.
  float dPrimary = abs(length(p - primaryCenter) - windingRadius) - windingThickness;
  float dSecondary = abs(length(p - secondaryCenter) - windingRadius) - windingThickness;

  // Nearest stroke surface (negative => inside a stroke).
  float d = min(dPrimary, dSecondary);

  // Screen-space anti-aliasing: 1 local unit == (v_size) screen px, so this keeps
  // the edge feather ~1px crisp at any zoom (same idea as sigma's correctionRatio).
  float aa = clamp(u_sizeRatio / v_size, 0.004, 0.06);

#ifdef PICKING_MODE
  // Whole quad is pickable so the transformer stays easy to select, like switches.
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
