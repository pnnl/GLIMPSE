# Pure-Python GLM Parser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Nim-backed `glm` pip package with a pure-Python `glmparser` module in `local-server/`, removing the Nim toolchain from the from-source build.

**Architecture:** A four-file package — a regex tokenizer streamed through a one-token lookahead buffer, a recursive-descent parser producing the existing AST dict, a writer producing GLM text, and an error type that renders a caret under the offending source line. Public API mirrors the Nim binding (`load`/`loads`/`dump`/`dumps`/`version`) so the single consumer changes by one import line.

**Tech Stack:** Python 3.12+, `re`, `uuid` (all stdlib). `pytest` as a dev-only dependency. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-08-05-python-glm-parser-design.md`

## Pre-verification

The module code in Tasks 1–7 was assembled and run against the real corpus
before this plan was written. Measured results, which the implementer should
expect to reproduce:

- **Nim differential: 0 unexpected diffs across all 17 `models/**/*.glm`.** The
  only differences are the 60 intended dotted-key fixes (15 objects × 4 files).
- **Round-trip stable** on all 17 models.
- **Speed:** `ieee8500.glm` 196 ms vs Nim's 180 ms; `IEEE_9500.glm` 181 ms vs
  163 ms. Within ~10% — the streaming lexer trades a little throughput against
  the materialized-list prototype for a large memory win.
- **Peak memory: 17.0 MB** on a 2.2 MB model, down from 61.6 MB for the
  materialized-list prototype.

Three bugs were found and fixed during that verification. All three are now
baked into the task code with tests pinning them; do not "simplify" them back
out:

1. `${VSOURCE}` lexing as `word`/`lbrace`/`word`/`rbrace` — the stray `rbrace`
   closed the enclosing object early and corrupted every following attribute.
   Broke 6 of 17 models.
2. `_value_to_eol` slicing to the newline swallowed trailing `//` comments into
   directive values.
3. The first fix, written as a per-character alternation, cost ~25% throughput;
   the two-branch form in Task 2 restores it.

## Global Constraints

Every task's requirements implicitly include this section.

- **Module name is `glmparser`, never `glm`.** `.gitignore:15` contains `**/glm`; a package named `glm` will not be committed.
- **The AST dict shape is a hard contract.** `server.py:498-502` ships it to the frontend, `GraphHelper.js:1676` reads `obj.name` as object type and `attributes.name` as node id, `GraphHelper.js:1661` posts the whole dict back to `/api/export/glm`. Keys: `clock`, `includes`, `objects`, `modules`, `classes`, `directives`, `definitions`, `schedules`.
- **`clock` is always present**, `{}` when the model has none.
- **`load` and `dump` must accept both a path and an open file object.** `glmhelper.py:23` passes a path to `load`; `glmhelper.py:33` passes an open file to `dump`.
- **Attribute values are sliced from the source string by offset, never re-joined from token text.** Re-joining with a separator corrupts `${VSOURCE}` into `$ {VSOURCE}`; re-joining without one corrupts multi-word values.
- **Two distinct value terminators.** Attribute values inside a block run to the next `;`. `#set`/`#define`/`#include` run to **end of line**.
- **Directive punctuation differs.** Write `#set name=value` and `#define name=value` with no trailing semicolon; write `#include "value";` with quotes and a semicolon.
- **Preserve `uuid4` hoisting** of anonymous nested objects and **last-wins** collapse of genuinely duplicate attribute keys.
- **Python >= 3.12** (`local-server/pyproject.toml` `requires-python`).
- All `pytest` commands run from the `local-server/` directory.

---

## File Structure

| File | Responsibility |
|---|---|
| `local-server/glmparser/__init__.py` | Public API only: `load`, `loads`, `dump`, `dumps`, `version`, `GlmParseError` |
| `local-server/glmparser/errors.py` | `GlmParseError` — offset → line/column, caret rendering |
| `local-server/glmparser/lexer.py` | Regex scan → `Token` stream with one-token lookahead |
| `local-server/glmparser/parser.py` | Tokens → AST dict |
| `local-server/glmparser/writer.py` | AST dict → GLM text |
| `local-server/tests/test_glmparser.py` | Unit + golden + round-trip tests |
| `local-server/tests/golden/*.json` | Frozen expected parser output |
| `local-server/pyproject.toml` | Add `pytest` dev group + pytest config |
| `local-server/glmhelper.py` | Swap `import glm` for `from glmparser import ...` |
| `README.md`, `CLAUDE.md` | Drop the Nim prerequisite |

---

### Task 1: Package scaffold, error type, pytest wiring

**Files:**
- Create: `local-server/glmparser/__init__.py`
- Create: `local-server/glmparser/errors.py`
- Create: `local-server/tests/test_glmparser.py`
- Modify: `local-server/pyproject.toml`

**Interfaces:**
- Consumes: nothing.
- Produces: `GlmParseError(message: str, source: str = "", offset: int | None = None)` with attributes `raw_message: str`, `source: str`, `offset: int | None`, `line: int | None` (1-based), `column: int | None` (0-based). `str(err)` renders the caret block.

- [ ] **Step 1: Add pytest config and dev group to `local-server/pyproject.toml`**

Append these two blocks to the end of the file:

```toml
[dependency-groups]
dev = ["pytest>=8.0"]

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
```

`pythonpath = ["."]` lets the tests import `glmparser` from the flat `local-server/` layout without an install step.

- [ ] **Step 2: Install pytest**

```bash
cd local-server && uv sync --group dev
```

If `uv` is unavailable, use `.venv/bin/pip install "pytest>=8.0"` instead.

- [ ] **Step 3: Write the failing test**

Create `local-server/tests/test_glmparser.py`:

```python
"""Tests for the pure-Python GLM parser."""
import pytest

from glmparser.errors import GlmParseError


def test_error_computes_line_and_column_from_offset():
    source = "object node {\n  name foo;\n  bad!\n}\n"
    offset = source.index("bad!")
    err = GlmParseError("Unexpected token", source, offset)
    assert err.line == 3
    assert err.column == 2


def test_error_renders_caret_under_offending_column():
    source = "object node {\n  name foo;\n  bad!\n}\n"
    err = GlmParseError("Unexpected token", source, source.index("bad!"))
    rendered = str(err)
    assert "line: 3" in rendered
    assert "column: 2" in rendered
    assert "Unexpected token" in rendered
    # the caret sits directly beneath the first bad character
    lines = rendered.splitlines()
    caret_line = next(l for l in lines if l.strip() == "^")
    assert caret_line.index("^") == 2


def test_error_without_offset_is_plain_message():
    err = GlmParseError("something broke")
    assert str(err) == "something broke"
    assert err.line is None


def test_caret_prefix_preserves_tabs_for_alignment():
    source = "object node {\n\t\tbad!\n}\n"
    err = GlmParseError("nope", source, source.index("bad!"))
    caret_line = next(l for l in str(err).splitlines() if l.strip() == "^")
    # tabs are copied through so the caret aligns at any tab width
    assert caret_line == "\t\t^"
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
cd local-server && .venv/bin/python -m pytest tests/test_glmparser.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'glmparser'`

- [ ] **Step 5: Create the package `__init__.py`**

Create `local-server/glmparser/__init__.py`:

```python
"""Pure-Python GridLAB-D .glm parser.

Drop-in replacement for the Nim-backed `glm` pip package. The public surface is
`load`/`loads`/`dump`/`dumps`/`version`, matching what glmhelper.py calls.
"""

__version__ = "1.0.0"

__all__ = ["version"]


def version():
    return __version__
```

The remaining exports get added in Task 7, once the pieces they re-export exist.

- [ ] **Step 6: Implement `errors.py`**

