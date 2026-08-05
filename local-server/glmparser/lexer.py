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
    | (?P<word>\$\{[^}]*\}|[^\s{}$;]+)            # substitution, or identifier/value
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
