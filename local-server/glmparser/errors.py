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

            # An offset at EOF on newline-terminated source lands one line past
            # the last real line, because splitlines() yields no phantom
            # trailing entry. Clamp to the end of the last real line -- exactly
            # where an "unexpected end of file" belongs.
            #
            # This is the common path, not an edge case: the lexer's EOF token
            # carries start == len(source), and both `Unexpected end of file
            # inside block` and `... inside schedule` are raised on it. Without
            # the clamp those raise IndexError instead of GlmParseError.
            lines = source.splitlines()
            if self.line > len(lines):
                self.line = len(lines)
                self.column = len(lines[-1])

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