Create `local-server/glmparser/errors.py`:

```python
"""Parse errors carrying enough context to point at the offending source line."""


class GlmParseError(Exception):
    """Raised when GLM source cannot be parsed.

    The rendered caret block goes into the exception message rather than to
    stderr: server.py wraps route handlers in `except Exception` and puts the
    message into the HTTP error body, so this is what reaches the UI.
    """

    def __init__(self, message, source="", offset=None):
        self.raw_message = message
        self.source = source
        self.offset = offset
        self.line = None
        self.column = None

        if offset is not None and source:
            self.line = source.count("\n", 0, offset) + 1
            self.column = offset - (source.rfind("\n", 0, offset) + 1)

        super().__init__(self._render())

    def _render(self):
        if self.line is None:
            return self.raw_message

        lines = self.source.splitlines()
        out = [
            f"ParserError: [line: {self.line}, column: {self.column}] "
            f"{self.raw_message}"
        ]

        if self.line - 2 >= 0:
            out.append(lines[self.line - 2])

        bad = lines[self.line - 1]
        out.append(bad)
        # Copy tabs through verbatim so the caret lands correctly at any tab width.
        out.append(
            "".join("\t" if c == "\t" else " " for c in bad[: self.column]) + "^"
        )

        if self.line < len(lines):
            out.append(lines[self.line])

        return "\n".join(out)
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd local-server && .venv/bin/python -m pytest tests/test_glmparser.py -v
```

Expected: 4 passed

- [ ] **Step 8: Commit**

```bash
git add local-server/glmparser/ local-server/tests/ local-server/pyproject.toml
git commit -m "feat(glmparser): add package scaffold, error type, pytest wiring"
```

---

### Task 2: Lexer

**Files:**
- Create: `local-server/glmparser/lexer.py`
- Modify: `local-server/tests/test_glmparser.py`

**Interfaces:**
- Consumes: `GlmParseError` from Task 1.
- Produces:
  - `EOF: str` — the sentinel token kind, value `"eof"`.
  - `Token` with slots `kind: str`, `text: str`, `start: int`, `end: int`. `start`/`end` are offsets of the **whole match** (so a `hash` token starts at `#`).
  - `Lexer(source: str)` with `peek() -> Token`, `next() -> Token`, `error(message: str, token: Token | None = None) -> GlmParseError`.
  - Token kinds: `"hash"`, `"kw"`, `"lbrace"`, `"rbrace"`, `"semi"`, `"word"`, `EOF`.

- [ ] **Step 1: Write the failing tests**

Append to `local-server/tests/test_glmparser.py`:

```python
from glmparser.lexer import EOF, Lexer


def kinds(source):
    lex = Lexer(source)
    out = []
    while lex.peek().kind != EOF:
        tok = lex.next()
        out.append((tok.kind, tok.text))
    return out


def test_lexer_tokenizes_an_object_block():
    assert kinds("object node { name foo; }") == [
        ("kw", "object"),
        ("word", "node"),
        ("lbrace", "{"),
        ("word", "name"),
        ("word", "foo"),
        ("semi", ";"),
        ("rbrace", "}"),
    ]


def test_lexer_discards_line_comments():
    assert kinds("name foo; // trailing comment\nname bar;") == [
        ("word", "name"),
        ("word", "foo"),
        ("semi", ";"),
        ("word", "name"),
        ("word", "bar"),
        ("semi", ";"),
    ]


def test_lexer_recognizes_hash_directives_without_the_hash_in_text():
    assert kinds("#set profiler=1") == [("hash", "set"), ("word", "profiler=1")]
    assert kinds("#define VSOURCE=1") == [("hash", "define"), ("word", "VSOURCE=1")]
    assert kinds('#include "a.glm";') == [
        ("hash", "include"),
        ("word", '"a.glm"'),
        ("semi", ";"),
    ]


def test_hash_token_offsets_start_at_the_pound_sign():
    lex = Lexer("#set profiler=1")
    tok = lex.peek()
    assert tok.kind == "hash"
    assert tok.start == 0          # points at '#', not at 's'
    assert tok.end == len("#set")


def test_lexer_peek_does_not_consume():
    lex = Lexer("object node")
    assert lex.peek().text == "object"
    assert lex.peek().text == "object"
    assert lex.next().text == "object"
    assert lex.peek().text == "node"


def test_lexer_returns_eof_forever_past_the_end():
    lex = Lexer("name")
    lex.next()
    assert lex.next().kind == EOF
    assert lex.next().kind == EOF
    assert lex.peek().kind == EOF


def test_keywords_only_match_as_whole_words():
    # `object_name` must not lex as the `object` keyword plus `_name`
    assert kinds("object_name foo;") == [
        ("word", "object_name"),
        ("word", "foo"),
        ("semi", ";"),
    ]


def test_dollar_brace_substitution_is_one_token():
    # CRITICAL: if `${VSOURCE}` lexes as word/lbrace/word/rbrace, that rbrace
    # closes the enclosing object early and every later attribute is corrupted.
    # This breaks 6 of the 17 sample models.
    assert kinds("positive_sequence_voltage ${VSOURCE};") == [
        ("word", "positive_sequence_voltage"),
        ("word", "${VSOURCE}"),
        ("semi", ";"),
    ]


def test_substitution_adjacent_to_text_still_covers_the_source():
    # Split across tokens is fine -- the parser slices source by offset, which
    # rejoins them -- but no brace may leak out as an lbrace/rbrace token.
    assert [k for k, _ in kinds("prefix${A}suffix;")] == ["word", "word", "word", "semi"]


def test_urls_are_not_mistaken_for_comments():
    # `//` after a colon is part of a URL, not a comment. lexer.nim:218 does the
    # same check.
    assert kinds("#define stylesheet=http://example.org/gridlabd") == [
        ("hash", "define"),
        ("word", "stylesheet=http://example.org/gridlabd"),
    ]


def test_lexer_error_carries_position():
    lex = Lexer("object node {\n  bad\n}")
    lex.next()
    err = lex.error("boom")
    assert err.line == 1
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd local-server && .venv/bin/python -m pytest tests/test_glmparser.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'glmparser.lexer'`

- [ ] **Step 3: Implement `lexer.py`**

Create `local-server/glmparser/lexer.py`:

```python
"""Streaming tokenizer for GridLAB-D .glm source.

One regex pass over the source, pulled through a single-token lookahead buffer.
Whitespace is skipped rather than tokenized -- the Nim implementation this
replaces heap-allocated a token object per space and newline, which is where
most of its runtime went.
"""
import re

from .errors import GlmParseError

# Order matters. Comments come first so `//` never lexes as two `word` tokens,
# and keywords precede `word` so the catch-all does not swallow them.
#
# Two subtleties, both load-bearing -- see the tests that pin them:
#
# `(?<!:)` keeps `http://host/path` from being read as a comment. The Nim lexer
# special-cased this the same way (lexer.nim:218).
#
# The `word` group leads with `\$\{[^}]*\}` so a `${VSOURCE}` substitution stays
# one token. Without it the braces lex as lbrace/rbrace and the rbrace silently
# closes the enclosing block early, corrupting every attribute after it. The
# alternation is deliberately two cheap branches rather than a per-character
# loop; the loop form costs ~25% throughput.
_TOKEN_RE = re.compile(
    r"""
      (?<!:)//[^\n]*                              # line comment (discarded)
    | \#[ \t]*(?P<hash>set|define|include)\b
    | \b(?P<kw>clock|module|object|class|schedule)\b
    | (?P<lbrace>\{)
    | (?P<rbrace>\})
    | (?P<semi>;)
    | (?P<word>\$\{[^}]*\}|[^\s{};]+)             # substitution, or identifier/value
    """,
    re.VERBOSE,
)

