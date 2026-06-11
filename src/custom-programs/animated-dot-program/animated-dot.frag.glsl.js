// language=GLSL
const SHADER_SOURCE = /*glsl*/ `
precision mediump float;

varying vec4 v_color;
varying vec2 v_corner;

const vec4 transparent = vec4(0.0, 0.0, 0.0, 0.0);

void main(void) {
  // Arrow / isoceles triangle in local corner space:
  //   tip at  ( 1,  0)
  //   base at (-1, -1) and (-1,  1)
  // A point is inside when |y| <= (1 - x) / 2.
  float halfWidth = (1.0 - v_corner.x) * 0.5;
  float dist = abs(v_corner.y) - halfWidth;

#ifdef PICKING_MODE
  if (dist > 0.0) discard;
  gl_FragColor = v_color;
#else
  float alpha = 1.0 - smoothstep(-0.05, 0.05, dist);
  gl_FragColor = mix(transparent, v_color, alpha);
#endif
}
`;

export default SHADER_SOURCE;
