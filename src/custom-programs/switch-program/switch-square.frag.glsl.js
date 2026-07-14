// language=GLSL
const SHADER_SOURCE = /*glsl*/ `
precision mediump float;
varying vec4 v_color;

void main(void) {
  #ifdef PICKING_MODE
    gl_FragColor = v_color;
  #else
    // Sigma blends premultiplied (gl.ONE, gl.ONE_MINUS_SRC_ALPHA), so the RGB must
    // also be scaled by the (zoom-faded) v_color.a. Without this the square leaks /
    // brightens toward white at full view instead of fading out as alpha -> 0.
    gl_FragColor = vec4(v_color.rgb * v_color.a, v_color.a);
  #endif
}
`;

export default SHADER_SOURCE;