EOF = "eof"


class Token:
    __slots__ = ("kind", "text", "start", "end")

    def __init__(self, kind, text, start, end):
        self.kind = kind
        self.text = text
        self.start = start
        self.end = end

    def __repr__(self):
        return f"Token({self.kind!r}, {self.text!r}, {self.start})"


class Lexer:
    """Pull-based token stream with exactly one token of lookahead.

    One token is all the parser ever needs, which is what lets this stay a
    generator instead of a materialized list -- the list costs ~62 MB on a
    2.2 MB model.
    """

    def __init__(self, source):
        self.source = source
        self._matches = _TOKEN_RE.finditer(source)
        self._current = self._scan()

    def _scan(self):
        for match in self._matches:
            kind = match.lastgroup
            if kind is None:  # a comment; skip it
                continue
            # Offsets span the whole match, so a `hash` token starts at '#'.
            return Token(kind, match.group(kind), match.start(), match.end())
        end = len(self.source)
        return Token(EOF, "", end, end)

    def peek(self):
        return self._current

    def next(self):
        token = self._current
        if token.kind != EOF:
            self._current = self._scan()
        return token

    def error(self, message, token=None):
        target = token if token is not None else self._current
        return GlmParseError(message, self.source, target.start)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd local-server && .venv/bin/python -m pytest tests/test_glmparser.py -v
```

Expected: 15 passed

- [ ] **Step 5: Commit**

```bash
git add local-server/glmparser/lexer.py local-server/tests/test_glmparser.py
git commit -m "feat(glmparser): add streaming regex lexer"
```

---

### Task 3: Parser — clock, module, class, directives

**Files:**
- Create: `local-server/glmparser/parser.py`
- Modify: `local-server/tests/test_glmparser.py`

**Interfaces:**
- Consumes: `Lexer`, `EOF`, `Token` from Task 2; `GlmParseError` from Task 1.
- Produces: `Parser(source: str)` with `parse() -> dict`. Internal helpers that Tasks 4 and 5 build on:
  - `_expect(kind: str) -> Token`
  - `_value_to_semicolon() -> str`
  - `_value_to_eol() -> str`
  - `_attributes(children: list | None = None) -> dict`
  - `_named_block() -> dict` — returns `{"name": str, "attributes": dict}`

- [ ] **Step 1: Write the failing tests**

Append to `local-server/tests/test_glmparser.py`:

```python
from glmparser.parser import Parser


def parse(source):
    return Parser(source).parse()


def test_empty_source_yields_the_full_ast_skeleton():
    ast = parse("")
    assert ast == {
        "clock": {},
        "includes": [],
        "objects": [],
        "modules": [],
        "classes": [],
        "directives": [],
        "definitions": [],
        "schedules": [],
    }


def test_clock_block_parses_to_a_flat_dict():
    ast = parse("clock {\n  timezone PST+8PDT;\n  starttime '2000-01-01 0:00:00';\n};")
    assert ast["clock"] == {
        "timezone": "PST+8PDT",
        "starttime": "2000-01-01 0:00:00",
    }


def test_module_with_no_attributes():
    assert parse("module powerflow;")["modules"] == [
        {"name": "powerflow", "attributes": {}}
    ]


def test_module_with_attributes():
    ast = parse("module powerflow {\n  solver_method NR;\n  lu_solver KLU;\n};")
    assert ast["modules"] == [
        {
            "name": "powerflow",
            "attributes": {"solver_method": "NR", "lu_solver": "KLU"},
        }
    ]


def test_class_blocks_reach_the_ast():
    # REGRESSION: the Nim parser collected classes then never emitted them.
    ast = parse("class thermostat {\n  double setpoint;\n};")
    assert ast["classes"] == [
        {"name": "thermostat", "attributes": {"double": "setpoint"}}
    ]


def test_set_and_define_directives_are_newline_terminated():
    # REGRESSION: running these to the next `;` makes them swallow later lines.
    ast = parse("#set relax_naming_rules=1\n#set profiler=1\n\nmodule tape;\n")
    assert ast["directives"] == [
        {"name": "relax_naming_rules", "value": "1"},
        {"name": "profiler", "value": "1"},
    ]
    assert ast["modules"] == [{"name": "tape", "attributes": {}}]


def test_define_directive():
    ast = parse('#define VSOURCE=69715.045\n#include "Rotating_Machines.glm";\n')
    assert ast["definitions"] == [{"name": "VSOURCE", "value": "69715.045"}]
    assert ast["includes"] == [{"value": "Rotating_Machines.glm"}]


def test_include_strips_quotes_and_semicolon():
    ast = parse('#include "Inverters.glm";\n#include "Recorders.glm";\n')
    assert ast["includes"] == [
        {"value": "Inverters.glm"},
        {"value": "Recorders.glm"},
    ]


def test_directive_value_stops_before_a_trailing_comment():
    # Slicing raw source to the newline drags the comment into the value.
    ast = parse(
        "#set deltamode_timestep=100000000\t\t//100 ms\n"
        "#set deltamode_iteration_limit=10\t//Iteration limit\n"
    )
    assert ast["directives"] == [
        {"name": "deltamode_timestep", "value": "100000000"},
        {"name": "deltamode_iteration_limit", "value": "10"},
    ]


def test_substitution_inside_an_attribute_value_does_not_close_the_block():
    # The `}` in `${VSOURCE}` must not terminate the enclosing block.
    ast = parse(
        "module powerflow {\n"
        "  positive_sequence_voltage ${VSOURCE};\n"
        "  solver_method NR;\n"
        "};"
    )
    assert ast["modules"][0]["attributes"] == {
        "positive_sequence_voltage": "${VSOURCE}",
        "solver_method": "NR",
    }


def test_multi_word_and_substitution_values_are_preserved_exactly():
    ast = parse(
        "module m {\n"
        "  positive_sequence_voltage ${VSOURCE};\n"
        "  rating .winter.emergency 200.00;\n"
        "};"
    )
    assert ast["modules"][0]["attributes"]["positive_sequence_voltage"] == "${VSOURCE}"
    assert ast["modules"][0]["attributes"]["rating"] == ".winter.emergency 200.00"


def test_dotted_attribute_keys_stay_distinct():
    # REGRESSION: the Nim parser collapsed all four into one mangled `rating`.
    ast = parse(
        "module m {\n"
        "  rating.summer.continuous 200.00;\n"
        "  rating.summer.emergency 210.00;\n"
        "  rating.winter.continuous 220.00;\n"
        "  rating.winter.emergency 230.00;\n"
        "};"
    )
    assert ast["modules"][0]["attributes"] == {
        "rating.summer.continuous": "200.00",
        "rating.summer.emergency": "210.00",
        "rating.winter.continuous": "220.00",
        "rating.winter.emergency": "230.00",
    }


def test_duplicate_keys_collapse_last_wins():
    ast = parse("module m {\n  phases A;\n  phases B;\n};")
    assert ast["modules"][0]["attributes"] == {"phases": "B"}


def test_comments_are_ignored():
    ast = parse("// leading comment\nmodule tape; // trailing\n")
    assert ast["modules"] == [{"name": "tape", "attributes": {}}]


def test_unknown_top_level_token_raises_with_line_number():
    with pytest.raises(GlmParseError) as excinfo:
        parse("module tape;\ngarbage\n")
    assert excinfo.value.line == 2


