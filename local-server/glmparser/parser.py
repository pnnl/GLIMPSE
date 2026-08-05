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
