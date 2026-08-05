"""Pure-Python GridLAB-D .glm parser.

Drop-in replacement for the Nim-backed `glm` pip package. The public surface is
`load`/`loads`/`dump`/`dumps`/`version`, matching what glmhelper.py calls.
"""

__version__ = "1.0.0"

__all__ = ["version"]


def version():
    return __version__
