"""Streaming tokenizer for GridLAB-D .glm source.

One regex pass over the source, pulled through a single-token lookahead buffer.
Whitespace is skipped rather than tokenized -- the Nim implementation this
replaces heap-allocated a token object per space and newline, which is where
most of its runtime went.
"""
import re

from .errors import GlmParseError

# The `word` group has five branches, in this order, and all five are needed:
#
#   0. `"[^"\n]*"` and `'[^'\n]*'` -- a quoted string, consumed WHOLE, including
#      any `;` inside it. GLM genuinely uses quoted values (`starttime
#      '2000-01-01 0:00:00';`). Without these branches a `;` inside quotes still
#      lexes as a `semi` and terminates the value, so the writer's defensive
#      quoting protects nothing: exporting `{"weird": "a;b"}` writes
#      `weird "a;b";` and reads back as `{'weird': 'a', 'b"': ''}` -- the value
#      truncated AND a junk attribute fabricated, silently. Must precede the
#      ordinary-value branch so the whole quoted run is taken first.
#      An unterminated quote falls through to branch 1, matching prior behavior.
#
#      This is NOT full string support: `[^"\n]` excludes newline (so an
#      unterminated quote cannot swallow the rest of the file, the same failure
#      the `${...}` bound prevents) and there is no backslash-escape handling,
#      because GLM has no escape mechanism to honor. Values carrying a `"`, or
#      both a newline and a `;`, therefore cannot round-trip -- writer.py
#      refuses to emit those rather than corrupting them silently.
#   1. `[^\s{}$;]+` -- the fast common path for ordinary identifiers and values.
#      It excludes `$` so it stops cleanly at the start of a substitution.
#   2. `\$\{[^}\s;]*\}` -- a `${VSOURCE}` substitution, kept as ONE token.
#      Without this the braces lex as lbrace/rbrace, and that stray rbrace
#      silently closes the enclosing block early, corrupting every attribute
#      after it. The `\s;` exclusion bounds the match to one line: with a plain
#      `[^}]*`, an unterminated `${` runs on until the next `}` ANYWHERE in the
#      file -- swallowing a brace that closes an unrelated block. Measured on
#      `object node {\n name ${A\n}\nobject other {...}`: the loose form
#      silently drops `object other` entirely (1 object parsed instead of 2).
#   3. `\$` -- a bare dollar sign not starting a substitution. Without this
#      branch nothing matches a lone `$` and finditer skips it silently, so
#      `a$b` tokenizes as `a`,`b` and a value of just `$` vanishes entirely.
#
# Branch 0 must come first: quoted strings must be consumed WHOLE. Branch 1 must
# come before branches 2-3 since it is the hot path, and putting it early costs
# nothing on `$` positions while keeping ordinary scanning at full speed. A
# single per-character alternation `(?:\$\{[^}]*\}|[^\s{};])+` also works but
# costs ~25% throughput.

# line comment (discarded)
# the (?<!:) guard is
# defense-in-depth only: it is
# currently unreachable, since
# the word branch admits `:`
# and `/` and so swallows
# `http://host/x` whole before
# this alternative is ever
# tried at the `//`. Keep it
# in case that class narrows.
_TOKEN_RE = re.compile(
    r"""
    (?<!:)//[^\n]*                              
    | \#[ \t]*(?P<hash>set|define|include)\b
    | \b(?P<kw>clock|module|object|class|schedule)\b
    | (?P<lbrace>\{)
    | (?P<rbrace>\})
    | (?P<semi>;)
    | (?P<word>"[^"\n]*"|'[^'\n]*'|[^\s{}$;]+|\$\{[^}\s;]*\}|\$)      # quoted string, value, substitution, bare $
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
