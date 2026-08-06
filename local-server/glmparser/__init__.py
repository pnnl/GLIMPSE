"""Pure-Python GridLAB-D .glm parser.

Drop-in replacement for the Nim-backed `glm` pip package. The public surface is
`load`/`loads`/`dump`/`dumps`/`version`, matching what glmhelper.py calls.

Both `load` and `dump` accept either a filesystem path or an already-open file
object, because both forms are in use: glmhelper.py:23 passes a path to `load`,
glmhelper.py:33 passes an open file to `dump`.
"""
import os

from .errors import GlmParseError
from .parser import Parser
from .writer import dumps

__version__ = "1.0.0"

__all__ = ["load", "loads", "dump", "dumps", "version", "GlmParseError"]


def loads(text):
    """Parse GLM source text into the AST dict."""
    return Parser(text).parse()


def load(file):
    """Parse a .glm file given a path or an open text file object."""
    if isinstance(file, (str, os.PathLike)):
        with open(file, "r", encoding="utf-8", errors="replace") as handle:
            return loads(handle.read())
    return loads(file.read())


def dump(data, file):
    """Write an AST dict as GLM to a path or an open writable file object."""
    text = dumps(data)
    if isinstance(file, (str, os.PathLike)):
        with open(file, "w", encoding="utf-8") as handle:
            handle.write(text)
        return None
    file.write(text)
    return None


def version():
    return __version__