def test_unterminated_block_raises():
    with pytest.raises(GlmParseError):
        parse("module powerflow {\n  solver_method NR;\n")
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd local-server && .venv/bin/python -m pytest tests/test_glmparser.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'glmparser.parser'`

- [ ] **Step 3: Implement `parser.py`**

Create `local-server/glmparser/parser.py`:

```python
"""GLM source -> AST dict.

The output shape is a hard contract. server.py ships this dict straight to the
frontend, GraphHelper.js reads `name` and `attributes` off each object, and the
same dict comes back through /api/export/glm for writing. Every key must
survive the round-trip.
"""
import uuid

from .lexer import EOF, Lexer

# A value stops at any of these; `rbrace` and EOF are tolerated so a final
# attribute missing its semicolon does not run away.
_VALUE_END = (EOF, "rbrace", "semi")


class Parser:
    def __init__(self, source):
        self.source = source
        self.lex = Lexer(source)
        self.ast = {
            "clock": {},
            "includes": [],
            "objects": [],
            "modules": [],
            "classes": [],
            "directives": [],
            "definitions": [],
            "schedules": [],
        }

    # ---- helpers -------------------------------------------------------

    def _expect(self, kind):
        token = self.lex.next()
        if token.kind != kind:
            raise self.lex.error(f"Expected {kind}, found {token.text!r}", token)
        return token

    def _value_to_semicolon(self):
        """Attribute values run to the next `;`.

        Sliced out of the source rather than re-joined from token text, so
        internal spacing survives exactly: `${VSOURCE}` and `1.0 + 2.0j` both
        come back byte-for-byte.
        """
        token = self.lex.peek()
        if token.kind in _VALUE_END:
            if token.kind == "semi":
                self.lex.next()
            return ""

        start = token.start
        end = start
        while self.lex.peek().kind not in _VALUE_END:
            end = self.lex.next().end
        if self.lex.peek().kind == "semi":
            self.lex.next()
        return self.source[start:end].strip("'\" \t\n")

    def _value_to_eol(self):
        """`#set`/`#define`/`#include` run to end of line, not to a `;`.

        Conflating this with `_value_to_semicolon` makes a directive swallow
        every line beneath it until the next semicolon appears.

        The slice ends at the last *token* consumed rather than at the newline.
        That matters: slicing to the newline drags in a trailing `//` comment,
        because the lexer discards comments but raw source still contains them.
        `#set deltamode_timestep=100000000\t//100 ms` would otherwise yield the
        value `100000000\t\t//100 ms`.
        """
        start = self.lex.peek().start
        newline = self.source.find("\n", start)
        if newline == -1:
            newline = len(self.source)
        end = start
        while self.lex.peek().kind != EOF and self.lex.peek().start < newline:
            end = self.lex.next().end
        return self.source[start:end].strip().rstrip(";").strip("'\" ")

    def _attributes(self, children=None):
        """Parse `{ key value; ... }`.

        `children` collects bare nested objects; pass None where nesting is not
        legal (clock, module, class).
        """
        self._expect("lbrace")
        attrs = {}

        while True:
            token = self.lex.peek()

            if token.kind == "rbrace":
                self.lex.next()
                break
            if token.kind == EOF:
                raise self.lex.error("Unexpected end of file inside block", token)
            if token.kind == "semi":
                self.lex.next()
                continue

            # `object child { ... };` nested bare -> the parent's children list
            if token.kind == "kw" and token.text == "object":
                if children is None:
                    raise self.lex.error("Nested object not allowed here", token)
                self.lex.next()
                children.append(self._object())
                continue

            key = self.lex.next().text

            # `configuration object line_conf { ... };` -> hoisted to top-level
            # `objects` under a generated name, which the parent keeps as its
            # attribute value. Frontend edge wiring resolves those references,
            # so this behavior is load-bearing.
            following = self.lex.peek()
            if following.kind == "kw" and following.text == "object":
                self.lex.next()
                child = self._object()
                generated = str(uuid.uuid4())
                child["attributes"]["name"] = generated
                self.ast["objects"].append(child)
                attrs[key] = generated
            else:
                attrs[key] = self._value_to_semicolon()

        if self.lex.peek().kind == "semi":
            self.lex.next()
        return attrs

    def _named_block(self):
        """`module powerflow;` or `module powerflow { ... };`. Also `class`."""
        name = self._expect("word").text
        if self.lex.peek().kind == "semi":
            self.lex.next()
            return {"name": name, "attributes": {}}
        return {"name": name, "attributes": self._attributes()}

    def _directive(self, which):
        if which == "include":
            self.ast["includes"].append({"value": self._value_to_eol()})
            return
        body = self._value_to_eol()
        name, _, value = body.partition("=")
        entry = {"name": name.strip(), "value": value.strip().strip("'\" ")}
        self.ast["directives" if which == "set" else "definitions"].append(entry)

    # ---- entry point ---------------------------------------------------

    def parse(self):
        while True:
            token = self.lex.next()

            if token.kind == EOF:
                break
            if token.kind == "semi":
                continue

            if token.kind == "kw":
                if token.text == "clock":
                    self.ast["clock"] = self._attributes()
                elif token.text == "object":
                    self.ast["objects"].append(self._object())
                elif token.text == "schedule":
                    self.ast["schedules"].append(self._schedule())
                elif token.text == "module":
                    self.ast["modules"].append(self._named_block())
                elif token.text == "class":
                    self.ast["classes"].append(self._named_block())
            elif token.kind == "hash":
                self._directive(token.text)
            else:
                raise self.lex.error(f"Unexpected token {token.text!r}", token)

        return self.ast
```

Note: `_object` and `_schedule` are referenced here but land in Tasks 4 and 5. The tests in this task do not exercise either path.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd local-server && .venv/bin/python -m pytest tests/test_glmparser.py -v
```

Expected: 31 passed

- [ ] **Step 5: Commit**

```bash
git add local-server/glmparser/parser.py local-server/tests/test_glmparser.py
git commit -m "feat(glmparser): parse clock, module, class, and directives"
```

---

### Task 4: Parser — objects, nesting, and anonymous hoisting

**Files:**
- Modify: `local-server/glmparser/parser.py`
- Modify: `local-server/tests/test_glmparser.py`

**Interfaces:**
- Consumes: `_attributes`, `_expect` from Task 3.
- Produces: `Parser._object() -> dict` returning `{"name": str, "attributes": dict, "children": list}`.

- [ ] **Step 1: Write the failing tests**

Append to `local-server/tests/test_glmparser.py`:

```python
import re

UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


def test_simple_object():
    ast = parse("object node {\n  name n1;\n  phases ABC;\n};")
    assert ast["objects"] == [
        {
            "name": "node",
            "attributes": {"name": "n1", "phases": "ABC"},
            "children": [],
        }
    ]


def test_object_type_may_carry_a_colon_id():
    ast = parse("object node:12 {\n  name n1;\n};")
    assert ast["objects"][0]["name"] == "node:12"


def test_bare_nested_object_becomes_a_child():
    ast = parse(
        "object house {\n"
        "  name h1;\n"
        "  object ZIPload {\n"
        "    name z1;\n"
        "  };\n"
        "};"
    )
    assert len(ast["objects"]) == 1
    parent = ast["objects"][0]
    assert parent["attributes"] == {"name": "h1"}
    assert parent["children"] == [
        {"name": "ZIPload", "attributes": {"name": "z1"}, "children": []}
    ]


def test_anonymous_object_is_hoisted_and_referenced_by_generated_name():
    ast = parse(
        "object overhead_line {\n"
        "  name line1;\n"
        "  configuration object line_configuration {\n"
        "    name lc1;\n"
        "  };\n"
        "};"
    )
    # parent stays at index 0 only after the hoisted child is appended
    parent = next(o for o in ast["objects"] if o["name"] == "overhead_line")
    hoisted = next(o for o in ast["objects"] if o["name"] == "line_configuration")

    assert len(ast["objects"]) == 2
    assert parent["children"] == []

    generated = parent["attributes"]["configuration"]
    assert UUID_RE.match(generated)
    # the generated name is what links parent to hoisted child
    assert hoisted["attributes"]["name"] == generated


def test_deeply_nested_objects_recurse():
    ast = parse(
        "object a {\n"
        "  name a1;\n"
        "  object b {\n"
        "    name b1;\n"
        "    object c {\n"
        "      name c1;\n"
        "    };\n"
        "  };\n"
        "};"
    )
    a = ast["objects"][0]
    b = a["children"][0]
    c = b["children"][0]
    assert (a["name"], b["name"], c["name"]) == ("a", "b", "c")
    assert c["attributes"] == {"name": "c1"}


def test_object_missing_opening_brace_raises():
    with pytest.raises(GlmParseError):
        parse("object node\n  name n1;\n};")
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd local-server && .venv/bin/python -m pytest tests/test_glmparser.py -v
```

