// language=GLSL
const SHADER_SOURCE = /*glsl*/ `
attribute vec4 a_id;
attribute vec4 a_color;
attribute vec2 a_positionStart;
attribute vec2 a_positionEnd;
attribute float a_size;
attribute vec2 a_corner;

uniform mat3 u_matrix;
uniform float u_sizeRatio;
uniform float u_correctionRatio;

varying vec4 v_color;

const float bias = 255.0 / 254.0;

void main() {
  // Place square exactly at the midpoint of the edge
  vec2 center = (a_positionStart + a_positionEnd) * 0.5;

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
