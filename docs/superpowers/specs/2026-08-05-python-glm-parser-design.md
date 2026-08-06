# Pure-Python GLM Parser — Design

**Date:** 2026-08-05
**Status:** Approved, pending implementation plan

## Problem

The `.glm` parser GLIMPSE depends on is the `glm` pip package — a Nim binary
(`local-server/glm/`, an untracked clone; `.gitignore:15` ignores `**/glm`).
Building GLIMPSE from source therefore requires a Nim toolchain for anyone on
Apple Silicon or anyone exporting modified GLM files, per `README.md:73-199`.
The goal is to remove Nim from the build entirely.

## Why Python and not Rust

Rust via PyO3/maturin would replace a Nim toolchain requirement with a Rust
toolchain requirement — identical friction, for a full rewrite. It only avoids
that by shipping prebuilt per-platform wheels, which the existing Nim code could
do equally well. Rust does not address the stated problem.

The native speed is also not being earned. Measured against a throwaway
pure-Python prototype (median of 5 runs):

| model | Nim | pure Python |
|---|---|---|
| `ieee8500.glm` (2.2 MB, 12,492 objects) | 179 ms | 182 ms |
| `IEEE_9500.glm` (2.15 MB) | 172 ms | 167 ms |
| `3000_model.glm` (1.04 MB) | 86 ms | 75 ms |

Two reasons the compiled version has no headroom:

1. `lexer.nim:246-249` heap-allocates a `ref object` Token for every space and
   newline — over a million allocations on a 2 MB file.
2. `glm.nim:16-18` serializes the whole AST to a JSON string and calls
   `pyImport("json").loads(...)` on it. Every load already pays a full Python
   JSON parse (~18 ms) plus a 2.77 MB intermediate string. A Python parser
   builds the dicts directly and skips the round-trip.

Secondary wins: one pure wheel for every platform (killing the Apple Silicon
special case), and simpler PyInstaller bundling with no native `.so`/`.pyd`.

## Constraints discovered

- **The AST shape is a hard contract.** `server.py:498-502` ships the parser
  output straight to the frontend; `GraphHelper.js:1676` reads `obj.name` as the
  object type and `attributes.name` as the node id; `GraphHelper.js:1661` retains
  the whole dict as `glmFileData` and posts it back to `/api/export/glm`, which
  calls `dump`. Every key must survive the round-trip.
- **One consumer.** `glmhelper.py:1` is the only importer of `glm`.
- **Naming.** `.gitignore:15` (`**/glm`) means the new module cannot be called
  `glm` or it will not be committed.
- **No dependency-file change needed.** `glm` appears in neither
  `requirements.txt` nor `pyproject.toml` — it was always an implicit install.

## Module layout

```
local-server/glmparser/
├── __init__.py     # public API only: load, loads, dump, dumps, version, GlmParseError
├── lexer.py        # regex scan → streaming tokens with 1-token lookahead
├── parser.py       # tokens → AST dict
├── writer.py       # AST dict → GLM text
└── errors.py       # GlmParseError with line/column/caret rendering
```

## Public API

Mirrors the Nim surface. Both path and file-object forms are required:
`glmhelper.py:23` passes a path to `load`, `glmhelper.py:33` passes an open file
object to `dump`.

```python
loads(text: str) -> dict
load(file: str | os.PathLike | TextIO) -> dict
dumps(data: dict) -> str
dump(data: dict, file: str | os.PathLike | TextIO) -> None
version() -> str
```

`glmhelper.py` changes by one line: `import glm` → `from glmparser import load, dump`.

`version()` returns the `glmparser` package version string, tracked
independently of the Nim package's `v0.4.4`; it starts at `1.0.0`. `dump`
returns `None` where the Nim binding returned `0` — `glmhelper.py:33` discards
the result, so nothing depends on it.

## Tokenizer

A single `re.finditer` over one master alternation, pulled through a small
`peek()`/`next()` buffer rather than materialized into a list. The parser needs
exactly one token of lookahead, confirmed while building the prototype.

Materializing the token list costs 62 MB peak on a 2.2 MB file (~140 MB at the
5 MB cap in `glmhelper.py:8`), which matters for the bundled Electron app.
Streaming keeps peak near source size plus output.

Token kinds: `hash` (`set`/`define`/`include`), `kw`
(`clock`/`module`/`object`/`class`/`schedule`), `lbrace`, `rbrace`, `semi`,
`word`, `eof`. `//` comments are matched and discarded. Whitespace is skipped
rather than tokenized — this is the single biggest departure from the Nim lexer
and the main source of the speed parity.

Each token carries its source start and end offsets, which serve both value
slicing and error reporting.

## Value handling

Attribute values are **sliced out of the retained source string by offset**, not
re-joined from token text. Re-joining with a separator corrupts `${VSOURCE}`
(becomes `$ {VSOURCE}`); re-joining without one corrupts multi-word values.
Slicing is exact and cheaper than both.

Two terminator rules, which differ and must not be conflated:

- Attribute values inside a block run to the next `;`.
- `#set`, `#define`, `#include` run to the **end of line**. Getting this wrong
  causes the value to swallow subsequent lines — observed and fixed during
  prototyping.

## AST schema

```python
{
  "clock":       {str: str},                       # {} when absent
  "includes":    [{"value": str}],
  "objects":     [{"name": str, "attributes": {str: str}, "children": [...]}],
  "modules":     [{"name": str, "attributes": {str: str}}],
  "classes":     [{"name": str, "properties": [{"type": str, "name": str}]}],   # NEW
  "directives":  [{"name": str, "value": str}],
  "definitions": [{"name": str, "value": str}],
  "schedules":   [{"name": str, "values": [str], "children": [[str]]}],
}
```

