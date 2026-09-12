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

    def _value_to_eol(self, hash_token):
        """`#set`/`#define`/`#include` run to end of line, not to a `;`.

        The line bound is computed from the DIRECTIVE token's own end, not from
        the next token's start: when nothing follows the keyword on that line,
        anchoring to the next token finds the end of the FOLLOWING line and
        silently swallows that statement into this directive's value.

        The slice ends at the last token consumed rather than at the newline,
        because slicing to the newline drags in a trailing `//` comment -- the
        lexer discards comments but the raw source still contains them.
        """
        newline = self.source.find("\n", hash_token.end)
        if newline == -1:
            newline = len(self.source)
        start = self.lex.peek().start
        if start > newline:            # nothing on this line after the keyword
            return ""
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

    def _object(self):
        """`object <type> { ... };` -- the type may carry `.` or `:` suffixes."""
        name = self._expect("word").text
        children = []
        attributes = self._attributes(children)
        return {"name": name, "attributes": attributes, "children": children}

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

    def _class_block(self):
        """`class name { <type> <property>; ... };`

        A class body is a LIST, not a dict. Its entries are `<type> <name>`
        declarations and the same type recurs constantly in a normal class
        (`double a; double b;`). Keying by type silently dropped all but the
        last -- the shape module/object bodies use does not fit here.
        """
        name = self._expect("word").text
        if self.lex.peek().kind == "semi":
            self.lex.next()
            return {"name": name, "properties": []}

        self._expect("lbrace")
        properties = []
        while True:
            token = self.lex.peek()
            if token.kind == "rbrace":
                self.lex.next()
                break
            if token.kind == EOF:
                raise self.lex.error("Unexpected end of file inside class", token)
            if token.kind == "semi":
                self.lex.next()
                continue
            property_type = self.lex.next().text
            properties.append(
                {"type": property_type, "name": self._value_to_semicolon()}
            )

        if self.lex.peek().kind == "semi":
            self.lex.next()
        return {"name": name, "properties": properties}

    def _named_block(self):
        """`module powerflow;` or `module powerflow { ... };`. Also `class`."""
        name = self._expect("word").text
        if self.lex.peek().kind == "semi":
            self.lex.next()
            return {"name": name, "attributes": {}}
        return {"name": name, "attributes": self._attributes()}

    def _directive(self, which, hash_token):
        if which == "include":
            self.ast["includes"].append({"value": self._value_to_eol(hash_token)})
            return
        body = self._value_to_eol(hash_token)
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
                    self.ast["classes"].append(self._class_block())
            elif token.kind == "hash":
                self._directive(token.text, token)
            else:
                raise self.lex.error(f"Unexpected token {token.text!r}", token)

        return self.ast
