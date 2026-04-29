// language=GLSL
const SHADER_SOURCE = /*glsl*/ `
precision mediump float;

varying vec4 v_color;
varying vec2 v_corner;

const vec4 transparent = vec4(0.0, 0.0, 0.0, 0.0);

void main(void) {
  #ifdef PICKING_MODE
    gl_FragColor = v_color;
  #else
    float dist = length(v_corner);
    float alpha = 1.0 - smoothstep(0.7, 1.0, dist);
    gl_FragColor = mix(transparent, v_color, alpha);
  #endif
}
`;

export default SHADER_SOURCE;