Expected: FAIL — `AttributeError: 'Parser' object has no attribute '_object'`

- [ ] **Step 3: Implement `_object`**

In `local-server/glmparser/parser.py`, insert this method immediately after `_attributes` and before `_named_block`:

```python
    def _object(self):
        """`object <type> { ... };` -- the type may carry `.` or `:` suffixes."""
        name = self._expect("word").text
        children = []
        attributes = self._attributes(children)
        return {"name": name, "attributes": attributes, "children": children}
```

The `word` token pattern is `[^\s{};]+`, so `node:12` and `node.sub` already arrive as single tokens — no extra suffix handling is needed.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd local-server && .venv/bin/python -m pytest tests/test_glmparser.py -v
```

Expected: 37 passed

- [ ] **Step 5: Commit**

```bash
git add local-server/glmparser/parser.py local-server/tests/test_glmparser.py
git commit -m "feat(glmparser): parse objects, nesting, and anonymous hoisting"
```

---

### Task 5: Parser — schedules

**Files:**
- Modify: `local-server/glmparser/parser.py`
- Modify: `local-server/tests/test_glmparser.py`

**Interfaces:**
- Consumes: `_expect`, `_value_to_semicolon` from Task 3.
- Produces: `Parser._schedule() -> dict` returning `{"name": str, "values": list[str], "children": list[list[str]]}`.

- [ ] **Step 1: Write the failing tests**

Append to `local-server/tests/test_glmparser.py`:

```python
def test_flat_schedule():
    ast = parse(
        "schedule office_lights {\n"
        "  * 9-17 * * 1-5 1.0;\n"
        "  * 18-8 * * 1-5 0.1;\n"
        "};"
    )
    assert ast["schedules"] == [
        {
            "name": "office_lights",
            "values": ["* 9-17 * * 1-5 1.0", "* 18-8 * * 1-5 0.1"],
            "children": [],
        }
    ]


def test_schedule_with_sub_blocks():
    ast = parse(
        "schedule s {\n"
        "  {\n"
        "    * 9-17 * * 1-5 1.0;\n"
        "    * 18-8 * * 1-5 0.1;\n"
        "  }\n"
        "  {\n"
        "    * * * * 6-0 0.5;\n"
        "  }\n"
        "};"
    )
    assert ast["schedules"][0]["name"] == "s"
    assert ast["schedules"][0]["values"] == []
    assert ast["schedules"][0]["children"] == [
        ["* 9-17 * * 1-5 1.0", "* 18-8 * * 1-5 0.1"],
        ["* * * * 6-0 0.5"],
    ]


def test_schedule_value_without_trailing_semicolon_still_terminates():
    ast = parse("schedule s {\n  * * * * * 1.0\n};")
    assert ast["schedules"][0]["values"] == ["* * * * * 1.0"]


def test_unterminated_schedule_raises():
    with pytest.raises(GlmParseError):
        parse("schedule s {\n  * * * * * 1.0;\n")
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd local-server && .venv/bin/python -m pytest tests/test_glmparser.py -v -k schedule
```

Expected: FAIL — `AttributeError: 'Parser' object has no attribute '_schedule'`

- [ ] **Step 3: Implement `_schedule`**

In `local-server/glmparser/parser.py`, insert this method immediately after `_object`:

```python
    def _schedule(self):
        """`schedule <name> { ... };` with optional `{ ... }` sub-blocks.

        Values are opaque cron-ish strings; nothing here interprets them.
        """
        name = self._expect("word").text
        self._expect("lbrace")
        values = []
        groups = []

        while True:
            token = self.lex.peek()

            if token.kind == "rbrace":
                self.lex.next()
                break
            if token.kind == EOF:
                raise self.lex.error("Unexpected end of file inside schedule", token)
            if token.kind == "semi":
                self.lex.next()
                continue

            if token.kind == "lbrace":
                self.lex.next()
                group = []
                while self.lex.peek().kind not in ("rbrace", EOF):
                    if self.lex.peek().kind == "semi":
                        self.lex.next()
                        continue
                    group.append(self._value_to_semicolon())
                self._expect("rbrace")
                groups.append(group)
                continue

            values.append(self._value_to_semicolon())

        if self.lex.peek().kind == "semi":
            self.lex.next()
        return {"name": name, "values": values, "children": groups}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd local-server && .venv/bin/python -m pytest tests/test_glmparser.py -v
```

Expected: 41 passed

- [ ] **Step 5: Commit**

```bash
git add local-server/glmparser/parser.py local-server/tests/test_glmparser.py
git commit -m "feat(glmparser): parse schedules and sub-schedule blocks"
```

---

### Task 6: Writer

**Files:**
- Create: `local-server/glmparser/writer.py`
- Modify: `local-server/tests/test_glmparser.py`

**Interfaces:**
- Consumes: nothing (takes a plain AST dict).
- Produces: `dumps(data: dict) -> str`.

- [ ] **Step 1: Write the failing tests**

Append to `local-server/tests/test_glmparser.py`:

```python
from glmparser.writer import dumps as write_glm


def test_writes_clock_and_object():
    text = write_glm(
        {
            "clock": {"timezone": "PST+8PDT"},
            "objects": [
                {"name": "node", "attributes": {"name": "n1"}, "children": []}
            ],
        }
    )
    assert "clock {" in text
    assert "\ttimezone PST+8PDT;" in text
    assert "object node {" in text
    assert "\tname n1;" in text


def test_set_and_define_carry_no_semicolon():
    text = write_glm(
        {
            "directives": [{"name": "profiler", "value": "1"}],
            "definitions": [{"name": "VSOURCE", "value": "69715.045"}],
        }
    )
    assert "#set profiler=1\n" in text
    assert "#set profiler=1;" not in text
    assert "#define VSOURCE=69715.045\n" in text
    assert "#define VSOURCE=69715.045;" not in text


def test_include_is_quoted_and_semicolon_terminated():
    # REGRESSION: the Nim writer dropped includes entirely, so exported models
    # lost their #include lines. It also would have dropped the quotes.
    text = write_glm({"includes": [{"value": "Inverters.glm"}]})
    assert '#include "Inverters.glm";\n' in text


def test_module_without_attributes_uses_short_form():
    text = write_glm({"modules": [{"name": "tape", "attributes": {}}]})
    assert "module tape;\n" in text
    assert "module tape {" not in text


def test_classes_are_written():
    text = write_glm(
        {"classes": [{"name": "thermostat", "attributes": {"double": "setpoint"}}]}
    )
    assert "class thermostat {" in text
    assert "\tdouble setpoint;" in text


