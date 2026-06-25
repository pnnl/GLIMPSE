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
varying vec2 v_corner;
varying float v_size;

const float bias = 255.0 / 254.0;

void main() {
  vec2 diff = a_positionEnd - a_positionStart;

  // Sit on the apex of the (possibly curved) edge so parallel transformers keep
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
}
`;

export default SHADER_SOURCE;
