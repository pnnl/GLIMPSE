import { floatColor } from "sigma/utils";
import { EdgeProgram } from "sigma/rendering";

const { FLOAT, UNSIGNED_BYTE, TRIANGLES } = WebGLRenderingContext;

/** Two triangles spanning a [-1, 1] quad, fed to the shaders as `a_corner`. */
export const CORNER_QUAD = {
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

const ICON_FADE_START = 250;
const ICON_FADE_END = 1000;

// u_fade: 0 for small graphs (icons stay at full view), 1 for large ones (zoom fade).
const iconFadeForOrder = (order) => {
    const t = Math.min(1, Math.max(0, (order - ICON_FADE_START) / (ICON_FADE_END - ICON_FADE_START)));
    return t * t * (3 - 2 * t); // smoothstep
};

/**
 * An edge program that draws one icon quad on the apex of a (possibly curved) edge.
 *
 * @param {Object} icon
 * @param {string} icon.vertexShader
 * @param {string} icon.fragmentShader
 * @param {(data: Object) => string} icon.color
 * @param {(data: Object) => number} icon.size
 */
export const createEdgeIconProgram = ({ vertexShader, fragmentShader, color, size }) =>
    class EdgeIconProgram extends EdgeProgram {
        getDefinition() {
            return {
                VERTICES: 6,
                VERTEX_SHADER_SOURCE: vertexShader,
                FRAGMENT_SHADER_SOURCE: fragmentShader,
                METHOD: TRIANGLES,
                UNIFORMS: ["u_matrix", "u_sizeRatio", "u_correctionRatio", "u_fade"],
                ATTRIBUTES: [
                    { name: "a_positionStart", size: 2, type: FLOAT },
                    { name: "a_positionEnd", size: 2, type: FLOAT },
                    { name: "a_size", size: 1, type: FLOAT },
                    { name: "a_curvature", size: 1, type: FLOAT },
                    { name: "a_color", size: 4, type: UNSIGNED_BYTE, normalized: true },
                    { name: "a_id", size: 4, type: UNSIGNED_BYTE, normalized: true },
                ],
                ...CORNER_QUAD,
            };
        }

        processVisibleItem(edgeIndex, startIndex, sourceData, targetData, data) {
            const array = this.array;

            array[startIndex++] = sourceData.x;
            array[startIndex++] = sourceData.y;
            array[startIndex++] = targetData.x;
            array[startIndex++] = targetData.y;
            array[startIndex++] = size(data);
            // Match the line's curvature so the icon sits on a curved parallel edge.
            array[startIndex++] = data.curvature || 0;
            array[startIndex++] = floatColor(color(data));
            array[startIndex] = edgeIndex;
        }

        setUniforms(params, { gl, uniformLocations }) {
            const { u_matrix, u_sizeRatio, u_correctionRatio, u_fade } = uniformLocations;

            gl.uniformMatrix3fv(u_matrix, false, params.matrix);
            gl.uniform1f(u_sizeRatio, params.sizeRatio);
            gl.uniform1f(u_correctionRatio, params.correctionRatio);
            gl.uniform1f(u_fade, iconFadeForOrder(this.renderer.getGraph().order));
        }
    };
