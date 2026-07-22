import { floatColor } from "sigma/utils";
import { EdgeProgram } from "sigma/rendering";
import FRAGMENT_SHADER_SOURCE from "./transformer.frag.glsl.js";
import VERTEX_SHADER_SOURCE from "./transformer.vert.glsl.js";
import { iconFadeForOrder } from "../../utils/icon-lod";

const { FLOAT, UNSIGNED_BYTE } = WebGLRenderingContext;

const UNIFORMS = ["u_matrix", "u_sizeRatio", "u_correctionRatio", "u_fade"];

export default class TransformerProgram extends EdgeProgram {
    getDefinition() {
        return {
            VERTICES: 6,
            VERTEX_SHADER_SOURCE,
            FRAGMENT_SHADER_SOURCE,
            METHOD: WebGLRenderingContext.TRIANGLES,
            UNIFORMS,
            ATTRIBUTES: [
                { name: "a_positionStart", size: 2, type: FLOAT },
                { name: "a_positionEnd", size: 2, type: FLOAT },
                { name: "a_size", size: 1, type: FLOAT },
                { name: "a_curvature", size: 1, type: FLOAT },
                { name: "a_color", size: 4, type: UNSIGNED_BYTE, normalized: true },
                { name: "a_id", size: 4, type: UNSIGNED_BYTE, normalized: true },
            ],
            CONSTANT_ATTRIBUTES: [{ name: "a_corner", size: 2, type: FLOAT }],
            CONSTANT_DATA: [
                [-1, -1],
                [1, -1],
                [-1, 1],
                [-1, 1],
                [1, -1],
                [1, 1],
            ],
        };
    }

    processVisibleItem(edgeIndex, startIndex, sourceData, targetData, data) {
        const x1 = sourceData.x;
        const y1 = sourceData.y;
        const x2 = targetData.x;
        const y2 = targetData.y;

        // Single-color IEEE transformer symbol; defaults to the transformer edge color.
        const color = floatColor(data.transformerColor || data.color || "#009E73");
        const iconSize = data.transformerSize || 14;
        // Match the line's curvature so the icon sits on a curved parallel edge.
        const curvature = data.curvature || 0;

        const array = this.array;

        array[startIndex++] = x1;
        array[startIndex++] = y1;
        array[startIndex++] = x2;
        array[startIndex++] = y2;
        array[startIndex++] = iconSize;
        array[startIndex++] = curvature;
        array[startIndex++] = color;
        array[startIndex] = edgeIndex;
    }

    setUniforms(params, { gl, uniformLocations }) {
        const { u_matrix, u_sizeRatio, u_correctionRatio, u_fade } = uniformLocations;

        gl.uniformMatrix3fv(u_matrix, false, params.matrix);
        gl.uniform1f(u_sizeRatio, params.sizeRatio);
        gl.uniform1f(u_correctionRatio, params.correctionRatio);
        gl.uniform1f(u_fade, iconFadeForOrder(this.renderer.getGraph().order));
    }
}
