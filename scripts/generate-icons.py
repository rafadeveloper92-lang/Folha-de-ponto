#!/usr/bin/env python3
"""Gera PNGs de ícone (192 e 512) sem dependências externas — fundo escuro + círculo vermelho."""
import struct
import zlib
from pathlib import Path


def png_chunk(tag: bytes, data: bytes) -> bytes:
    crc = zlib.crc32(tag + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)


def write_icon(path: Path, size: int) -> None:
    bg = (20, 20, 20, 255)
    fg = (229, 9, 20, 255)
    cx, cy = size // 2, size // 2
    r = int(size * 0.32)
    raw = bytearray()
    for y in range(size):
        raw.append(0)  # filter None
        for x in range(size):
            dx, dy = x - cx, y - cy
            if dx * dx + dy * dy <= r * r:
                raw.extend(fg)
            else:
                raw.extend(bg)
    compressed = zlib.compress(bytes(raw), 9)
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    body = sig + png_chunk(b"IHDR", ihdr) + png_chunk(b"IDAT", compressed) + png_chunk(b"IEND", b"")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(body)


def main() -> None:
    root = Path(__file__).resolve().parent.parent / "public"
    write_icon(root / "icon-192.png", 192)
    write_icon(root / "icon-512.png", 512)
    print("Wrote", root / "icon-192.png", root / "icon-512.png")


if __name__ == "__main__":
    main()
