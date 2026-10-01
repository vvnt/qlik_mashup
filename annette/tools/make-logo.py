"""Construit img/logo.svg : un mot composé avec une vraie police, converti en tracés SVG.

Usage (depuis la racine du mashup) :
    python tools/make-logo.py <police.ttf> [Mot] [sortie.svg]

Pourquoi des tracés : un SVG chargé par une balise <img> n'a pas accès aux polices de la page. En
convertissant les lettres en chemins, le logo est identique partout, sans police à charger.
La police doit être un TrueType statique (ici Reenie Beanie, SIL OFL 1.1 : tools/_src/ReenieBeanie.ttf). Lecteur TrueType minimal en Python pur : glyphes
simples et composites, cmap format 4 ou 12, hmtx ; pas de dépendance (ni fontTools ni brotli).
Le crénage (GPOS) n'est pas lu : les paires à resserrer sont listées dans KERN.
"""
import struct
import sys
from pathlib import Path

if len(sys.argv) < 2:
    raise SystemExit(__doc__)
FONT = Path(sys.argv[1])
OUT = Path(sys.argv[3]) if len(sys.argv) > 3 else Path(__file__).resolve().parent.parent / 'img' / 'logo.svg'
WORD = sys.argv[2] if len(sys.argv) > 2 else 'Vireo'
KERN = {}                              # paires à resserrer, en fraction de l'em

data = FONT.read_bytes()
count = struct.unpack('>H', data[4:6])[0]
tables = {}
for i in range(count):
    tag, _, offset, length = struct.unpack('>4sIII', data[12 + 16 * i:28 + 16 * i])
    tables[tag.decode()] = offset

units_per_em = struct.unpack('>H', data[tables['head'] + 18:tables['head'] + 20])[0]
loc_format = struct.unpack('>h', data[tables['head'] + 50:tables['head'] + 52])[0]
num_glyphs = struct.unpack('>H', data[tables['maxp'] + 4:tables['maxp'] + 6])[0]
num_metrics = struct.unpack('>H', data[tables['hhea'] + 34:tables['hhea'] + 36])[0]


def advance(glyph):
    index = min(glyph, num_metrics - 1)
    return struct.unpack('>H', data[tables['hmtx'] + 4 * index:tables['hmtx'] + 4 * index + 2])[0]


def cmap_lookup(char):
    base = tables['cmap']
    n_sub = struct.unpack('>H', data[base + 2:base + 4])[0]
    for i in range(n_sub):
        platform, encoding, offset = struct.unpack('>HHI', data[base + 4 + 8 * i:base + 12 + 8 * i])
        if (platform, encoding) not in ((3, 1), (0, 3), (0, 4), (3, 10)):
            continue
        sub = base + offset
        fmt = struct.unpack('>H', data[sub:sub + 2])[0]
        code = ord(char)
        if fmt == 4:
            seg_x2 = struct.unpack('>H', data[sub + 6:sub + 8])[0]
            seg = seg_x2 // 2
            ends = struct.unpack(f'>{seg}H', data[sub + 14:sub + 14 + seg_x2])
            starts = struct.unpack(f'>{seg}H', data[sub + 16 + seg_x2:sub + 16 + 2 * seg_x2])
            deltas = struct.unpack(f'>{seg}h', data[sub + 16 + 2 * seg_x2:sub + 16 + 3 * seg_x2])
            range_offset_pos = sub + 16 + 3 * seg_x2
            ranges = struct.unpack(f'>{seg}H', data[range_offset_pos:range_offset_pos + seg_x2])
            for s in range(seg):
                if starts[s] <= code <= ends[s]:
                    if ranges[s] == 0:
                        return (code + deltas[s]) & 0xFFFF
                    glyph_pos = range_offset_pos + 2 * s + ranges[s] + 2 * (code - starts[s])
                    glyph = struct.unpack('>H', data[glyph_pos:glyph_pos + 2])[0]
                    return (glyph + deltas[s]) & 0xFFFF if glyph else 0
        elif fmt == 12:
            groups = struct.unpack('>I', data[sub + 12:sub + 16])[0]
            for g in range(groups):
                start, end, first = struct.unpack('>III', data[sub + 16 + 12 * g:sub + 28 + 12 * g])
                if start <= code <= end:
                    return first + code - start
    raise SystemExit(f'caractère absent de la police : {char!r}')


def glyph_offsets(glyph):
    loca = tables['loca']
    if loc_format == 0:
        a, b = struct.unpack('>HH', data[loca + 2 * glyph:loca + 2 * glyph + 4])
        return a * 2, b * 2
    return struct.unpack('>II', data[loca + 4 * glyph:loca + 4 * glyph + 8])


def composite_contours(pos):
    """Glyphe composite : assemble ses composants (translation et échelle simples)."""
    contours = []
    while True:
        flags, component = struct.unpack('>HH', data[pos:pos + 4])
        pos += 4
        if flags & 1:                                   # arguments sur 16 bits
            dx, dy = struct.unpack('>hh', data[pos:pos + 4]) if flags & 2 else (0, 0)
            pos += 4
        else:                                           # arguments sur 8 bits
            dx, dy = struct.unpack('>bb', data[pos:pos + 2]) if flags & 2 else (0, 0)
            pos += 2
        a = d = 1.0
        b = c = 0.0
        if flags & 8:                                   # échelle uniforme
            a = d = struct.unpack('>h', data[pos:pos + 2])[0] / 16384
            pos += 2
        elif flags & 0x40:                              # échelles x et y
            a, d = (v / 16384 for v in struct.unpack('>hh', data[pos:pos + 4]))
            pos += 4
        elif flags & 0x80:                              # matrice 2 x 2
            a, b, c, d = (v / 16384 for v in struct.unpack('>hhhh', data[pos:pos + 8]))
            pos += 8
        for contour in glyph_contours(component)[0]:
            contours.append([(a * x + c * y + dx, b * x + d * y + dy, on) for x, y, on in contour])
        if not flags & 0x20:                            # plus de composants
            return contours


