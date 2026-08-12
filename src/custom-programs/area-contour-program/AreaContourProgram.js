import { WebGLLayerProgram } from "@sigma/layer-webgl";
import { colorToArray } from "sigma/utils";
import getFragmentShader from "./area-contour.frag.glsl.js";

// Segments and grid indices are packed row-major into textures of these fixed
// widths (matching the shader's #defines), so neither count runs into
// MAX_TEXTURE_SIZE — as low as 2048 on some GPUs — however big an area is.
const SEGMENT_TEXTURE_WIDTH = 1024;
const INDEX_TEXTURE_WIDTH = 1024;

// Segments per grid cell to aim for. Low enough that a fragment tests a handful
// of them, high enough that the grid itself stays small.
const SEGMENTS_PER_CELL = 4;
const MAX_GRID_SIDE = 128;

const DEFAULT_OPTIONS = {
    radius: 0.02, // framed-graph units — see the shader header
    zoomExponent: 0, // 0 keeps the halo glued to the graph, 1 holds a fixed pixel width
    fill: "#cccccc80",
    border: null, // { color, width } — width in CSS pixels
};

const setColorUniform = (gl, location, color) => {
    const [r, g, b, a] = colorToArray(color || "#0000");
    gl.uniform4f(location, r / 255, g / 255, b / 255, a / 255);
};

const createDataTexture = (gl) => {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    return texture;
};

/**
 * Builds a sigma WebGL layer program that fills everything within `radius` of a
 * set of graph segments — the union of capsules around them, with an optional
 * outline. Stands in for @sigma/layer-webgl's `createContoursProgram`, which can
 * only take nodes and whose summed falloff field makes the outline thickness
 * depend on how densely the nodes are packed.
 *
 * @param {{source: string, target: string}[]} segments - node key pairs; source
 *   === target draws a disc around a single node. Positions are read live from
 *   the renderer on every process, so the shape follows layout/drag changes.
 * @param {{radius?: number, zoomExponent?: number, fill?: string,
 *   border?: {color: string, width: number}}} [options]
 * @returns {typeof WebGLLayerProgram} a program class for `bindWebGLLayer`
 */
