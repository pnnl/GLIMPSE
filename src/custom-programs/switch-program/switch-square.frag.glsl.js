// language=GLSL
const SHADER_SOURCE = /*glsl*/ `
precision mediump float;
varying vec4 v_color;

void main(void) {
  #ifdef PICKING_MODE
    gl_FragColor = v_color;
  #else
    gl_FragColor = v_color;
  #endif
}
`;

export default SHADER_SOURCE;
