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


def test_unterminated_substitution_stays_on_its_own_line():
    # With `[^}]*` an unterminated `${` runs to the next `}` ANYWHERE in the
    # file, swallowing a brace that closes an unrelated block. Measured: the
    # loose form silently drops `object other` entirely.
    source = "object node {\n  name ${A\n}\nobject other {\n  name val;\n}"
    lex = Lexer(source)
    texts = []
    while lex.peek().kind != EOF:
        texts.append(lex.next().text)
    # no token may span the newline that follows `${A`
    assert not any("\n" in t for t in texts)


def test_lexer_covers_every_non_whitespace_character():
    # Whitespace is intentionally skipped; nothing else may be.
    for source in ("prefix${A}suffix;", "a$b;", "$;", "$", "x ${A}${B} y;"):
        lex = Lexer(source)
        covered = []
        while lex.peek().kind != EOF:
            covered.append(lex.next().text)
        assert "".join(covered) == "".join(source.split()), source


def test_quoted_string_is_one_token_including_semicolons():
    assert kinds('k "a;b";') == [("word", "k"), ("word", '"a;b"'), ("semi", ";")]
    assert kinds("k 'x y';") == [("word", "k"), ("word", "'x y'"), ("semi", ";")]


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


def test_value_missing_semicolon_before_closing_brace():
    # `_value_to_semicolon` tolerates rbrace as a terminator so a final
    # attribute without its `;` does not run away and eat the block.
    ast = parse("module m {\n  solver_method NR\n};")
    assert ast["modules"] == [{"name": "m", "attributes": {"solver_method": "NR"}}]


def test_directive_without_equals_does_not_crash():
    ast = parse("#set profiler\n")
    assert ast["directives"] == [{"name": "profiler", "value": ""}]


def test_directive_as_last_line_without_trailing_newline():
    # `_value_to_eol` must handle find("\n") returning -1.
    ast = parse("#define VSOURCE=69715.045")
    assert ast["definitions"] == [{"name": "VSOURCE", "value": "69715.045"}]


def test_empty_directive_does_not_swallow_the_next_statement():
    # Anchoring the line bound to the next token instead of the directive
    # keyword made `module tape;` vanish into the directive's value.
    ast = parse("#set\nmodule tape;\nmodule powerflow;\n")
    assert ast["directives"] == [{"name": "", "value": ""}]
    assert [m["name"] for m in ast["modules"]] == ["tape", "powerflow"]


def test_empty_include_does_not_swallow_the_next_statement():
    ast = parse("#include\nmodule tape;\n")
    assert ast["includes"] == [{"value": ""}]
    assert [m["name"] for m in ast["modules"]] == ["tape"]


def test_empty_block():
    ast = parse("module m { };")
    assert ast["modules"] == [{"name": "m", "attributes": {}}]


def test_unknown_top_level_token_raises_with_line_number():
    with pytest.raises(GlmParseError) as excinfo:
        parse("module tape;\ngarbage\n")
    assert excinfo.value.line == 2


def test_unterminated_block_raises():
    with pytest.raises(GlmParseError):
        parse("module powerflow {\n  solver_method NR;\n")


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


def roundtrip_attributes(attributes):
    """Write one object, parse it back, return its attributes.

    Substring assertions on writer output cannot catch malformation -- they pass
    happily on text this project's own parser rejects or misreads. Anything
    claiming a value survives export must go through the parser.
    """
    text = write_glm(
        {"objects": [{"name": "n", "attributes": attributes, "children": []}]}
    )
    return parse(text)["objects"][0]["attributes"]


def test_values_containing_semicolons_survive_round_trip():
    # Quoting only works because the lexer consumes a quoted string whole.
    # Without that, this reads back as {'weird': 'a', 'b"': ''}.
    assert roundtrip_attributes({"weird": "a;b"}) == {"weird": "a;b"}
    assert roundtrip_attributes({"k": "a;b;c"}) == {"k": "a;b;c"}
    assert roundtrip_attributes({"k": "trailingsemi;"}) == {"k": "trailingsemi;"}


