# -*- mode: python ; coding: utf-8 -*-

from PyInstaller.utils.hooks import collect_data_files
import sys
sys.setrecursionlimit(sys.getrecursionlimit() * 5)

datas = []
# CIM-Builder is an optional install (see README); skip it when absent
try:
    datas += collect_data_files("cimbuilder", include_py_files=True)
except Exception:
    pass
datas += collect_data_files("cimgraph", include_py_files=True)
# JSON validation schemas loaded at runtime relative to jsonhelper.py
datas += [("schemas", "schemas")]

# hiddenimports = ['engineio.async_drivers.gevent', 'engineio.async_drivers.gevent_uwsgi']

a = Analysis(
    ['server.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=[],
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
