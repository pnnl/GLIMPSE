import { floatColor } from "sigma/utils";
import { CORNER_QUAD, EdgeOverlayProgram } from "../edge-icon-program";
import FRAGMENT_SHADER_SOURCE from "./animated-dot.frag.glsl.js";
import VERTEX_SHADER_SOURCE from "./animated-dot.vert.glsl.js";

const { FLOAT, UNSIGNED_BYTE } = WebGLRenderingContext;

const UNIFORMS = ["u_matrix", "u_time", "u_sizeRatio", "u_correctionRatio"];

export default class AnimatedDotProgram extends EdgeOverlayProgram {
    startTime = performance.now();

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
                { name: "a_radius", size: 1, type: FLOAT },
                { name: "a_speed", size: 1, type: FLOAT },
                { name: "a_phase", size: 1, type: FLOAT },
                { name: "a_direction", size: 1, type: FLOAT },
                { name: "a_color", size: 4, type: UNSIGNED_BYTE, normalized: true },
            ],
            ...CORNER_QUAD,
        };
    }

    write(array, i, sourceData, targetData, data) {
        array[i++] = sourceData.x;
        array[i++] = sourceData.y;
        array[i++] = targetData.x;
        array[i++] = targetData.y;
        array[i++] = data.dotSize || 6;
        array[i++] = data.dotSpeed ?? 0.25;
        array[i++] = data.dotPhase ?? 0;
        array[i++] = data.flowDirection === -1 ? -1 : 1;
        array[i] = floatColor(data.dotColor || "#ff0000");
    }

    setUniforms(params, { gl, uniformLocations }) {
        const { u_matrix, u_time, u_sizeRatio, u_correctionRatio } = uniformLocations;

        gl.uniformMatrix3fv(u_matrix, false, params.matrix);
        gl.uniform1f(u_time, (performance.now() - this.startTime) / 1000);
        gl.uniform1f(u_sizeRatio, params.sizeRatio);
        gl.uniform1f(u_correctionRatio, params.correctionRatio);
    }
}
