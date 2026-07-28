#!/usr/bin/env python3
"""Recover the Android BTDB data.jet pack password from libnative.so and unpack Assets/.

Companion to the Profile save editor (https://github.com/bocho8/btd-save-editor):
catalogs.json is built from Asset JSON, which comes from a ZipCrypto-protected
data.jet in the Android client (APK). This script finds the password seed in the
arm64-v8a native library, verifies it with unzip -t, then writes Assets/ at the
repo root for `npm run extract-catalogs`. Steam packaging is out of scope.
"""

from __future__ import annotations

import argparse
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DEFAULT_ASSETS = REPO / "Assets"
DEFAULT_PROBE = "Assets/JSON/premium_items.json"

_MOVZ_X = 0xD2800000
_MOVK_X = 0xF2800000
_OPC_MASK = 0xFF800000

_EPILOG = """\
examples:
  %(prog)s --so /path/to/libnative.so --jet /path/to/data.jet
  %(prog)s --so libnative.so --jet data.jet --password-only
  %(prog)s -h

After a successful extract, regenerate site catalogs:
  npm run extract-catalogs

Pack passwords are not stored in this repo; each client build has its own seed.
Requires: Python 3, unzip, Android arm64-v8a libnative.so from the same build as data.jet.
"""


def _elf_exec_segments(data: bytes) -> list[tuple[int, int, int]]:
    if data[:4] != b"\x7fELF" or data[4] != 2 or data[5] != 1:
        raise ValueError("not a little-endian ELF64")
    e_phoff = struct.unpack_from("<Q", data, 32)[0]
    e_phentsize = struct.unpack_from("<H", data, 54)[0]
    e_phnum = struct.unpack_from("<H", data, 56)[0]
    segs = []
    for i in range(e_phnum):
        off = e_phoff + i * e_phentsize
        p_type, p_flags = struct.unpack_from("<II", data, off)
        p_offset, p_vaddr, _p_paddr, p_filesz, _p_memsz = struct.unpack_from(
            "<QQQQQ", data, off + 8
        )
        if p_type == 1 and (p_flags & 1):
            segs.append((p_offset, p_vaddr, p_filesz))
    if not segs:
        raise ValueError("no executable PT_LOAD segment")
    return segs


def _hw(w: int) -> int:
    return (w >> 21) & 3


def _imm16(w: int) -> int:
    return (w >> 5) & 0xFFFF


def _rd(w: int) -> int:
    return w & 0x1F


def iter_u64_immediates(text: bytes, window: int = 24) -> list[tuple[int, int]]:
    out: list[tuple[int, int]] = []
    n = len(text) // 4
    for i in range(n):
        w = struct.unpack_from("<I", text, i * 4)[0]
        if (w & _OPC_MASK) != _MOVZ_X or _hw(w) != 0:
            continue
        reg = _rd(w)
        parts = {0: _imm16(w)}
        last = 0
        for j in range(1, window):
            if i + j >= n:
                break
            w2 = struct.unpack_from("<I", text, (i + j) * 4)[0]
            if (w2 & _OPC_MASK) == _MOVK_X and _rd(w2) == reg:
                parts[_hw(w2)] = _imm16(w2)
                last = j
            elif (w2 & _OPC_MASK) == _MOVZ_X and _rd(w2) == reg and _hw(w2) == 0:
                break
        if all(k in parts for k in (0, 1, 2, 3)):
            val = (
                parts[0]
                | (parts[1] << 16)
                | (parts[2] << 32)
                | (parts[3] << 48)
            )
            out.append((val, last + 1))
    return out


def find_format_anchor_vas(text: bytes, text_vaddr: int) -> list[int]:
    hits = []
    n = len(text) // 4
    for i in range(n):
        w0 = struct.unpack_from("<I", text, i * 4)[0]
        if (w0 & _OPC_MASK) != 0x52800000:
            continue
        if _imm16(w0) != 0x3025 or _hw(w0) != 0:
            continue
        for gap in (1, 2, 3):
            if i + gap >= n:
                break
            w1 = struct.unpack_from("<I", text, (i + gap) * 4)[0]
            if (w1 & _OPC_MASK) != 0x72800000:
                continue
            if _imm16(w1) == 0x3631 and _hw(w1) == 1 and _rd(w1) == _rd(w0):
                hits.append(text_vaddr + i * 4)
                break
    return hits


