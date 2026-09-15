import { createEdgeIconProgram } from "../edge-icon-program";
import FRAGMENT_SHADER_SOURCE from "./switch-square.frag.glsl.js";
import VERTEX_SHADER_SOURCE from "./switch-square.vert.glsl.js";

// switchColor carries the open/closed state.
export default createEdgeIconProgram({
    vertexShader: VERTEX_SHADER_SOURCE,
    fragmentShader: FRAGMENT_SHADER_SOURCE,
    color: (data) => data.switchColor || "#ff0000",
    size: (data) => data.switchSize || 10,
});
