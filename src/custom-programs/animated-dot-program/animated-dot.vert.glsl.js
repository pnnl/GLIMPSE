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

  // Movement direction in graph space, flipped by a_direction so the
  // arrow always points the way the dot is actually moving.
  vec2 diff = a_positionEnd - a_positionStart;
  vec2 dir = length(diff) > 0.0
    ? normalize(diff) * a_direction
    : vec2(1.0, 0.0);
  vec2 perp = vec2(-dir.y, dir.x);

  float radius = a_radius * u_correctionRatio / u_sizeRatio;

  // a_corner.x along the direction of travel (tip at +1),
  // a_corner.y across it (base from -1 to +1).
  vec2 offset = (a_corner.x * dir + a_corner.y * perp) * radius;
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
