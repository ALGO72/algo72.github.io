# tirages.py : transforme une capture d'écran en « tirage » 1 bit, comme une
# imprimante thermique (tramage d'Atkinson), en deux largeurs.
# Usage : python outils/tirages.py <capture.png> <nom> [haut bas]
#   haut, bas : part de l'image gardée, de 0 à 1 (par défaut toute l'image).
import sys
from pathlib import Path
from PIL import Image, ImageEnhance, ImageOps

ICI = Path(__file__).resolve().parent.parent / 'img'
ENCRE = (23, 36, 29)  # #17241D


def atkinson(image):
    l, h = image.size
    px = [list(image.crop((0, y, l, y + 1)).getdata()) for y in range(h)]
    sortie = Image.new('P', (l, h))
    sortie.putpalette(list(ENCRE) + [255, 255, 255])
    for y in range(h):
        ligne = px[y]
        for x in range(l):
            ancien = ligne[x]
            neuf = 255 if ancien >= 128 else 0
            ligne[x] = neuf
            erreur = (ancien - neuf) / 8
            for dx, dy in ((1, 0), (2, 0), (-1, 1), (0, 1), (1, 1), (0, 2)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < l and ny < h:
                    px[ny][nx] += erreur
    sortie.putdata([0 if v < 128 else 1 for rang in px for v in rang])
    return sortie


def tirage(source, nom, haut=0.0, bas=1.0):
    image = Image.open(source).convert('L')
    l, h = image.size
    image = image.crop((0, round(h * haut), l, round(h * bas)))
    image = ImageOps.autocontrast(image, cutoff=1)
    # Les gris clairs de l'écran doivent rester visibles en points, pas partir en blanc.
    image = image.point(lambda v: round(255 * (v / 255) ** 1.7))
    for largeur in (384, 288):
        hauteur = round(image.height * largeur / image.width)
        reduite = image.resize((largeur, hauteur), Image.LANCZOS)
        reduite = ImageEnhance.Sharpness(reduite).enhance(1.6)
        fichier = ICI / f'tirage-{nom}-{largeur}.png'
        # Le blanc est transparent : seul le noir « imprime » sur le papier.
        atkinson(reduite).save(fichier, optimize=True, transparency=1, bits=1)
        print(f'{fichier.name} : {largeur}x{hauteur}, {fichier.stat().st_size // 1024} Ko')


if __name__ == '__main__':
    arguments = sys.argv[1:]
    tirage(arguments[0], arguments[1], *(float(a) for a in arguments[2:4]))