def test_nested_children_are_indented_inside_the_parent():
    text = write_glm(
        {
            "objects": [
                {
                    "name": "house",
                    "attributes": {"name": "h1"},
                    "children": [
                        {
                            "name": "ZIPload",
                            "attributes": {"name": "z1"},
                            "children": [],
                        }
                    ],
                }
            ]
        }
    )
    assert "\tobject ZIPload {" in text
    assert "\t\tname z1;" in text


def test_schedule_with_sub_blocks_round_trips_shape():
    text = write_glm(
        {
            "schedules": [
                {"name": "s", "values": ["* * * * * 1.0"], "children": [["* * * * 6-0 0.5"]]}
            ]
        }
    )
    assert "schedule s {" in text
    assert "\t* * * * * 1.0;" in text
    assert "\t{\n" in text
    assert "\t\t* * * * 6-0 0.5;" in text


def test_values_containing_semicolons_are_quoted():
    text = write_glm(
        {"objects": [{"name": "n", "attributes": {"weird": "a;b"}, "children": []}]}
    )
    assert '\tweird "a;b";' in text


def test_missing_keys_are_tolerated():
    # the frontend may post back a dict lacking sections it never touched
    assert write_glm({}) == ""
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd local-server && .venv/bin/python -m pytest tests/test_glmparser.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'glmparser.writer'`

- [ ] **Step 3: Implement `writer.py`**

Create `local-server/glmparser/writer.py`:

```python
"""AST dict -> GLM text.

Section order and punctuation follow the source models rather than the Nim
writer this replaces: `#set x=1` carries no semicolon, `#include "f.glm";`
carries both quotes and one. The Nim version got both wrong, which stayed
invisible only because it never emitted includes at all.
"""

_INDENT = "\t"


def _quote_if_needed(value):
    text = str(value)
    if ";" in text or "\n" in text:
        return '"' + text.replace('"', '\\"') + '"'
    return text


def _attributes(attributes, depth):
    pad = _INDENT * depth
    return "".join(
        f"{pad}{key} {_quote_if_needed(value)};\n" for key, value in attributes.items()
    )


def _named_block(keyword, entry):
    name = entry["name"]
    attributes = entry.get("attributes") or {}
    if not attributes:
        return f"{keyword} {name};\n\n"
    return f"{keyword} {name} {{\n{_attributes(attributes, 1)}}};\n\n"


def _object(obj, depth):
    pad = _INDENT * depth
    body = _attributes(obj.get("attributes") or {}, depth + 1)
    for child in obj.get("children") or []:
        body += _object(child, depth + 1)
    # Blank line only between top-level objects; nested ones stay tight.
    tail = "\n" if depth == 0 else ""
    return f"{pad}object {obj['name']} {{\n{body}{pad}}};\n{tail}"


def _schedule(schedule):
    body = "".join(f"{_INDENT}{value};\n" for value in schedule.get("values") or [])
    for group in schedule.get("children") or []:
        body += f"{_INDENT}{{\n"
        body += "".join(f"{_INDENT * 2}{value};\n" for value in group)
        body += f"{_INDENT}}}\n"
    return f"schedule {schedule['name']} {{\n{body}}};\n\n"


def dumps(data):
    """Render an AST dict as GLM text.

    Every section is optional: the frontend posts back whatever it holds, which
    may omit sections the model never had.
    """
    out = []

    clock = data.get("clock") or {}
    if clock:
        out.append(f"clock {{\n{_attributes(clock, 1)}}};\n\n")

    directives = data.get("directives") or []
    if directives:
        out.extend(f"#set {d['name']}={d['value']}\n" for d in directives)
        out.append("\n")

    definitions = data.get("definitions") or []
    if definitions:
        out.extend(f"#define {d['name']}={d['value']}\n" for d in definitions)
        out.append("\n")

    includes = data.get("includes") or []
    if includes:
        out.extend(f'#include "{inc["value"]}";\n' for inc in includes)
        out.append("\n")

    for schedule in data.get("schedules") or []:
        out.append(_schedule(schedule))

    for module in data.get("modules") or []:
        out.append(_named_block("module", module))

    for klass in data.get("classes") or []:
        out.append(_named_block("class", klass))

    for obj in data.get("objects") or []:
        out.append(_object(obj, 0))

    return "".join(out)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd local-server && .venv/bin/python -m pytest tests/test_glmparser.py -v
```

Expected: 50 passed

- [ ] **Step 5: Commit**

```bash
git add local-server/glmparser/writer.py local-server/tests/test_glmparser.py
git commit -m "feat(glmparser): add GLM writer with correct directive punctuation"
```

---

### Task 7: Public API and round-trip stability

**Files:**
- Modify: `local-server/glmparser/__init__.py`
- Modify: `local-server/tests/test_glmparser.py`

**Interfaces:**
- Consumes: `Parser` (Task 3), `dumps` (Task 6), `GlmParseError` (Task 1).
- Produces: `loads(text) -> dict`, `load(file) -> dict`, `dumps(data) -> str`, `dump(data, file) -> None`, `version() -> str`, and `GlmParseError` re-exported at package level.

- [ ] **Step 1: Write the failing tests**

Append to `local-server/tests/test_glmparser.py`:

```python
import io
from pathlib import Path

import glmparser

REPO_ROOT = Path(__file__).resolve().parents[2]
MODELS = REPO_ROOT / "models"

SAMPLE = """clock {
  timezone PST+8PDT;
};

#set profiler=1

#define VSOURCE=69715.045

#include "Inverters.glm";

module powerflow {
  solver_method NR;
};

module tape;

object node {
  name n1;
  phases ABC;
  object ZIPload {
    name z1;
  };
};
"""


def test_loads_and_dumps_are_exported():
    assert callable(glmparser.load)
    assert callable(glmparser.loads)
    assert callable(glmparser.dump)
    assert callable(glmparser.dumps)
    assert glmparser.version() == "1.0.0"
    assert glmparser.GlmParseError is not None


def test_load_accepts_a_path(tmp_path):
    path = tmp_path / "m.glm"
    path.write_text(SAMPLE)
    assert glmparser.load(path)["modules"][0]["name"] == "powerflow"
    assert glmparser.load(str(path))["modules"][0]["name"] == "powerflow"


def test_load_accepts_an_open_file_object(tmp_path):
    path = tmp_path / "m.glm"
    path.write_text(SAMPLE)
    with open(path) as handle:
        assert glmparser.load(handle)["modules"][0]["name"] == "powerflow"


def test_dump_accepts_a_path(tmp_path):
    path = tmp_path / "out.glm"
    glmparser.dump(glmparser.loads(SAMPLE), path)
    assert "module powerflow {" in path.read_text()


def test_dump_accepts_an_open_file_object():
    # glmhelper.py:33 passes an open file, so this form must work
    buffer = io.StringIO()
    glmparser.dump(glmparser.loads(SAMPLE), buffer)
    assert "module powerflow {" in buffer.getvalue()


def test_round_trip_is_stable():
    first = glmparser.loads(SAMPLE)
    text = glmparser.dumps(first)
    second = glmparser.loads(text)
    assert first == second


def test_round_trip_preserves_includes():
    # REGRESSION: the Nim round-trip silently dropped every #include.
    first = glmparser.loads(SAMPLE)
    second = glmparser.loads(glmparser.dumps(first))
    assert second["includes"] == [{"value": "Inverters.glm"}]


ALL_MODELS = sorted(MODELS.rglob("*.glm"))


