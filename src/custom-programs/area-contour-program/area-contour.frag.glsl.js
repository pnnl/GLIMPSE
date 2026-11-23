// Fragment shader for the distribution-area highlight: one full-canvas quad where each fragment takes the distance to the nearest of the area's segments (an edge, or a zero-length one for a lone node), so the halo is exactly `radius` thick with no gaps or bulges.
// Only segments near the fragment are tested via a CPU-built uniform grid (u_cells slices into u_indices), and all units are framed-graph space (largest model dimension = 1.0) so a radius looks the same on any model size.

// language=GLSL
const getFragmentShader = ({ hasBorder, segmentTextureWidth, indexTextureWidth }) => /*glsl*/ `#version 300 es
// Segments and grid indices are packed row-major into textures of these fixed
// widths — constants (and powers of two) so the index maths stays cheap.
#define SEGMENT_TEXTURE_WIDTH ${segmentTextureWidth}
#define INDEX_TEXTURE_WIDTH ${indexTextureWidth}

precision highp float;
precision highp int;

// Data:
uniform sampler2D u_segments; // one texel per segment: (x1, y1, x2, y2)
uniform sampler2D u_cells;    // one texel per grid cell: (start, count) into u_indices
uniform sampler2D u_indices;  // segment index per texel, in cell order
uniform vec2 u_gridSize;      // grid columns, rows
uniform vec4 u_bounds;        // (minX, minY, maxX, maxY) the grid spans
uniform float u_radius;       // halo thickness, framed-graph units
uniform float u_zoomModifier; // scales the radius with zoom; <= 1, see the program
uniform vec4 u_fillColor;
${hasBorder ? "uniform vec4 u_borderColor;\nuniform float u_borderWidth; // device pixels" : ""}

// Camera:
uniform mat3 u_invMatrix;
uniform float u_width;
uniform float u_height;

out vec4 fragColor;

// Distance from p to the segment [a, b]. a == b degrades to a plain disc, which
// is how lone nodes ride along in the same loop.
float segmentDistance(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float lengthSquared = dot(ba, ba);
  float t = lengthSquared > 0.0 ? clamp(dot(pa, ba) / lengthSquared, 0.0, 1.0) : 0.0;
  return length(pa - ba * t);
}

void main() {
  vec2 position = (u_invMatrix * vec3(gl_FragCoord.xy * 2.0 / vec2(u_width, u_height) - 1.0, 1.0)).xy;

  // The bounds already carry the halo's own margin, so anything outside them is
  // out of reach of every segment — and outside the grid.
  if (position.x < u_bounds.x || position.x > u_bounds.z ||
      position.y < u_bounds.y || position.y > u_bounds.w) discard;

    // One device pixel in framed-graph units (the camera matrix scales x and y alike, so either axis answers for both).
    // Used instead of fwidth(), which is undefined here because the early exit below makes the loop's control flow non-uniform.
  float pixel = length((u_invMatrix * vec3(2.0 / u_width, 0.0, 0.0)).xy);
  float feather = pixel;
  ${hasBorder ? "float border = u_borderWidth * pixel;" : "float border = 0.0;"}

  // The drawn radius tightens as you zoom in, matching how node sizes respond,
  // so magnified detail isn't buried under the halo. Never larger than u_radius,
  // which is what the bounds above and the grid below were built for.
  float radius = u_radius * u_zoomModifier;

  // Closer than this and the fragment is solidly in the fill: the exact distance
  // stops changing the output, so we can stop looking.
  float solid = radius - border - 2.0 * feather;

  vec2 cell = (position - u_bounds.xy) / (u_bounds.zw - u_bounds.xy) * u_gridSize;
  ivec2 cellCoords = clamp(ivec2(cell), ivec2(0), ivec2(u_gridSize) - 1);
  vec2 slice = texelFetch(u_cells, cellCoords, 0).xy;
  int start = int(slice.x);
  int count = int(slice.y);

  float nearest = 1e20;
  for (int k = 0; k < count; k++) {
    int entry = start + k;
    int index = int(texelFetch(u_indices, ivec2(entry % INDEX_TEXTURE_WIDTH, entry / INDEX_TEXTURE_WIDTH), 0).x);
    vec4 segment = texelFetch(u_segments, ivec2(index % SEGMENT_TEXTURE_WIDTH, index / SEGMENT_TEXTURE_WIDTH), 0);

    nearest = min(nearest, segmentDistance(position, segment.xy, segment.zw));
    if (nearest < solid) break;
  }

  float alpha = 1.0 - smoothstep(radius - feather, radius + feather, nearest);
  if (alpha <= 0.0) discard;

  vec4 color = u_fillColor;
${
    hasBorder
        ? "  color = mix(u_fillColor, u_borderColor, smoothstep(radius - border - feather, radius - border + feather, nearest));"
        : ""
}

  // The layer canvas composites with premultiplied alpha.
  float opacity = color.a * alpha;
  fragColor = vec4(color.rgb * opacity, opacity);
}
`;

export default getFragmentShader;
