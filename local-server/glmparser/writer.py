"""AST dict -> GLM text.

Section order and punctuation follow the source models rather than the Nim
writer this replaces: `#set x=1` carries no semicolon, `#include "f.glm";`
carries both quotes and one. The Nim version got both wrong, which stayed
invisible only because it never emitted includes at all.
"""

_INDENT = "\t"


def _unrepresentable(text):
    """Return a reason if this value cannot survive a GLM round-trip, else None.

    Derived from measured behavior, not guessed. Three ways a value breaks:

    - It starts or ends with a quote character. `_value_to_semicolon` strips
      leading/trailing `'` and `"` off every value, so those characters do not
      come back.
    - It needs quoting (contains `;` or a newline) but itself contains a `"`.
      The lexer's quoted-string branch ends at the first inner `"`, so the
      quoted form is mis-lexed.
    - It contains both a `;` and a newline. The quoted-string branch excludes
      newline (that bound is what stops an unterminated quote swallowing the
      rest of the file), so no quoting strategy covers this.

    An interior `"` with no `;` or newline is fine: `3"x5` round-trips exactly.
    Refusing it would make a model with an inch mark permanently un-exportable.
    """
    if text[:1] in ('"', "'") or text[-1:] in ('"', "'"):
        return "starts or ends with a quote character, which the reader strips"
    if ";" in text or "\n" in text:
        if '"' in text:
            return "needs quoting but contains a double quote"
        if ";" in text and "\n" in text:
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
    name = schedule["name"]
    body = "".join(
        f"{_INDENT}{_quote_if_needed(value, name)};\n"
        for value in schedule.get("values") or []
    )
    for group in schedule.get("children") or []:
        body += f"{_INDENT}{{\n"
        body += "".join(
            f"{_INDENT * 2}{_quote_if_needed(value, name)};\n" for value in group
        )
        body += f"{_INDENT}}}\n"
    return f"schedule {name} {{\n{body}}};\n\n"


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