@pytest.mark.parametrize(
    "path", ALL_MODELS, ids=lambda p: str(p.relative_to(MODELS))
)
def test_every_sample_model_round_trips_stably(path):
    first = glmparser.load(path)
    second = glmparser.loads(glmparser.dumps(first))
    # uuid4 hoisted names are regenerated on each parse, so compare structure
    assert len(first["objects"]) == len(second["objects"])
    assert [o["name"] for o in first["objects"]] == [
        o["name"] for o in second["objects"]
    ]
    assert first["modules"] == second["modules"]
    assert first["includes"] == second["includes"]
    assert first["directives"] == second["directives"]
    assert first["definitions"] == second["definitions"]
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd local-server && .venv/bin/python -m pytest tests/test_glmparser.py -v
```

Expected: FAIL — `AttributeError: module 'glmparser' has no attribute 'load'`

- [ ] **Step 3: Rewrite `__init__.py` with the full public API**

Replace the entire contents of `local-server/glmparser/__init__.py`:

```python
"""Pure-Python GridLAB-D .glm parser.

Drop-in replacement for the Nim-backed `glm` pip package. The public surface is
`load`/`loads`/`dump`/`dumps`/`version`, matching what glmhelper.py calls.

Both `load` and `dump` accept either a filesystem path or an already-open file
object, because both forms are in use: glmhelper.py:23 passes a path to `load`,
glmhelper.py:33 passes an open file to `dump`.
"""
import os

from .errors import GlmParseError
from .parser import Parser
from .writer import dumps

__version__ = "1.0.0"

__all__ = ["load", "loads", "dump", "dumps", "version", "GlmParseError"]


def loads(text):
    """Parse GLM source text into the AST dict."""
    return Parser(text).parse()


def load(file):
    """Parse a .glm file given a path or an open text file object."""
    if isinstance(file, (str, os.PathLike)):
        with open(file, "r", encoding="utf-8", errors="replace") as handle:
            return loads(handle.read())
    return loads(file.read())


def dump(data, file):
    """Write an AST dict as GLM to a path or an open writable file object."""
    text = dumps(data)
    if isinstance(file, (str, os.PathLike)):
        with open(file, "w", encoding="utf-8") as handle:
            handle.write(text)
        return None
    file.write(text)
    return None


