/* Afficheur client d'une caisse : une matrice de points 5×7, dessinée sur un
   canvas. Une ligne sur grand écran, deux sur téléphone. Les points s'allument
   vite et s'éteignent lentement, comme un vrai tube fluorescent. */
(function () {
  'use strict';

  // Une entrée = 5 colonnes de 7 points, le bit de poids faible en haut.
  const GLYPHES = {
    ' ': [0, 0, 0, 0, 0], '!': [0, 0, 0x5f, 0, 0], "'": [0, 5, 3, 0, 0],
    ',': [0, 0x50, 0x30, 0, 0], '-': [8, 8, 8, 8, 8], '.': [0, 0x60, 0x60, 0, 0],
    '/': [0x20, 0x10, 8, 4, 2], ':': [0, 0x36, 0x36, 0, 0], '+': [8, 8, 0x3e, 8, 8],
    '?': [2, 1, 0x51, 9, 6], '>': [0x41, 0x22, 0x14, 8, 0],
    0: [0x3e, 0x51, 0x49, 0x45, 0x3e], 1: [0, 0x42, 0x7f, 0x40, 0], 2: [0x42, 0x61, 0x51, 0x49, 0x46],
    3: [0x21, 0x41, 0x45, 0x4b, 0x31], 4: [0x18, 0x14, 0x12, 0x7f, 0x10], 5: [0x27, 0x45, 0x45, 0x45, 0x39],
    6: [0x3c, 0x4a, 0x49, 0x49, 0x30], 7: [1, 0x71, 9, 5, 3], 8: [0x36, 0x49, 0x49, 0x49, 0x36],
    9: [6, 0x49, 0x49, 0x29, 0x1e],
    A: [0x7e, 0x11, 0x11, 0x11, 0x7e], B: [0x7f, 0x49, 0x49, 0x49, 0x36], C: [0x3e, 0x41, 0x41, 0x41, 0x22],
    D: [0x7f, 0x41, 0x41, 0x22, 0x1c], E: [0x7f, 0x49, 0x49, 0x49, 0x41], F: [0x7f, 9, 9, 1, 1],
    G: [0x3e, 0x41, 0x41, 0x51, 0x32], H: [0x7f, 8, 8, 8, 0x7f], I: [0, 0x41, 0x7f, 0x41, 0],
    J: [0x20, 0x40, 0x41, 0x3f, 1], K: [0x7f, 8, 0x14, 0x22, 0x41], L: [0x7f, 0x40, 0x40, 0x40, 0x40],
    M: [0x7f, 2, 4, 2, 0x7f], N: [0x7f, 4, 8, 0x10, 0x7f], O: [0x3e, 0x41, 0x41, 0x41, 0x3e],
    P: [0x7f, 9, 9, 9, 6], Q: [0x3e, 0x41, 0x51, 0x21, 0x5e], R: [0x7f, 9, 0x19, 0x29, 0x46],
    S: [0x46, 0x49, 0x49, 0x49, 0x31], T: [1, 1, 0x7f, 1, 1], U: [0x3f, 0x40, 0x40, 0x40, 0x3f],
    V: [0x1f, 0x20, 0x40, 0x20, 0x1f], W: [0x7f, 0x20, 0x18, 0x20, 0x7f], X: [0x63, 0x14, 8, 0x14, 0x63],
    Y: [3, 4, 0x78, 4, 3], Z: [0x61, 0x51, 0x49, 0x45, 0x43],
  };

  const VERT = 1;
  const OR = 2;
  const TEINTES = {
    [VERT]: ['#E9FFF4', '#7CF0BA', 'rgba(63,185,131,.34)'],
    [OR]: ['#FFF3D9', '#FFC76B', 'rgba(232,166,59,.34)'],
  };
  const PAS_DEFILEMENT = 52; // ms par colonne
  const calme = window.matchMedia('(prefers-reduced-motion: reduce)');

  const sansAccent = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

  /** Texte ou segments [{t, c}] → liste de colonnes { b: points, c: teinte }. */
  function enColonnes(contenu, teinte) {
    const segments = typeof contenu === 'string' ? [{ t: contenu, c: teinte || VERT }] : contenu;
    const sortie = [];
    for (const seg of segments) {
      for (const lettre of sansAccent(seg.t)) {
        const g = GLYPHES[lettre] || GLYPHES[' '];
        for (const b of g) sortie.push({ b, c: seg.c });
        sortie.push({ b: 0, c: seg.c });
      }
    }
    sortie.pop();
    return sortie;
  }

  class Afficheur {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.pistes = [];
      this.visible = true;
      this.fin = null;
      this.dimensionner();
      new ResizeObserver(() => this.dimensionner()).observe(canvas.parentElement);
      new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.relancer(); }).observe(canvas);
      document.addEventListener('visibilitychange', () => this.relancer());
      this.boucle = this.boucle.bind(this);
      this.dernier = 0;
      this.tourne = false;
      this.relancer();
    }

    dimensionner() {
      const largeur = this.canvas.parentElement.clientWidth;
      if (!largeur || largeur === this.largeur) return;
      this.largeur = largeur;
      this.deuxLignes = largeur < 620;
      this.cols = this.deuxLignes ? 39 : 71;
      this.rangs = this.deuxLignes ? 17 : 9;
      this.pas = largeur / this.cols;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.echelle = dpr;
      this.canvas.width = Math.round(largeur * dpr);
      this.canvas.height = Math.round(this.rangs * this.pas * dpr);
      this.canvas.style.height = `${Math.round(this.rangs * this.pas)}px`;
      const n = this.cols * this.rangs;
      this.lum = new Float32Array(n);
      this.teinte = new Uint8Array(n);
      this.cible = new Uint8Array(n);
      this.retard = null;
      this.preparerDessin();
      if (this.contenu) this.montrer(...this.contenu);
    }

    preparerDessin() {
      const p = this.pas * this.echelle;
      const r = p * 0.34;
      // Le fond : les points éteints, dessinés une seule fois.
      this.fond = document.createElement('canvas');
      this.fond.width = this.canvas.width;
      this.fond.height = this.canvas.height;
      const f = this.fond.getContext('2d');
      f.fillStyle = 'rgba(124,240,186,.07)';
      for (let y = 0; y < this.rangs; y++) {
        for (let x = 0; x < this.cols; x++) {
          f.beginPath();
          f.arc((x + 0.5) * p, (y + 0.5) * p, r, 0, 7);
          f.fill();
        }
      }
      // Un point allumé, avec son halo : un tampon par teinte.
      this.tampons = {};
      const t = Math.ceil(p * 3.2);
      for (const c of [VERT, OR]) {
        const [coeur, corps, halo] = TEINTES[c];
        const s = document.createElement('canvas');
        s.width = s.height = t;
        const g = s.getContext('2d');
        const m = t / 2;
        const grad = g.createRadialGradient(m, m, 0, m, m, m);
        grad.addColorStop(0, halo);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, t, t);
        const point = g.createRadialGradient(m, m, 0, m, m, r * 1.12);
        point.addColorStop(0, coeur);
        point.addColorStop(0.55, corps);
        point.addColorStop(1, corps);
        g.fillStyle = point;
        g.beginPath();
        g.arc(m, m, r * 1.12, 0, 7);
        g.fill();
        this.tampons[c] = s;
      }
      this.tailleTampon = t;
    }

    /** Fait apparaître les points un à un, au démarrage de la page. */
    allumer() {
      if (calme.matches) return;
      const n = this.cols * this.rangs;
      this.retard = new Float32Array(n);
      const t = performance.now();
      for (let i = 0; i < n; i++) this.retard[i] = t + 120 + Math.random() * 620;
    }

    /** Une ou deux informations. Renvoie une promesse tenue à la fin du défilement éventuel. */
    montrer(a, b, options = {}) {
      this.contenu = [a, b, options];
      const lignes = [a, b].filter((x) => x != null && x !== '').map((x) => enColonnes(x, x === b ? OR : VERT));
      this.pistes = [];
      const debut = performance.now();
      const boucler = !!options.boucler;

      const piste = (colonnes, y, x) => {
        const tropLong = colonnes.length > this.cols - 2;
        if (tropLong && !calme.matches) {
          this.pistes.push({ colonnes, y, defile: true, debut, boucler });
        } else {
          const fixe = x != null ? x : Math.max(0, Math.round((this.cols - colonnes.length) / 2));
          this.pistes.push({ colonnes, y, x: fixe });
        }
      };

      if (this.deuxLignes) {
        if (lignes.length === 1) piste(lignes[0], 5);
        else { piste(lignes[0], 1); piste(lignes[1], 9); }
      } else if (lignes.length === 1) {
        piste(lignes[0], 1);
      } else {
        const somme = lignes[0].length + lignes[1].length + 5;
        if (somme <= this.cols - 2) {
          piste(lignes[0], 1, 2);
          piste(lignes[1], 1, this.cols - 2 - lignes[1].length);
        } else {
          piste([...lignes[0], ...Array(11).fill({ b: 0, c: VERT }), ...lignes[1]], 1);
        }
      }
      this.relancer();
      const defile = this.pistes.find((p) => p.defile && !p.boucler);
      if (!defile) return Promise.resolve();
      return new Promise((tenir) => { this.fin = tenir; });
    }

    relancer() {
      if (this.tourne || !this.visible || document.hidden) return;
      this.tourne = true;
      requestAnimationFrame(this.boucle);
    }

    composer(t) {
      const { cible, teinte, cols, rangs } = this;
      cible.fill(0);
      let termine = false;
      for (const p of this.pistes) {
        let x0 = p.x;
        if (p.defile) {
          const parcours = p.colonnes.length + cols;
          const pas = Math.floor((t - p.debut) / PAS_DEFILEMENT);
          if (!p.boucler && pas >= parcours) { termine = true; continue; }
          x0 = cols - (pas % parcours);
        }
        const debut = Math.max(0, -x0);
        const fin = Math.min(p.colonnes.length, cols - x0);
        for (let i = debut; i < fin; i++) {
          const { b, c } = p.colonnes[i];
          if (!b) continue;
          for (let y = 0; y < 7; y++) {
            if (b & (1 << y)) {
              const ry = p.y + y;
              if (ry >= rangs) continue;
              const k = ry * cols + x0 + i;
              cible[k] = 1;
              teinte[k] = c;
            }
          }
        }
      }
      if (termine && this.fin) { const f = this.fin; this.fin = null; f(); }
    }

    boucle(t) {
      this.tourne = false;
      if (!this.visible || document.hidden) return;
      this.tourne = true;
      requestAnimationFrame(this.boucle);
      if (t - this.dernier < 33) return;
      this.dernier = t;
      this.composer(t);

      const { lum, cible, retard, cols } = this;
      let bouge = false;
      for (let i = 0; i < lum.length; i++) {
        const voulu = cible[i] && !(retard && t < retard[i]) ? 1 : 0;
        const avant = lum[i];
        const apres = voulu ? avant + (1 - avant) * 0.6 : avant * 0.72;
        const net = apres < 0.012 ? 0 : apres > 0.992 ? 1 : apres;
        if (net !== avant) { lum[i] = net; bouge = true; }
      }
      if (!bouge) return;

      const { ctx, tampons, tailleTampon: s } = this;
      const p = this.pas * this.echelle;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.drawImage(this.fond, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < lum.length; i++) {
        const l = lum[i];
        if (!l) continue;
        const x = (i % cols + 0.5) * p - s / 2;
        const y = (Math.floor(i / cols) + 0.5) * p - s / 2;
        ctx.globalAlpha = l;
        ctx.drawImage(tampons[this.teinte[i] || VERT], x, y);
      }
    }
  }

  Afficheur.VERT = VERT;
  Afficheur.OR = OR;
  window.Afficheur = Afficheur;
})();
