import re

from .errors import GlmParseError

_TOKEN_RE = re.compile(
    r"""
    (?<!:)//[^\n]*
    | \#[ \t]*(?P<hash>set|define|include)\b
    | \b(?P<kw>clock|module|object|class|schedule)\b
    | (?P<lbrace>\{)
    | (?P<rbrace>\})
    | (?P<semi>;)
    | (?P<word>"[^"\n]*"|'[^'\n]*'|[^\s{}$;]+|\$\{[^}\s;]*\}|\$) # quoted string, value, substitution, bare $
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
