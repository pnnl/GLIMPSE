// language=GLSL
const SHADER_SOURCE = /*glsl*/ `
attribute vec4 a_id;
attribute vec4 a_color;
attribute vec2 a_positionStart;
attribute vec2 a_positionEnd;
attribute float a_size;
attribute float a_curvature;
attribute vec2 a_corner;

uniform mat3 u_matrix;
uniform float u_sizeRatio;
uniform float u_correctionRatio;
uniform float u_fade; // 0 = small graph/legend (no fade), 1 = large graph (zoom fade)

varying vec4 v_color;
varying vec2 v_corner;
varying float v_size;

const float bias = 255.0 / 254.0;

void main() {
  vec2 diff = a_positionEnd - a_positionStart;

  // Sit on the apex of the (possibly curved) edge so parallel regulators keep
  // their icon centered on the visible line. a_curvature == 0 => plain midpoint.
  vec2 midpoint = (a_positionStart + a_positionEnd) * 0.5;
  vec2 center = midpoint + 0.5 * vec2(-diff.y, diff.x) * a_curvature;

  // Orient the symbol along the edge so the two windings sit inline with the
  // conductor (the curve's tangent at the apex is parallel to the chord).
  vec2 dir = length(diff) > 0.0 ? normalize(diff) : vec2(1.0, 0.0);
  vec2 perp = vec2(-dir.y, dir.x);

  // Half-size of the icon quad in graph/WebGL space.
  float halfSize = a_size * u_correctionRatio / u_sizeRatio;

  // a_corner.x runs along the edge, a_corner.y across it.
  vec2 offset = (a_corner.x * dir + a_corner.y * perp) * halfSize;
  vec2 position = center + offset;

  gl_Position = vec4((u_matrix * vec3(position, 1.0)).xy, 0.0, 1.0);

  // Forward the local corner (to draw the symbol) and the on-screen size (so
  // the fragment shader can keep the anti-aliasing ~1px crisp at any zoom).
  v_corner = a_corner;
  v_size = a_size;

  #ifdef PICKING_MODE
    v_color = a_id;
  #else
    v_color = a_color;
  #endif

  v_color.a *= bias;

  // Level-of-detail: on LARGE models edge icons are a zoom-IN detail — fade them
  // out as the camera nears the full-graph view so it reads as clean topology.
  // u_sizeRatio < 1 = zoomed in, larger = zoomed out.
  //   ICON_SHOW: at/below this u_sizeRatio the icon is fully opaque (zoomed in)
  //   ICON_HIDE: at/above this u_sizeRatio the icon is fully gone (zoomed out)
  // The fit / "zoomed-out" view lands at u_sizeRatio ~0.95 (GraphControls fits to
  // spread * 0.95), so ICON_HIDE must sit BELOW that, otherwise a small residual
  // alpha lingers at full view — invisible on a light background but visible
  // against the dark-mode background. Keeping a margin guarantees the icon is
  // fully transparent by the time the model is fully zoomed out.
  // u_fade (from graph order) gates it: small models + the legend pass 0 and keep
  // full detail at full view; large models pass 1 for the full zoom fade.
  // Guarded from PICKING_MODE so a faded icon doesn't corrupt its pick id alpha.
  #ifndef PICKING_MODE
    const float ICON_SHOW = 0.6;
    const float ICON_HIDE = 0.85;
    float zoomLod = clamp((ICON_HIDE - u_sizeRatio) / (ICON_HIDE - ICON_SHOW), 0.0, 1.0);
    v_color.a *= mix(1.0, zoomLod, u_fade);
  #endif
}
`;

export default SHADER_SOURCE;
