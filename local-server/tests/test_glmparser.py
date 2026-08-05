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


def test_a_bare_dollar_sign_is_not_dropped():
    # Excluding `$` from the value branch without a bare-`$` fallback makes
    # finditer skip it silently: `a$b;` would cover only `ab;`.
    assert kinds("a$b;") == [("word", "a"), ("word", "$"), ("word", "b"), ("semi", ";")]
    assert kinds("$;") == [("word", "$"), ("semi", ";")]


def test_lexer_covers_every_non_whitespace_character():
    # Whitespace is intentionally skipped; nothing else may be.
    for source in ("prefix${A}suffix;", "a$b;", "$;", "x ${A}${B} y;"):
        lex = Lexer(source)
        covered = []
        while lex.peek().kind != EOF:
            covered.append(lex.next().text)
        assert "".join(covered) == "".join(source.split()), source


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
