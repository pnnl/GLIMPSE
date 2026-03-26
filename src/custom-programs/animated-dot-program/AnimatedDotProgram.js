import { floatColor } from "sigma/utils";
import { EdgeProgram } from "sigma/rendering";
import FRAGMENT_SHADER_SOURCE from "./animated-dot.frag.glsl.js";
import VERTEX_SHADER_SOURCE from "./animated-dot.vert.glsl.js";

const { FLOAT, UNSIGNED_BYTE } = WebGLRenderingContext;

const UNIFORMS = ["u_matrix", "u_time", "u_sizeRatio", "u_correctionRatio"];

export default class AnimatedDotProgram extends EdgeProgram {
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

        const color = floatColor(data.dotColor || "#ff0000");
        const radius = data.dotSize || 6;
        const speed = data.dotSpeed ?? 0.25;
        const phase = data.dotPhase ?? 0;
        const direction = data.flowDirection === -1 ? -1 : 1;

        const array = this.array;

        array[startIndex++] = x1;
        array[startIndex++] = y1;
        array[startIndex++] = x2;
        array[startIndex++] = y2;
        array[startIndex++] = radius;
        array[startIndex++] = speed;
        array[startIndex++] = phase;
        array[startIndex++] = direction;
        array[startIndex++] = color;
        array[startIndex++] = edgeIndex;
    }

    setUniforms(params, { gl, uniformLocations }) {
        const { u_matrix, u_time, u_sizeRatio, u_correctionRatio } = uniformLocations;

        gl.uniformMatrix3fv(u_matrix, false, params.matrix);
        gl.uniform1f(u_time, (performance.now() - this.startTime) / 1000);
        gl.uniform1f(u_sizeRatio, params.sizeRatio);
        gl.uniform1f(u_correctionRatio, params.correctionRatio);
    }
}