`classes` is the only added key. `GraphHelper.js:1673` iterates `file.objects`
and carries every other key through opaquely, so the addition is inert on the
frontend.

A class body is an ordered `properties` list rather than a dict keyed by
property name or type: a GridLAB-D class legitimately repeats property types
(`double power_factor; double heatgain_fraction;`), and keying by type would
collapse same-typed properties, silently dropping all but the last.

`clock` is always present, `{}` when the model has none — matching
`ast.nim:238-243`.

### Anonymous object hoisting — preserved exactly

`configuration object line_configuration { ... };` inside a parent object:
the child receives a `uuid4` string as `attributes["name"]`, is appended to
top-level `objects`, and the parent's attribute takes that generated name as its
value. Edge wiring in the frontend resolves those name references, so this
behavior is load-bearing. Matches `parser.nim:232-238`.

Bare `object child { ... };` nested inside a parent instead goes to the parent's
`children` list. Matches `parser.nim:224-227`.

## Behavior changes

Three confirmed data-losing bugs in the Nim parser are fixed. Duplicate-key
last-wins collapse is deliberately preserved.

| # | Bug | Fix |
|---|---|---|
| 1 | `#include` lines are captured by `load` but silently discarded by `dump` — `ast.nim:126-148` never reads the `includes` key back. Exporting `IEEE_9500` drops all 3 includes, producing an incomplete model. | Writer emits them. |
| 2 | Dotted keys collapse. `rating.summer.continuous` / `.emergency` / `winter.*` become one mangled `'rating': '.winter.emergency 200.00'` — the lexer splits on `.`, then Nim's `JsonNode.add` permits duplicate keys which collapse to the last during `json.loads`. 240 attribute lines across `models/`. | Dotted keys stay whole and distinct. |
| 3 | `class` blocks are parsed into `ast.classes` then never emitted — `ast.nim:262-270` omits them from `toJson`. They vanish on round-trip. | `classes` key added to AST and to writer output. No file in `models/` currently uses `class`; this is forward-looking. |
| 4 | Genuinely repeated attribute keys collapse to last-wins. | **Preserved** — this one is defensible as-is. |

## Writer output format

Section order, mirroring `ast.nim:150-215` with `includes` and `classes` added:

1. `clock { ... };`
2. `#set name=value` — **no trailing semicolon**
3. `#define name=value` — **no trailing semicolon**
4. `#include "value";` — **quoted, with semicolon**
5. `schedule name { ... };`
6. `module name { ... };` (or `module name;` when attribute-less)
7. `class name { ... };`
8. `object type { ... };`, children nested inline

The per-directive punctuation differs and matters. Source models use
`#set relax_naming_rules=1` with no semicolon but `#include "Inverters.glm";`
with both quotes and a semicolon (`IEEE_9500.glm:9-32`). Nim's writer emits a
semicolon for `#set` and drops the quotes for `#include`; the quote loss is
masked today only because includes never reach the writer.

Attribute values are written unquoted — valid GLM and stable through our own
reader. Values containing `;` or a newline are quoted defensively.

## Error handling

`GlmParseError(Exception)` carrying line, column, and the offending source line,
rendering the caret display from `lexer.nim:82-104` **into the exception
message** rather than printing to stderr.

This is a deliberate improvement: `server.py:504-507` wraps handlers in
`except Exception` and builds an HTTP error body, so a parse error surfaces in
the UI instead of vanishing into a terminal nobody is watching.

## Testing

`local-server/tests/test_glmparser.py`, goldens in `local-server/tests/golden/`,
`pytest` added as a `[dependency-groups] dev` entry in
`local-server/pyproject.toml`.

- Every `models/**/*.glm` parses to its committed golden. `uuid4` hoisted-object
  names are normalized to a placeholder before comparison, since they differ per
  run.
- `glm → json → glm → json` is stable (second and third representations match).
- One explicit regression test per fix: includes survive export;
  `rating.summer.continuous` remains a distinct key; `class` blocks reach the AST.
- Malformed input raises `GlmParseError` with the correct line number.

### How goldens get trusted

Goldens cannot simply be dumped from the new parser (that would assert it agrees
with itself) nor from the Nim parser (that output encodes the three bugs being
fixed). The sequence is:

1. A one-off differential script runs both parsers over `models/**/*.glm` and
   diffs, with uuid4 names normalized.
2. Every diff must be individually accounted for as one of the three known fixes.
   Any diff that is not gets investigated as a bug in the new parser.
3. Once the only remaining diffs are the intended ones, the new parser's output
   is frozen as the goldens and committed.
4. The differential script is discarded — it needs Nim, which is the dependency
   being removed. The goldens are the durable artifact.

## Out of scope

- **GridLAB-D semantics.** `#include` files are not resolved or inlined, `${...}`
  is not substituted, macros are not expanded. Values remain opaque strings,
  exactly as today.
- **CLI binaries.** The Nim package shipped `glm2json`/`json2glm`; nothing in
  GLIMPSE invokes them.
- **Deterministic hoisted-object names.** Keeping `uuid4` to match current
  behavior, despite the export churn it causes.
- **Objects-format conversion.** No change to `GraphHelper.setGraphData`.

## Follow-on doc changes

- `README.md:73-199` — remove the Nim prerequisite and the Apple Silicon
  build-from-source section.
- `CLAUDE.md` — update the line describing the parser as "the separate `glm` pip
  package (a Nim binary)".
- `local-server/glm/` is untracked and gitignored; it can simply be deleted
  locally once the cutover lands. No repo change.