export default function createAreaContourProgram(segments, options) {
    const { radius, zoomExponent, fill, border } = { ...DEFAULT_OPTIONS, ...(options || {}) };
    const segmentRows = Math.max(1, Math.ceil(segments.length / SEGMENT_TEXTURE_WIDTH));

    // How far past a segment its influence reaches: the halo plus slack for the
    // antialiased edge. Used both to pad the bounds and to decide which cells a
    // segment belongs to, so the two can't disagree.
    const reach = radius * 1.25;

    // A square-ish grid sized off the segment count. Cells are what the shader
    // walks, so this trades grid memory against segments tested per fragment.
    const gridSide = Math.min(
        MAX_GRID_SIDE,
        Math.max(1, Math.round(Math.sqrt(segments.length / SEGMENTS_PER_CELL))),
    );

    return class AreaContourProgram extends WebGLLayerProgram {
        constructor(gl, pickingBuffer, renderer) {
            if (!(gl instanceof WebGL2RenderingContext))
                throw new Error("createAreaContourProgram only works with WebGL2");

            super(gl, pickingBuffer, renderer);

            this.gl = gl;
            this.segmentsArray = new Float32Array(SEGMENT_TEXTURE_WIDTH * segmentRows * 4);
            this.cellsArray = new Float32Array(gridSide * gridSide * 2);
            this.indicesArray = new Float32Array(0);
            this.indexRows = 1;
            this.bounds = [0, 0, 1, 1];

            this.segmentsTexture = createDataTexture(gl);
            this.cellsTexture = createDataTexture(gl);
            this.indicesTexture = createDataTexture(gl);
        }

        /**
         * Re-reads every segment's endpoints from the renderer into the texture
         * array, and recomputes the bounding box the shader rejects against. A
         * node whose display data has gone missing keeps its last position rather
         * than collapsing the segment onto the origin.
         */
        refreshSegments() {
            let minX = Infinity;
            let minY = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;

            segments.forEach(({ source, target }, i) => {
                const a = this.renderer.getNodeDisplayData(source);
                const b = source === target ? a : this.renderer.getNodeDisplayData(target);
                const offset = i * 4;

                if (a && b) {
                    this.segmentsArray[offset] = a.x;
                    this.segmentsArray[offset + 1] = a.y;
                    this.segmentsArray[offset + 2] = b.x;
                    this.segmentsArray[offset + 3] = b.y;
                }

                const [x1, y1, x2, y2] = this.segmentsArray.subarray(offset, offset + 4);
                minX = Math.min(minX, x1, x2);
                minY = Math.min(minY, y1, y2);
                maxX = Math.max(maxX, x1, x2);
                maxY = Math.max(maxY, y1, y2);
            });

            if (minX > maxX) {
                this.bounds = [0, 0, 1, 1];
                return;
            }

            // Grown by the halo's reach, so the bounds double as both the discard
            // box and the grid's extent: every fragment that survives the discard
            // maps to a real cell.
            this.bounds = [minX - reach, minY - reach, maxX + reach, maxY + reach];
        }

        /**
         * Bins segments into the uniform grid: a segment lands in every cell its
         * bounding box, grown by the halo radius, touches — which is every cell
         * whose fragments could find it to be the nearest one.
         */
        refreshGrid() {
            const [minX, minY, maxX, maxY] = this.bounds;
            const spanX = maxX - minX || 1;
            const spanY = maxY - minY || 1;
            const cellOf = (value, min, span) =>
                Math.min(gridSide - 1, Math.max(0, Math.floor(((value - min) / span) * gridSide)));

            // The cell range each segment covers, kept so the two passes below
            // agree without recomputing it.
            const ranges = new Int32Array(segments.length * 4);
            const counts = new Int32Array(gridSide * gridSide);
            let total = 0;

            for (let i = 0; i < segments.length; i++) {
                const offset = i * 4;
                const x1 = this.segmentsArray[offset];
                const y1 = this.segmentsArray[offset + 1];
                const x2 = this.segmentsArray[offset + 2];
                const y2 = this.segmentsArray[offset + 3];

                const c0 = cellOf(Math.min(x1, x2) - reach, minX, spanX);
                const c1 = cellOf(Math.max(x1, x2) + reach, minX, spanX);
                const r0 = cellOf(Math.min(y1, y2) - reach, minY, spanY);
                const r1 = cellOf(Math.max(y1, y2) + reach, minY, spanY);

                ranges[offset] = c0;
                ranges[offset + 1] = c1;
                ranges[offset + 2] = r0;
                ranges[offset + 3] = r1;

                for (let r = r0; r <= r1; r++) {
                    for (let c = c0; c <= c1; c++) counts[r * gridSide + c]++;
                }
                total += (c1 - c0 + 1) * (r1 - r0 + 1);
            }

            // Prefix sum: cell -> where its slice starts in the index list.
            const starts = new Int32Array(gridSide * gridSide);
            let running = 0;
            for (let cell = 0; cell < starts.length; cell++) {
                starts[cell] = running;
                running += counts[cell];
                this.cellsArray[cell * 2] = starts[cell];
                this.cellsArray[cell * 2 + 1] = counts[cell];
            }

            this.indexRows = Math.max(1, Math.ceil(total / INDEX_TEXTURE_WIDTH));
            const capacity = INDEX_TEXTURE_WIDTH * this.indexRows;
            if (this.indicesArray.length !== capacity) this.indicesArray = new Float32Array(capacity);

            const cursor = starts; // reused as the write head per cell
            for (let i = 0; i < segments.length; i++) {
                const offset = i * 4;
                for (let r = ranges[offset + 2]; r <= ranges[offset + 3]; r++) {
                    for (let c = ranges[offset]; c <= ranges[offset + 1]; c++) {
                        this.indicesArray[cursor[r * gridSide + c]++] = i;
                    }
                }
            }
        }

        getCustomLayerDefinition() {
            return {
                FRAGMENT_SHADER_SOURCE: getFragmentShader({
                    hasBorder: !!border,
                    segmentTextureWidth: SEGMENT_TEXTURE_WIDTH,
                    indexTextureWidth: INDEX_TEXTURE_WIDTH,
                }),
                DATA_UNIFORMS: [
                    "u_segments",
                    "u_cells",
                    "u_indices",
                    "u_gridSize",
                    "u_bounds",
                    "u_radius",
                    "u_fillColor",
                    ...(border ? ["u_borderColor"] : []),
                ],
                // u_zoomModifier tracks the camera; u_borderWidth is here rather
                // than in the data because it is given in CSS pixels and so
                // depends on the (mutable) device pixel ratio.
                CAMERA_UNIFORMS: [
                    "u_invMatrix",
                    "u_width",
                    "u_height",
                    "u_zoomModifier",
                    ...(border ? ["u_borderWidth"] : []),
                ],
            };
        }

        cacheDataUniforms({ gl, uniformLocations }) {
            this.refreshSegments();
            this.refreshGrid();

            gl.uniform1i(uniformLocations.u_segments, 0);
            gl.uniform1i(uniformLocations.u_cells, 1);
            gl.uniform1i(uniformLocations.u_indices, 2);
            gl.uniform2f(uniformLocations.u_gridSize, gridSide, gridSide);
            gl.uniform4f(uniformLocations.u_bounds, ...this.bounds);
            gl.uniform1f(uniformLocations.u_radius, radius);
            setColorUniform(gl, uniformLocations.u_fillColor, fill);
            if (border) setColorUniform(gl, uniformLocations.u_borderColor, border.color);

            this.upload(gl, 0, this.segmentsTexture, [gl.RGBA32F, gl.RGBA], SEGMENT_TEXTURE_WIDTH, segmentRows, this.segmentsArray);
            this.upload(gl, 1, this.cellsTexture, [gl.RG32F, gl.RG], gridSide, gridSide, this.cellsArray);
            this.upload(gl, 2, this.indicesTexture, [gl.R32F, gl.RED], INDEX_TEXTURE_WIDTH, this.indexRows, this.indicesArray);
        }

        upload(gl, unit, texture, [internalFormat, format], width, height, data) {
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, gl.FLOAT, data);
        }

        setCameraUniforms({ invMatrix, pixelRatio, zoomRatio }, { gl, uniformLocations }) {
            gl.uniform1f(uniformLocations.u_width, gl.canvas.width);
            gl.uniform1f(uniformLocations.u_height, gl.canvas.height);
            gl.uniformMatrix3fv(uniformLocations.u_invMatrix, false, invMatrix);

            // Capped at 1 so the drawn halo never outgrows the radius the bounds
            // and the grid were built for — zooming out past the whole model
            // would otherwise clip it at the cell edges.
            gl.uniform1f(
                uniformLocations.u_zoomModifier,
                Math.min(1, Math.pow(zoomRatio, zoomExponent)),
            );

            if (border) gl.uniform1f(uniformLocations.u_borderWidth, border.width * pixelRatio);
        }

        renderProgram(params, programInfo) {
            const { gl } = programInfo;
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.segmentsTexture);
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, this.cellsTexture);
            gl.activeTexture(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_2D, this.indicesTexture);
            super.renderProgram(params, programInfo);
        }

        kill() {
            this.gl.deleteTexture(this.segmentsTexture);
            this.gl.deleteTexture(this.cellsTexture);
            this.gl.deleteTexture(this.indicesTexture);
            super.kill();
        }
    };
}
