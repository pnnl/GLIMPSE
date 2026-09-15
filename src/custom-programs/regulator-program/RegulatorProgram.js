import { createEdgeIconProgram } from "../edge-icon-program";
import VERTEX_SHADER_SOURCE from "../icon-winding.vert.glsl.js";
import FRAGMENT_SHADER_SOURCE from "./regulator.frag.glsl.js";

// Single-color IEEE regulator symbol; defaults to the regulator edge color.
export default createEdgeIconProgram({
    vertexShader: VERTEX_SHADER_SOURCE,
    fragmentShader: FRAGMENT_SHADER_SOURCE,
    color: (data) => data.regulatorColor || data.color || "#D55E00",
    size: (data) => data.regulatorSize || 14,
});
