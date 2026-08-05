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


def test_offset_at_eof_clamps_to_the_last_real_line():
    # The lexer's EOF token carries start == len(source), and unterminated
    # blocks raise on it. Without clamping this is an IndexError, not a
    # GlmParseError -- which breaks the unterminated-block/schedule tests.
    source = "module powerflow {\n  solver_method NR;\n"
    err = GlmParseError("Unexpected end of file inside block", source, len(source))
    assert err.line == 2
    assert err.column == len("  solver_method NR;")
    assert "Unexpected end of file inside block" in str(err)


def test_offset_at_eof_without_trailing_newline():
    source = "module powerflow {"
    err = GlmParseError("boom", source, len(source))
    assert err.line == 1
    assert err.column == len(source)


def test_caret_prefix_preserves_tabs_for_alignment():
    source = "object node {\n\t\tbad!\n}\n"
    err = GlmParseError("nope", source, source.index("bad!"))
    caret_line = next(l for l in str(err).splitlines() if l.strip() == "^")
    # tabs are copied through so the caret aligns at any tab width
    assert caret_line == "\t\t^"