def test_ordinary_values_survive_round_trip():
    for value in ("NR", "1.0 + 2.0j", "${VSOURCE}", "a\nb", "200.00"):
        assert roundtrip_attributes({"k": value}) == {"k": value}, value


def test_unrepresentable_values_raise_instead_of_corrupting():
    # GLM has no escape mechanism, so these cannot round-trip. Writing them
    # anyway produces a model that silently reads back as different data, so
    # the writer refuses. No value in any of the 17 sample models hits this.
    for value in ('has "quote"', 'a;b said "x"', "newline\nand;semicolon"):
        with pytest.raises(ValueError, match="Cannot export attribute"):
            write_glm(
                {"objects": [{"name": "n", "attributes": {"k": value}, "children": []}]}
            )


def test_unrepresentable_value_names_the_offending_attribute():
    # Ends with a quote character, so it still raises under the new predicate
    # (an interior quote alone, like `x"y`, is representable -- see
    # test_interior_quote_without_semicolon_is_representable).
    with pytest.raises(ValueError, match="'bad_attr'"):
        write_glm(
            {
                "objects": [
                    {"name": "n", "attributes": {"bad_attr": 'x"y"'}, "children": []}
                ]
            }
        )


def test_interior_quote_without_semicolon_is_representable():
    # `3"x5` round-trips exactly; rejecting it would make a model containing an
    # inch mark permanently un-exportable.
    assert roundtrip_attributes({"size": '3"x5'}) == {"size": '3"x5'}
    assert roundtrip_attributes({"k": "a\"b"}) == {"k": "a\"b"}
    assert roundtrip_attributes({"k": "it's"}) == {"k": "it's"}


def test_written_output_reparses_to_the_same_ast():
    ast = parse(
        "clock {\n  timezone PST+8PDT;\n};\n"
        "#set profiler=1\n"
        '#include "Inverters.glm";\n'
        "module powerflow {\n  solver_method NR;\n};\n"
        "module tape;\n"
        "class thermostat {\n  double setpoint;\n};\n"
        "schedule s {\n  * * * * * 1.0;\n  {\n    * 9-17 * * 1-5 0.5;\n  }\n};\n"
        "object node {\n  name n1;\n  object ZIPload {\n    name z1;\n  };\n};\n"
    )
    assert parse(write_glm(ast)) == ast


def test_missing_keys_are_tolerated():
    # the frontend may post back a dict lacking sections it never touched
    assert write_glm({}) == ""


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

    as_str = tmp_path / "out2.glm"
    glmparser.dump(glmparser.loads(SAMPLE), str(as_str))
    assert "module powerflow {" in as_str.read_text()


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
assert len(ALL_MODELS) == 17, f"expected 17 sample models, found {len(ALL_MODELS)}: {ALL_MODELS}"


@pytest.mark.parametrize(
    "path", ALL_MODELS, ids=lambda p: str(p.relative_to(MODELS))
)
def test_every_sample_model_round_trips_stably(path):
    # Full equality, including every object's attributes -- which is where
    # essentially all real GLM content lives (voltages, phases, impedances,
    # ratings). A structural comparison would miss a regression that mangled,
    # dropped, or reordered attribute values.
    #
    # uuid4 hoisted names do NOT make this flaky. They are regenerated only
    # when the same SOURCE TEXT is parsed twice; this cycle parses the source
    # once and then re-parses the writer's output, and the writer emits hoisted
    # children as ordinary top-level objects carrying their generated name as a
    # literal, so nothing re-hoists. Verified: holds for all 17 models (none of
    # which trigger hoisting at all) and for a synthetic model that does.
    first = glmparser.load(path)
    second = glmparser.loads(glmparser.dumps(first))
    assert first == second


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


from glmhelper import GLMHelper


def test_glmhelper_parses_through_the_new_module(tmp_path):
    source = tmp_path / "tiny.glm"
    source.write_text(SAMPLE)
    result = GLMHelper().parse_glm([str(source)])
    assert "tiny.json" in result
    assert result["tiny.json"]["modules"][0]["name"] == "powerflow"


def test_glmhelper_rejects_oversized_files(tmp_path):
    big = tmp_path / "big.glm"
    big.write_text("// pad\n" * 800_000)  # 5.34 MB, over the 5 MB cap
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
