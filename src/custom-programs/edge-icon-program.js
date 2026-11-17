import { floatColor } from "sigma/utils";
import { Program } from "sigma/rendering";

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

/**
 * One instanced quad per edge, drawn as a sigma custom layer (see edge-overlays.js)
 * rather than by sigma's edge program. Subclasses implement `write`.
 */
export class EdgeOverlayProgram extends Program {
    count = 0;

    clear() {
        this.count = 0;
        this.invalidateBuffers();
    }

    push(sourceData, targetData, data) {
        if (this.count === this.capacity) {
            const filled = this.floats;
            this.reallocate(Math.max(16, this.capacity * 2));
            this.floats.set(filled);
        }
        this.write(this.floats, this.count++ * this.ATTRIBUTES_ITEMS_COUNT, sourceData, targetData, data);
    }

    // Visual pass only: overlays are not pick targets, the edge line underneath is.
    render(params) {
        if (this.count === 0) return;

        this.renderCount = this.count;
        this.bindProgram(this.normalProgram);
        this.renderProgram(params, this.normalProgram);
        this.unbindProgram(this.normalProgram);
    }
}

const ICON_FADE_START = 250;
const ICON_FADE_END = 1000;

// u_fade: 0 for small graphs (icons stay at full view), 1 for large ones (zoom fade).
const iconFadeForOrder = (order) => {
    const t = Math.min(1, Math.max(0, (order - ICON_FADE_START) / (ICON_FADE_END - ICON_FADE_START)));
    return t * t * (3 - 2 * t); // smoothstep
};

/**
 * An overlay program that draws one icon quad on the apex of a (possibly curved) edge.
 *
 * @param {Object} icon
 * @param {string} icon.vertexShader
 * @param {string} icon.fragmentShader
 * @param {(data: Object) => string} icon.color
 * @param {(data: Object) => number} icon.size
 */
export const createEdgeIconProgram = ({ vertexShader, fragmentShader, color, size }) =>
    class EdgeIconProgram extends EdgeOverlayProgram {
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
                ],
                ...CORNER_QUAD,
            };
        }

        write(array, i, sourceData, targetData, data) {
            array[i++] = sourceData.x;
            array[i++] = sourceData.y;
            array[i++] = targetData.x;
            array[i++] = targetData.y;
            array[i++] = size(data);
            // Sigma's own curvature for a fanned-out parallel edge, so the icon sits on the curve.
            array[i++] = data.curvature || 0;
            array[i] = floatColor(color(data));
        }

        setUniforms(params, { gl, uniformLocations }) {
            const { u_matrix, u_sizeRatio, u_correctionRatio, u_fade } = uniformLocations;

            gl.uniformMatrix3fv(u_matrix, false, params.matrix);
            gl.uniform1f(u_sizeRatio, params.sizeRatio);
            gl.uniform1f(u_correctionRatio, params.correctionRatio);
            gl.uniform1f(u_fade, iconFadeForOrder(this.renderer.getGraph().order));
        }
    };
