import { createEdgeIconProgram } from "../edge-icon-program";
import VERTEX_SHADER_SOURCE from "../icon-winding.vert.glsl.js";
import FRAGMENT_SHADER_SOURCE from "./transformer.frag.glsl.js";

// Single-color IEEE transformer symbol; defaults to the transformer edge color.
export default createEdgeIconProgram({
    vertexShader: VERTEX_SHADER_SOURCE,
    fragmentShader: FRAGMENT_SHADER_SOURCE,
    color: (data) => data.transformerColor || data.color || "#009E73",
    size: (data) => data.transformerSize || 14,
});