def version():
    return __version__
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd local-server && .venv/bin/python -m pytest tests/test_glmparser.py -v
```

Expected: all pass, including 17 parametrized round-trip cases

- [ ] **Step 5: Commit**

```bash
git add local-server/glmparser/__init__.py local-server/tests/test_glmparser.py
git commit -m "feat(glmparser): add public load/loads/dump/dumps API"
```

---

### Task 8: Differential validation against Nim, then freeze goldens

Goldens cannot be dumped straight from the new parser — that asserts it agrees with itself. They also cannot come from Nim, whose output *is* the three bugs being fixed. This task establishes trust first, then freezes.

**Files:**
- Create (temporarily, then delete): `local-server/tools/diff_parsers.py`
- Create: `local-server/tests/golden/*.json`
- Modify: `local-server/tests/test_glmparser.py`

**Interfaces:**
- Consumes: `glmparser.load` from Task 7.
- Produces: `local-server/tests/golden/<model-stem>.json` files; a `normalize_uuids(obj)` helper in the test module.

- [ ] **Step 1: Write the differential script**

Create `local-server/tools/diff_parsers.py`. This is a migration aid and gets deleted in Step 4 — it requires the Nim `glm` package, which is the dependency being removed.

```python
"""One-off: diff the new pure-Python parser against the Nim `glm` package.

Requires the Nim wheel installed. Deleted once goldens are frozen.
Run from the repo root:  python local-server/tools/diff_parsers.py
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import glm  # the Nim package
import glmparser

UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


def normalize(node):
    if isinstance(node, dict):
        return {
            k: ("<uuid>" if isinstance(v, str) and UUID_RE.match(v) else normalize(v))
            for k, v in node.items()
        }
    if isinstance(node, list):
        return [normalize(x) for x in node]
    return node


def classify(nim_obj, py_obj):
    """Return 'dotted-key' for the known fix-2 difference, else 'UNEXPECTED'."""
    extra = set(py_obj["attributes"]) - set(nim_obj["attributes"])
    if extra and all("." in key for key in extra):
        return "dotted-key"
    return "UNEXPECTED"


def main():
    root = Path(__file__).resolve().parents[2]
    unexpected_total = 0

    for path in sorted((root / "models").rglob("*.glm")):
        nim = normalize(glm.load(str(path)))
        py = normalize(glmparser.load(path))

        notes = []
        # fix 3: `classes` is new, Nim never emitted it
        if "classes" in py and "classes" not in nim:
            notes.append(f"classes=+{len(py['classes'])} (fix 3)")

        dotted = unexpected = 0
        for nim_obj, py_obj in zip(nim["objects"], py["objects"]):
            if nim_obj == py_obj:
                continue
            if classify(nim_obj, py_obj) == "dotted-key":
                dotted += 1
            else:
                unexpected += 1
                if unexpected == 1:
                    notes.append(f"\n     nim: {str(nim_obj)[:200]}")
                    notes.append(f"\n     py : {str(py_obj)[:200]}")

        for key in ("modules", "includes", "directives", "definitions", "clock"):
            if nim.get(key) != py.get(key):
                unexpected += 1
                notes.append(f"\n     {key}: nim={nim.get(key)} py={py.get(key)}")

        unexpected_total += unexpected
        status = "OK" if unexpected == 0 else "REVIEW"
        print(
            f"{status:<7}{path.name:<38} dotted={dotted:<4} unexpected={unexpected}"
            + " ".join(notes)
        )

    print(f"\nTotal unexpected diffs: {unexpected_total}")
    return 1 if unexpected_total else 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 2: Run the differential and account for every diff**

```bash
cd /home/mend166/projects/GLIMPSE && local-server/.venv/bin/python local-server/tools/diff_parsers.py
```

Expected: every line reports `OK`, and `Total unexpected diffs: 0`.

**Do not proceed past this step with a non-zero count.** Each `REVIEW` line is either a bug in the new parser or a fourth undocumented Nim behavior. Investigate and fix the parser; only differences attributable to the three documented fixes (dotted keys, added `classes`, restored `includes` on write) are acceptable.

If the Nim `glm` package is not installed, install it with `local-server/.venv/bin/pip install glm`. On Apple Silicon it must be built from source per `README.md:175-199` — this is the last time that will be necessary.

- [ ] **Step 3: Generate and commit the goldens**

```bash
cd /home/mend166/projects/GLIMPSE && mkdir -p local-server/tests/golden && local-server/.venv/bin/python - <<'PY'
import json, re, sys
from pathlib import Path
sys.path.insert(0, "local-server")
import glmparser

UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")

def normalize(node):
    if isinstance(node, dict):
        return {k: ("<uuid>" if isinstance(v, str) and UUID_RE.match(v) else normalize(v))
                for k, v in node.items()}
    if isinstance(node, list):
        return [normalize(x) for x in node]
    return node

models = Path("models")
out = Path("local-server/tests/golden")
for path in sorted(models.rglob("*.glm")):
    # Key on the relative path, not the stem: two models are named IEEE_9500.glm
    # and two are named Inverters.glm, so stems collide and would overwrite.
    slug = str(path.relative_to(models).with_suffix("")).replace("/", "__")
    target = out / (slug + ".json")
    target.write_text(json.dumps(normalize(glmparser.load(path)), indent=1, sort_keys=True))
    print("wrote", target)
PY
```

- [ ] **Step 3b: Verify one golden per model file**

```bash
cd /home/mend166/projects/GLIMPSE && echo "models: $(find models -name '*.glm' | wc -l)  goldens: $(ls local-server/tests/golden/*.json | wc -l)"
```

Expected: the two counts match. If goldens are fewer, the slug scheme collided and Step 3 needs fixing before continuing.

- [ ] **Step 4: Add the golden test and delete the differential script**

Append to `local-server/tests/test_glmparser.py`:

```python
import json

GOLDEN = Path(__file__).resolve().parent / "golden"


def normalize_uuids(node):
    """Hoisted-object names are uuid4 and differ every run; blank them out.

    Reuses UUID_RE, defined alongside the hoisting tests above.
    """
    if isinstance(node, dict):
        return {
            k: (
                "<uuid>"
                if isinstance(v, str) and UUID_RE.match(v)
                else normalize_uuids(v)
            )
            for k, v in node.items()
        }
    if isinstance(node, list):
        return [normalize_uuids(x) for x in node]
    return node


@pytest.mark.parametrize(
    "path", ALL_MODELS, ids=lambda p: str(p.relative_to(MODELS))
)
def test_model_matches_golden(path):
    slug = str(path.relative_to(MODELS).with_suffix("")).replace("/", "__")
    expected = json.loads((GOLDEN / f"{slug}.json").read_text())
    assert normalize_uuids(glmparser.load(path)) == expected
```

Then remove the migration script:

```bash
rm -rf local-server/tools
```

- [ ] **Step 5: Run the full suite**

```bash
cd local-server && .venv/bin/python -m pytest tests/ -v
```

Expected: all pass, with one `test_model_matches_golden` case per golden file.

- [ ] **Step 6: Commit**

```bash
git add local-server/tests/
git commit -m "test(glmparser): freeze goldens after Nim differential parity"
```

---

### Task 9: Cut over glmhelper.py

**Files:**
- Modify: `local-server/glmhelper.py:1`, `local-server/glmhelper.py:23`, `local-server/glmhelper.py:33`
- Modify: `local-server/tests/test_glmparser.py`

**Interfaces:**
- Consumes: `glmparser.load`, `glmparser.dump` from Task 7.
- Produces: `GLMHelper` unchanged in signature — `parse_glm(file_paths: list) -> dict`, `json_to_glm(data, tmpdir) -> io.BytesIO`.

- [ ] **Step 1: Write the failing test**

Append to `local-server/tests/test_glmparser.py`:

```python
from glmhelper import GLMHelper


def test_glmhelper_parses_through_the_new_module(tmp_path):
    source = tmp_path / "tiny.glm"
    source.write_text(SAMPLE)
    result = GLMHelper().parse_glm([str(source)])
    assert "tiny.json" in result
    assert result["tiny.json"]["modules"][0]["name"] == "powerflow"


def test_glmhelper_rejects_oversized_files(tmp_path):
    big = tmp_path / "big.glm"
    big.write_text("// pad\n" * 400_000)  # > 5 MB
    with pytest.raises(ValueError, match="too large"):
        GLMHelper().parse_glm([str(big)])


def test_glmhelper_exports_a_zip(tmp_path):
    helper = GLMHelper()
    data = {"tiny.json": glmparser.loads(SAMPLE)}
    buffer = helper.json_to_glm(data, str(tmp_path))

    import zipfile

    with zipfile.ZipFile(buffer) as archive:
        assert archive.namelist() == ["tiny.glm"]
        text = archive.read("tiny.glm").decode()
    assert "module powerflow {" in text
    assert '#include "Inverters.glm";' in text
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd local-server && .venv/bin/python -m pytest tests/test_glmparser.py -v
```

Expected: `test_glmhelper_exports_a_zip` FAILs on the missing `#include "Inverters.glm";` line.

Note the failure is *not* an import error — the Nim `glm` package is still installed at this point, so `glmhelper.py:1` imports fine and the first two tests may well pass. The export test is the one that pins the cutover, because dropping includes is exactly what the Nim writer does.

- [ ] **Step 3: Swap the import**

In `local-server/glmhelper.py`, change line 1:

```python
import glm
```

to:

```python
from glmparser import dump as glm_dump
from glmparser import load as glm_load
```

Then change line 23 from `result = glm.load(glm_path)` to:

```python
            result = glm_load(glm_path)
```

And line 33 from `glm.dump(data[filename], glm_file)` to:

```python
                glm_dump(data[filename], glm_file)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd local-server && .venv/bin/python -m pytest tests/ -v
```

Expected: all pass

- [ ] **Step 5: Verify the Nim package is genuinely unused**

```bash
cd /home/mend166/projects/GLIMPSE && grep -rn "import glm$\|^import glm\|from glm import" --include=*.py --include=*.spec . | grep -v node_modules | grep -v "local-server/glm/"
```

Expected: no output. Any hit is a missed call site.

- [ ] **Step 6: Smoke-test the real server**

```bash
cd /home/mend166/projects/GLIMPSE && npm run dev:backend
```

In a second shell:

```bash
curl -s -F "files=@models/123/IEEE_123_Dynamic.glm" http://localhost:5052/api/upload/glm | head -c 400
```

Expected: a JSON body whose `data` key holds `IEEE_123_Dynamic.json` with a populated `objects` array. Stop the server afterward.

- [ ] **Step 7: Commit**

```bash
git add local-server/glmhelper.py local-server/tests/test_glmparser.py
git commit -m "refactor(glmhelper): use pure-Python glmparser instead of Nim glm"
```

---

### Task 10: Documentation

**Files:**
- Modify: `README.md:73-199`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing (docs only).

- [ ] **Step 1: Update `README.md` prerequisites**

In the "Prerequisites" list around `README.md:80-84`, delete the entire Nim entry:

```markdown
2. **[Nim](https://nim-lang.org/install.html)** — Only needed if:
    - You're on Apple silicon (M chips), OR
    - You plan to export modified GLM files
```

In the "Quick Overview" list at `README.md:73`, change:

```markdown
1. ✅ Install Node.js (and optionally Nim)
```

to:

```markdown
1. ✅ Install Node.js
```

- [ ] **Step 2: Delete the Apple Silicon build section**

Remove the whole "#### Special Instructions for Apple Silicon (M Chips)" block (`README.md:173-199` and its trailing pip/uv install snippets) — building the parser from source is no longer a thing. Also remove the now-stale `uv pip install glm` line at `README.md:170`.

- [ ] **Step 3: Update `CLAUDE.md`**

In the "What GLIMPSE is" section, the sentence reading:

```markdown
The `.glm` parser is the separate `glm` pip package (a Nim binary); Apple Silicon must build it
from source — see the README.
```

becomes:

```markdown
The `.glm` parser is `local-server/glmparser/` — a pure-Python package with no build step.
```

In the "Backend helpers" section, update the `GLMHelper` bullet:

```markdown
- `GLMHelper` ([glmhelper.py](local-server/glmhelper.py)) — GridLAB-D `.glm` ⇄ JSON via
  [glmparser](local-server/glmparser/) (5 MB/file cap); `json_to_glm` zips exports.
```

In the "Tests" section, replace the "There is **no unit-test framework**" opening with:

```markdown
The parser has a pytest suite; everything else is covered by the integration scripts in
[socket-testing/](socket-testing/).

```bash
cd local-server && uv sync --group dev
cd local-server && pytest              # parser unit + golden tests
```
```

- [ ] **Step 4: Verify no stale Nim references remain**

```bash
cd /home/mend166/projects/GLIMPSE && grep -rniE '\bnim\b|nimble|nim-lang' README.md CLAUDE.md
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: drop Nim toolchain requirement"
```

---

## Verification

After Task 10, from the repo root:

```bash
cd local-server && .venv/bin/python -m pytest tests/ -v     # full suite green
cd /home/mend166/projects/GLIMPSE && npm run lint            # unchanged, still clean
```

Then delete the now-unused Nim clone, which is untracked and gitignored:

```bash
rm -rf local-server/glm
local-server/.venv/bin/pip uninstall -y glm
```

Re-run the suite once more afterward to prove nothing still reaches for the Nim package.
