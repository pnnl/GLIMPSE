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
}
`;

export default SHADER_SOURCE;
