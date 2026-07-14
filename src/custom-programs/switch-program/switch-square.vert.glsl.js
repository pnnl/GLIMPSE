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

const float bias = 255.0 / 254.0;

void main() {
  // Place the square on the apex of the (possibly curved) edge so parallel
  // switches keep their square centered on the visible line. a_curvature == 0
  // => plain midpoint.
  vec2 diff = a_positionEnd - a_positionStart;
  vec2 center = (a_positionStart + a_positionEnd) * 0.5 + 0.5 * vec2(-diff.y, diff.x) * a_curvature;

  // Half-size in graph/WebGL space
  float halfSize = a_size * u_correctionRatio / u_sizeRatio;

  vec2 offset = a_corner * halfSize;
  vec2 position = center + offset;

  gl_Position = vec4((u_matrix * vec3(position, 1.0)).xy, 0.0, 1.0);

  #ifdef PICKING_MODE
    v_color = a_id;
  #else
    v_color = a_color;
  #endif

  v_color.a *= bias;

  // Level-of-detail: on LARGE models edge icons are a zoom-IN detail — fade them
  // out as the camera nears the full-graph view so it reads as clean topology.
  // u_sizeRatio < 1 = zoomed in, 1 = full view, > 1 = zoomed out.
  //   ICON_SHOW: at/below this u_sizeRatio the icon is fully opaque (zoomed in)
  //   ICON_HIDE: at/above this u_sizeRatio the icon is gone (full view / out)
  // Raise ICON_HIDE (e.g. 1.3) to keep icons faintly visible at the full-graph view.
  // u_fade (from graph order) gates it: small models + the legend pass 0 and keep
  // full detail at full view; large models pass 1 for the full zoom fade.
  // Guarded from PICKING_MODE so a faded icon doesn't corrupt its pick id alpha.
  #ifndef PICKING_MODE
    const float ICON_SHOW = 0.7;
    const float ICON_HIDE = 1.0;
    float zoomLod = clamp((ICON_HIDE - u_sizeRatio) / (ICON_HIDE - ICON_SHOW), 0.0, 1.0);
    v_color.a *= mix(1.0, zoomLod, u_fade);
  #endif
}
`;

export default SHADER_SOURCE;