def glyph_contours(glyph):
    start, end = glyph_offsets(glyph)
    if start == end:
        return [], (0, 0, 0, 0)
    pos = tables['glyf'] + start
    n_contours, x_min, y_min, x_max, y_max = struct.unpack('>hhhhh', data[pos:pos + 10])
    if n_contours < 0:
        return composite_contours(pos + 10), (x_min, y_min, x_max, y_max)
    pos += 10
    ends = struct.unpack(f'>{n_contours}H', data[pos:pos + 2 * n_contours])
    pos += 2 * n_contours
    instr_len = struct.unpack('>H', data[pos:pos + 2])[0]
    pos += 2 + instr_len
    n_points = ends[-1] + 1
    flags = []
    while len(flags) < n_points:
        flag = data[pos]
        pos += 1
        flags.append(flag)
        if flag & 8:
            repeat = data[pos]
            pos += 1
            flags.extend([flag] * repeat)

    def read_axis(short_bit, same_bit):
        nonlocal pos
        values, current = [], 0
        for flag in flags:
            if flag & short_bit:
                delta = data[pos]
                pos += 1
                current += delta if flag & same_bit else -delta
            elif not flag & same_bit:
                current += struct.unpack('>h', data[pos:pos + 2])[0]
                pos += 2
            values.append(current)
        return values

    xs = read_axis(2, 16)
    ys = read_axis(4, 32)
    points = [(xs[i], ys[i], bool(flags[i] & 1)) for i in range(n_points)]
    contours, first = [], 0
    for last in ends:
        contours.append(points[first:last + 1])
        first = last + 1
    return contours, (x_min, y_min, x_max, y_max)


def contour_path(points, place):
    """Contour TrueType (quadratique) → commandes de chemin SVG, coordonnées déjà placées."""
    if points[0][2]:
        start, seq = points[0], points[1:] + [points[0]]
    elif points[-1][2]:
        start, seq = points[-1], points[:]
    else:
        start = ((points[0][0] + points[-1][0]) / 2, (points[0][1] + points[-1][1]) / 2, True)
        seq = points[:] + [start]
    fmt = lambda p: '%g %g' % place(p[0], p[1])
    parts = ['M' + fmt(start)]
    i = 0
    while i < len(seq):
        p = seq[i]
        if p[2]:
            parts.append('L' + fmt(p))
            i += 1
        else:
            nxt = seq[i + 1]
            if nxt[2]:
                parts.append('Q' + fmt(p) + ' ' + fmt(nxt))
                i += 2
            else:
                mid = ((p[0] + nxt[0]) / 2, (p[1] + nxt[1]) / 2, True)
                parts.append('Q' + fmt(p) + ' ' + fmt(mid))
                i += 1
    return ''.join(parts) + 'Z'


# ---- Mise en page -----------------------------------------------------------------------------
# Mot manuscrit, noir, sans symbole. Le dessin est mis à l'échelle sur la hauteur de la lettre « l ».
ASC = 30.0                                     # hauteur voulue de la lettre « l », en px du dessin
PAD = 2.0                                      # marge autour du tracé
scale = ASC / glyph_contours(cmap_lookup('l'))[1][3]

x = 0.0
placed = []                                    # (contours, origine x)
previous = None
for char in WORD:
    glyph = cmap_lookup(char)
    if previous and (previous, char) in KERN:
        x += KERN[(previous, char)] * units_per_em * scale
    placed.append((glyph_contours(glyph)[0], x))
    x += advance(glyph) * scale
    previous = char

# Boîte englobante réelle du tracé (les approches de la police n'en font pas partie).
xs = [ox + px * scale for cs, ox in placed for c in cs for px, py, _ in c]
ys = [py * scale for cs, ox in placed for c in cs for px, py, _ in c]
left, right, bottom, top = min(xs) - PAD, max(xs) + PAD, min(ys) - PAD, max(ys) + PAD
width, height = round(right - left, 1), round(top - bottom, 1)

paths = []
for contours, origin in placed:
    place = lambda gx, gy, origin=origin: (round(origin + gx * scale - left, 2), round(top - gy * scale, 2))
    paths.extend(contour_path(c, place) for c in contours)

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:g} {height:g}" width="{width:g}" height="{height:g}" role="img" aria-labelledby="t">
  <title id="t">{WORD}</title>
  <!-- Logo manuscrit : le mot « {WORD} » composé en Reenie Beanie (SIL OFL 1.1) puis converti en tracés :
       aucune police requise, le rendu est identique partout, même chargé par une balise img. -->
  <path fill="#000000" d="{''.join(paths)}"/>
</svg>
'''
OUT.write_text(svg, encoding='utf-8', newline='\n')
print(f'{OUT.name} écrit : {len(svg)} octets, mot « {WORD} », largeur {width:g} × {height:g}, unités/em {units_per_em}')
