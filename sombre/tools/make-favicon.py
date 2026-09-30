"""Construit favicon.ico : le symbole du logo (quatre tuiles carrées, dont une en contour) sur fond sombre.

Usage (depuis la racine du mashup) :
    python tools/make-favicon.py

Pourquoi un fond : un symbole blanc seul disparaît sur l'onglet d'un navigateur clair. Le fond sombre
reprend --dark-1 du thème (#1A171B), à angles droits comme tout le mashup.
Trois tailles (16, 32, 48 px) tracées à la main sur une grille alignée sur les pixels : pas
d'anticrénelage, donc aucun flou. Le fichier .ico contient des images PNG (lues par tous les navigateurs
actuels). Pur Python : ni Pillow ni autre dépendance.
"""
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'favicon.ico'
BACKGROUND = (0x1A, 0x17, 0x1B, 255)     # --dark-1
FOREGROUND = (255, 255, 255, 255)

# taille : (marge, côté d'une tuile, espace entre tuiles, épaisseur du contour). marge*2 + tuile*2 + espace = taille.
LAYOUT = {
    16: (2, 5, 2, 1),
    32: (4, 10, 4, 2),
    48: (6, 15, 6, 3),
}


def draw(size):
    margin, tile, gap, stroke = LAYOUT[size]
    assert margin * 2 + tile * 2 + gap == size
    pixels = [[BACKGROUND] * size for _ in range(size)]

    def rect(x0, y0, w, h, color):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                pixels[y][x] = color

    for row in range(2):
        for col in range(2):
            x0 = margin + col * (tile + gap)
            y0 = margin + row * (tile + gap)
            rect(x0, y0, tile, tile, FOREGROUND)
            if (row, col) == (0, 1):            # tuile en contour : on évide l'intérieur
                rect(x0 + stroke, y0 + stroke, tile - 2 * stroke, tile - 2 * stroke, BACKGROUND)
    return pixels


def png(pixels):
    height, width = len(pixels), len(pixels[0])
    raw = b''.join(b'\x00' + b''.join(bytes(p) for p in row) for row in pixels)   # filtre 0 par ligne

    def chunk(kind, payload):
        body = kind + payload
        return struct.pack('>I', len(payload)) + body + struct.pack('>I', zlib.crc32(body) & 0xFFFFFFFF)

    header = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)               # 8 bits, RGBA
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')


images = [(size, png(draw(size))) for size in sorted(LAYOUT)]
directory, offset = b'', 6 + 16 * len(images)
for size, data in images:
    directory += struct.pack('<BBBBHHII', size, size, 0, 0, 1, 32, len(data), offset)
    offset += len(data)
OUT.write_bytes(struct.pack('<HHH', 0, 1, len(images)) + directory + b''.join(data for _, data in images))
print(f'{OUT.name} écrit : {OUT.stat().st_size} octets, tailles {[s for s, _ in images]}')