def candidates_from_so(so: Path) -> tuple[list[int], list[int]]:
    data = so.read_bytes()
    ranked: dict[int, int] = {}
    format_vas: list[int] = []
    for file_off, vaddr, size in _elf_exec_segments(data):
        text = data[file_off : file_off + size]
        for val, span in iter_u64_immediates(text):
            prev = ranked.get(val)
            if prev is None or span < prev:
                ranked[val] = span
        format_vas.extend(find_format_anchor_vas(text, vaddr))
    return sorted(ranked.keys(), key=lambda v: (ranked[v], v)), format_vas


def unzip_test(jet: Path, password: str, member: str) -> bool:
    r = subprocess.run(
        ["unzip", "-P", password, "-t", str(jet), member],
        capture_output=True,
        text=True,
    )
    return r.returncode == 0 and "incorrect password" not in r.stderr


def find_password(so: Path, jet: Path, probe: str) -> str:
    cands, format_vas = candidates_from_so(so)
    if not cands:
        raise SystemExit(f"no movz/movk u64 immediates in {so}")

    for val in cands:
        pw = f"{val:016X}"
        if unzip_test(jet, pw, probe):
            return pw

    tip = ""
    if format_vas:
        tip = (
            "\nFound '%016…' format immediates at VA "
            + ", ".join(f"0x{v:x}" for v in format_vas[:8])
            + " — walk backward to the password seed mov/movk quartet."
        )
    raise SystemExit(
        f"tried {len(cands)} seed candidates; none opened {probe!r} in {jet}.{tip}\n"
        "Use the same Android build's arm64-v8a libnative.so and data.jet. "
        "If NK changed the scheme, re-RE the mixer seed (see -h)."
    )


def extract_to_assets(jet: Path, password: str, assets_dir: Path) -> None:
    """Unzip jet members into assets_dir (expects archive paths Assets/...)."""
    parent = assets_dir.parent
    with tempfile.TemporaryDirectory(prefix="btdb-jet-", dir=parent) as tmp:
        tmp_path = Path(tmp)
        r = subprocess.run(
            ["unzip", "-P", password, "-d", str(tmp_path), str(jet)],
            capture_output=True,
            text=True,
        )
        if r.returncode not in (0, 1):
            raise SystemExit(f"unzip failed ({r.returncode}): {r.stderr[-500:]}")
        if "incorrect password" in r.stderr:
            raise SystemExit(f"unzip failed: incorrect password\n{r.stderr[-500:]}")

        unpacked = tmp_path / "Assets"
        if not unpacked.is_dir():
            raise SystemExit(
                f"unzip ok but no Assets/ at top level under {tmp_path}; "
                f"got: {[p.name for p in tmp_path.iterdir()][:20]}"
            )
        if assets_dir.exists():
            shutil.rmtree(assets_dir)
        shutil.move(str(unpacked), str(assets_dir))


def main() -> None:
    ap = argparse.ArgumentParser(
        prog="extract-data-jet.py",
        description=(
            "Find the Android Bloons TD Battles data.jet pack password in "
            "arm64-v8a libnative.so and unpack Asset JSON for this save editor's catalogs."
        ),
        epilog=_EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument(
        "--so",
        type=Path,
        required=True,
        help="Android arm64-v8a libnative.so from the same APK build as data.jet",
    )
    ap.add_argument(
        "--jet",
        type=Path,
        required=True,
        help="password-protected data.jet (usually assets/Assets/data.jet in an APK unpack)",
    )
    ap.add_argument(
        "--assets",
        type=Path,
        default=DEFAULT_ASSETS,
        help=f"output directory for unpacked Assets (default: {DEFAULT_ASSETS})",
    )
    ap.add_argument(
        "--probe",
        default=DEFAULT_PROBE,
        help=f"encrypted zip member for unzip -t (default: {DEFAULT_PROBE})",
    )
    ap.add_argument(
        "--password-only",
        action="store_true",
        help="print pack password to stdout and exit (do not write Assets/)",
    )
    args = ap.parse_args()

    if not args.so.is_file():
        raise SystemExit(f"missing native lib: {args.so}")
    if not args.jet.is_file():
        raise SystemExit(f"missing data.jet: {args.jet}")

    password = find_password(args.so, args.jet, args.probe)
    print(password)
    if args.password_only:
        return
    extract_to_assets(args.jet, password, args.assets)
    print(f"wrote {args.assets}", file=sys.stderr)
    print("next: npm run extract-catalogs", file=sys.stderr)


if __name__ == "__main__":
    main()
