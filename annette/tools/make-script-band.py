"""Construit img/script.svg : un texte manuscrit courant sur plusieurs lignes, en tracés SVG (bandeau décoratif).

Usage (depuis la racine du mashup) :
    python tools/make-script-band.py <police.ttf> <texte.txt> [sortie.svg]

Le texte est lu tel quel, ses lignes sont mises bout à bout (comme un texte écrit au fil de la plume) puis
coupées à la largeur du bandeau. Chaque lettre est un tracé défini une seule fois (<path id>) et réutilisé
(<use>), avec un léger décalage de ligne de base et d'inclinaison propre à chaque occurrence, déterministe,
pour l'allure d'une écriture à la main. Aucune police n'est requise à l'affichage.

Le lecteur TrueType est celui de make-logo.py : on en exécute la partie « lecture de police » (jusqu'à la
section « Mise en page ») plutôt que de la dupliquer.
"""
import random
import struct
import sys
from pathlib import Path

if len(sys.argv) < 3:
    raise SystemExit(__doc__)
FONT = Path(sys.argv[1])
TEXT = Path(sys.argv[2]).read_text(encoding='utf-8')
OUT = Path(sys.argv[3]) if len(sys.argv) > 3 else Path(__file__).resolve().parent.parent / 'img' / 'script.svg'

source = (Path(__file__).resolve().parent / 'make-logo.py').read_text(encoding='utf-8')
start, end = source.index('data = FONT.read_bytes()'), source.index('# ---- Mise en page')
reader = {'FONT': FONT, 'struct': struct, 'sys': sys}
exec(compile(source[start:end], 'make-logo.py (lecteur)', 'exec'), reader)
cmap_lookup, advance, glyph_contours, contour_path = (reader[k] for k in ('cmap_lookup', 'advance', 'glyph_contours', 'contour_path'))
units = reader['units_per_em']

W, H = 1600, 280                  # dimensions du dessin
SIZE = 32.0                       # corps du texte, en px du dessin
LEADING = 46.0                    # distance entre deux lignes de base
MARGIN = 14.0
FILL = '#ABABAB'                 # gris : le texte est un décor, il ne doit pas concurrencer le titre
scale = SIZE / units

# Caractères que la police ne sait pas dessiner : repli sur une forme proche.
FALLBACK = {'’': "'", '«': '"', '»': '"', ' ': ' '}


def glyph_for(char):
    try:
        return cmap_lookup(char)
    except SystemExit:
        return cmap_lookup(FALLBACK.get(char, ' '))


# Texte continu : un espace entre les lignes du poème, deux entre les strophes.
words = ' '.join(line.strip() if line.strip() else ' ' for line in TEXT.splitlines()).split(' ')
space = advance(glyph_for(' ')) * scale or SIZE * 0.3

rows, row, x = [], [], MARGIN
for word in words:
    width = sum(advance(glyph_for(c)) * scale for c in word)
    if row and x + width > W - MARGIN:
        rows.append(row)
        row, x = [], MARGIN + (len(rows) % 2) * 34        # retrait alterné d'une ligne à l'autre
    row.append((x, word))
    x += width + space
rows.append(row)
rows = rows[: int((H - MARGIN) // LEADING)]

rng = random.Random(1558)         # graine fixe : le dessin est identique à chaque exécution
defs, uses, ids = {}, [], {}
for r, line in enumerate(rows):
    baseline = MARGIN + SIZE * 0.78 + r * LEADING
    for x0, word in line:
        x = x0
        for char in word:
            glyph = glyph_for(char)
            contours, _ = glyph_contours(glyph)
            if contours:
                if char not in ids:
                    ids[char] = f'g{len(ids)}'
                    place = lambda gx, gy: (round(gx * scale, 1), round(-gy * scale, 1))
                    defs[char] = ''.join(contour_path(c, place) for c in contours)
                dy = rng.uniform(-1.6, 1.6)
                rot = rng.uniform(-2.2, 2.2)
                uses.append(f'<use href="#{ids[char]}" transform="translate({x:.1f} {baseline + dy:.1f}) rotate({rot:.1f})"/>')
            x += advance(glyph) * scale
        # l'espace entre deux mots est ajoutée par la mise en page ci-dessus

paths = '\n    '.join(f'<path id="{ids[c]}" d="{d}"/>' for c, d in defs.items())
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" aria-hidden="true">
  <!-- Bandeau décoratif : texte manuscrit en Reenie Beanie (SIL OFL 1.1) converti en tracés par
       tools/make-script-band.py. Aucune police requise. -->
  <defs>
    {paths}
  </defs>
  <g fill="{FILL}">
    {chr(10).join('    ' + u if i else u for i, u in enumerate(uses))}
  </g>
</svg>
'''
OUT.write_text(svg, encoding='utf-8', newline='\n')
print(f'{OUT.name} écrit : {len(svg) // 1024} Ko, {len(rows)} lignes, {len(uses)} lettres, {len(defs)} formes')
