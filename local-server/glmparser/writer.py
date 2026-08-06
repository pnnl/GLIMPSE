"""AST dict -> GLM text.

Section order and punctuation follow the source models rather than the Nim
writer this replaces: `#set x=1` carries no semicolon, `#include "f.glm";`
carries both quotes and one. The Nim version got both wrong, which stayed
invisible only because it never emitted includes at all.
"""

_INDENT = "\t"


def _unrepresentable(text):
    """Return a reason if this value cannot survive a GLM round-trip, else None.

    GLM has no escape mechanism. The lexer's quoted-string branch stops at the
    first `"` or newline, so a value carrying either one alongside a `;` cannot
    be written and read back faithfully -- it comes back truncated, with a junk
    attribute fabricated from the tail.

    Refuse loudly rather than emit a model file that silently reads back as
    different data: server.py wraps export in `except Exception` and puts the
    message in the HTTP error body, so the user sees a real error instead of a
    quietly corrupted GridLAB-D model.

    No value in any of the 17 sample models contains `;`, `"`, or a newline, so
    this path is defensive rather than routine.
    """
    if '"' in text:
        return "contains a double quote, which GLM cannot escape"
    if "\n" in text and ";" in text:
        return "contains both a newline and a semicolon"
    return None


def _quote_if_needed(value, key):
    text = str(value)
    reason = _unrepresentable(text)
    if reason is not None:
        raise ValueError(
            f"Cannot export attribute {key!r}: its value {reason}. "
            f"Writing it would silently corrupt the model on reload."
        )
    if ";" in text or "\n" in text:
        return '"' + text + '"'
    return text


def _attributes(attributes, depth):
    pad = _INDENT * depth
    return "".join(
        f"{pad}{key} {_quote_if_needed(value, key)};\n"
        for key, value in attributes.items()
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
