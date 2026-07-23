# -*- mode: python ; coding: utf-8 -*-

from PyInstaller.utils.hooks import collect_data_files
import sys
sys.setrecursionlimit(sys.getrecursionlimit() * 5)

datas = []
datas += collect_data_files("cimgraph", include_py_files=True)

# JSON validation schemas loaded at runtime relative to jsonhelper.py
datas += [("schemas", "schemas")]

# Example models served by /api/examples — destination paths must mirror the
# EXAMPLE_MODELS registry in server.py ("<models dir>/CIM/...", "<models dir>/3000/...").
datas += [
    ("../models/CIM/IEEE123.xml", "models/CIM"),
    ("../models/CIM/IEEE9500bal.xml", "models/CIM"),
    ("../models/3000/3000_model.glm", "models/3000"),
]

a = Analysis(
    ['server.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    # engineio loads its async driver dynamically (importlib), so PyInstaller's
    # static analysis misses it. Without this the packaged server crashes at
    # startup with "ValueError: Invalid async_mode specified".
    hiddenimports=['engineio.async_drivers.gevent'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='server',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='server',
)
