// language=GLSL
const SHADER_SOURCE = /*glsl*/ `
attribute vec4 a_id;
attribute vec4 a_color;

attribute vec2 a_positionStart;
attribute vec2 a_positionEnd;
attribute float a_radius;
attribute float a_speed;
attribute float a_phase;
attribute float a_direction;

attribute vec2 a_corner;

uniform mat3 u_matrix;
uniform float u_sizeRatio;
uniform float u_correctionRatio;
uniform float u_time;

varying vec4 v_color;
varying vec2 v_corner;

const float bias = 255.0 / 254.0;

void main() {
  float t = fract(u_time * a_speed + a_phase);

  if (a_direction < 0.0) {
    t = 1.0 - t;
  }

  vec2 center = mix(a_positionStart, a_positionEnd, t);

  // radius in graph/webgl space
  float radius = a_radius * u_correctionRatio / u_sizeRatio;

  vec2 offset = a_corner * radius;
  vec2 position = center + offset;

  gl_Position = vec4((u_matrix * vec3(position, 1.0)).xy, 0.0, 1.0);

  v_corner = a_corner;

  #ifdef PICKING_MODE
    v_color = a_id;
  #else
    v_color = a_color;
  #endif

  v_color.a *= bias;
}
`;

export default SHADER_SOURCE;
