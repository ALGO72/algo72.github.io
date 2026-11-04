/* La caisse de démonstration. Mêmes produits, mêmes messages et même logique
   que Gab-POS Tech, en miniature : la vente s'écrit d'abord sur l'appareil,
   avec une clé unique, et part au serveur quand le réseau revient. */
(function () {
  'use strict';

  const { VERT, OR } = window.Afficheur;
  const CLE_STOCKAGE = 'caisse-demo-djabir';
  const VENTES_MONTREES = 3;

  const PRODUITS = [
    { id: 'poulet', nom: 'Poulet braisé entier', prix: 5000, stock: 12, seuil: 5 },
    { id: 'capitaine', nom: 'Capitaine braisé', prix: 4500, stock: 4, seuil: 5 },
    { id: 'brochettes', nom: 'Brochettes de bœuf', prix: 1500, stock: 26, seuil: 10 },
    { id: 'alloco', nom: 'Alloco', prix: 1000, stock: 3, seuil: 8 },
    { id: 'attieke', nom: 'Attiéké', prix: 1000, stock: 30, seuil: 10 },
    { id: 'regab', nom: 'Régab 65cl', prix: 1000, stock: 48, seuil: 24 },
    { id: 'castel', nom: 'Castel 65cl', prix: 1200, stock: 36, seuil: 24 },
    { id: 'bissap', nom: 'Jus de bissap', prix: 700, stock: 20, seuil: 8 },
  ];

  const $ = (s) => document.querySelector(s);
  const fcfa = (n) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const deuxChiffres = (n) => String(n).padStart(2, '0');
  const heure = (d = new Date()) => `${deuxChiffres(d.getHours())}:${deuxChiffres(d.getMinutes())}`;
  const dateCourte = (d) => `${deuxChiffres(d.getDate())}/${deuxChiffres(d.getMonth() + 1)}/${d.getFullYear()}`;
  const nouvelleCle = () => Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  const echapper = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const el = {
    produits: $('#produits'), encaisser: $('#encaisser'), vider: $('#vider'), reseau: $('#reseau'),
    etat: $('#etat-reseau'), alerte: $('#alerte'), journal: $('#journal'), terminal: $('#terminal'),
    ventes: $('#ticket-ventes'), lignes: $('#ticket-lignes'), vide: $('#ticket-vide'),
    total: $('#ticket-total'), somme: $('#ticket-somme'),
  };
  if (!el.produits) return;

  const afficheur = new window.Afficheur($('#afficheur'));

  // ── État. Les ventes survivent à un rechargement de la page, comme dans la vraie caisse. ──
  const etat = { panier: {}, stock: {}, ventes: [], compteur: 0, reseau: true, etapes: {}, envoi: false };

  function sauver() {
    try {
      localStorage.setItem(CLE_STOCKAGE, JSON.stringify({
        stock: etat.stock, ventes: etat.ventes, compteur: etat.compteur, etapes: etat.etapes,
      }));
    } catch (e) { /* navigation privée : la démo marche, sans mémoire */ }
  }

  function charger() {
    PRODUITS.forEach((p) => { etat.stock[p.id] = p.stock; });
    try {
      const lu = JSON.parse(localStorage.getItem(CLE_STOCKAGE));
      if (lu) {
        Object.assign(etat.stock, lu.stock);
        etat.ventes = lu.ventes || [];
        etat.compteur = lu.compteur || 0;
        etat.etapes = lu.etapes || {};
      }
    } catch (e) { /* mémoire illisible : on repart de zéro */ }
  }

  // ── L'afficheur ──
  const REPOS = [
    { a: [{ t: 'DJABIR', c: VERT }, { t: ' ALGO', c: OR }], deux: ['DJABIR', 'ALGO'], ms: 5600 },
    { a: 'DEVELOPPEUR FULL-STACK - LIBREVILLE, GABON' },
    { a: [{ t: 'DJABIR', c: VERT }, { t: ' ALGO', c: OR }], deux: ['DJABIR', 'ALGO'], ms: 3200 },
    { a: 'TOUCHEZ UN PLAT POUR ESSAYER LA CAISSE' },
  ];
  let minuteur = 0;
  let tour = 0;

  function repos(indice = 0) {
    clearTimeout(minuteur);
    const jeton = ++tour;
    const scene = REPOS[indice % REPOS.length];
    const suite = () => { if (jeton === tour) repos(indice + 1); };
    if (scene.ms) {
      if (afficheur.deuxLignes) afficheur.montrer(scene.deux[0], scene.deux[1]);
      else afficheur.montrer(scene.a);
      minuteur = setTimeout(suite, scene.ms);
    } else {
      afficheur.montrer(scene.a).then(() => { minuteur = setTimeout(suite, 280); });
    }
  }

  function annoncer(a, b, ms = 1900) {
    clearTimeout(minuteur);
    tour++;
    afficheur.montrer(a, b);
    minuteur = setTimeout(apresAnnonce, ms);
  }

  function apresAnnonce() {
    const total = totalPanier();
    if (total) { tour++; afficheur.montrer('TOTAL', `${fcfa(total)} F`); } else repos();
  }

  // ── Calculs ──
  const dansPanier = (id) => etat.panier[id] || 0;
  const reste = (p) => etat.stock[p.id] - dansPanier(p.id);
  const totalPanier = () => PRODUITS.reduce((s, p) => s + p.prix * dansPanier(p.id), 0);
  const nbArticles = () => Object.values(etat.panier).reduce((s, n) => s + n, 0);
  const enAttente = () => etat.ventes.filter((v) => v.statut === 'attente');

  // ── Dessin ──
  function dessinerProduits() {
    el.produits.innerHTML = PRODUITS.map((p) => {
      const n = dansPanier(p.id);
      const r = reste(p);
      const badge = r <= 0 ? 'Rupture' : r <= p.seuil ? 'Stock faible' : '';
      return `<button type="button" class="produit${n ? ' choisi' : ''}" data-id="${p.id}"${r <= 0 && !n ? ' aria-disabled="true"' : ''}>
        <span class="produit-nom">${echapper(p.nom)}</span>
        <span class="produit-prix">${fcfa(p.prix)} <small>FCFA</small></span>
        ${badge ? `<span class="produit-badge">${badge}</span>` : ''}
        ${n ? `<span class="produit-qte" aria-label="${n} au ticket">${n}</span>` : ''}
      </button>`;
    }).join('');
  }

  function dessinerPanier() {
    const lignes = PRODUITS.filter((p) => dansPanier(p.id));
    el.lignes.innerHTML = lignes.map((p) => `<li class="ligne-neuve"><span>${dansPanier(p.id)}× ${echapper(p.nom)}</span><span>${fcfa(p.prix * dansPanier(p.id))}</span></li>`).join('');
    const total = totalPanier();
    el.vide.hidden = lignes.length > 0;
    el.total.hidden = !lignes.length;
    el.somme.textContent = `${fcfa(total)} FCFA`;
    el.encaisser.disabled = !lignes.length;
    el.encaisser.textContent = lignes.length ? `Encaisser ${fcfa(total)} F` : 'Encaisser';
  }

  function recu(v) {
    const provisoire = v.statut === 'attente';
    const d = new Date(v.date);
    return `<article class="recu${provisoire ? ' provisoire' : ''}" data-cle="${v.cle}">
      <p class="double c">LE MAQUIS DU ROND-POINT</p>
      <p class="c petit">${provisoire ? 'Reçu provisoire' : 'Reçu de vente'}</p>
      <dl class="recu-infos">
        ${v.ref ? `<div><dt>Référence</dt><dd>${v.ref}</dd></div>` : ''}
        <div><dt>Date</dt><dd>${dateCourte(d)} ${heure(d)}</dd></div>
        <div><dt>Clé unique</dt><dd>${v.cle}</dd></div>
      </dl>
      <ul class="vente-lignes">${v.lignes.map((l) => `<li><span>${l.q}× ${echapper(l.nom)}</span><span>${fcfa(l.prix * l.q)}</span></li>`).join('')}</ul>
      <p class="recu-total"><span>TOTAL</span><span>${fcfa(v.total)} FCFA</span></p>
      <p class="recu-paye"><span>Payé en</span><span>${echapper(v.mode)}</span></p>
      ${provisoire ? '<p class="c petit recu-note">Reçu provisoire : la vente part au serveur dès le retour du réseau.</p>' : ''}
      <p class="c petit">Merci de votre visite !</p>
    </article><hr class="tirets">`;
  }

  function dessinerVentes(neuve) {
    el.ventes.innerHTML = etat.ventes.slice(-VENTES_MONTREES).map(recu).join('');
    if (neuve) el.ventes.querySelector(`[data-cle="${neuve}"]`)?.classList.add('recu-neuf');
  }

  function noter(texte, genre = '') {
    const li = document.createElement('li');
    if (genre) li.className = genre;
    li.innerHTML = `<time>${heure()}</time><span>${echapper(texte)}</span>`;
    el.journal.append(li);
    while (el.journal.children.length > 3) el.journal.firstElementChild.remove();
  }

  function cocher(nom) {
    etat.etapes[nom] = true;
    dessinerEtapes();
  }

  /** Le prochain geste à proposer : il est signalé sur la caisse. */
  function prochain() {
    const e = etat.etapes;
    if (!e.plat) return 'plat';
    if (!e.coupe) return 'coupe';
    if (!e.vente) return totalPanier() ? 'vente' : 'plat';
    if (!e.retour) return 'retour';
    return '';
  }

  function dessinerEtapes() {
    const suite = prochain();
    el.terminal.dataset.suite = suite;
    document.querySelectorAll('.etapes li').forEach((li) => {
      const nom = li.dataset.etape;
      li.classList.toggle('fait', !!etat.etapes[nom]);
      li.classList.toggle('suivante', nom === suite && !etat.etapes[nom]);
    });
  }

  function dessinerReseau() {
    const allume = etat.reseau;
    const attente = enAttente().length;
    document.documentElement.dataset.reseau = allume ? 'allume' : 'coupe';
    el.reseau.setAttribute('aria-checked', String(allume));
    el.alerte.hidden = allume;
    let texte = allume ? 'En ligne' : 'Hors connexion';
    if (!allume && attente) texte = `${attente} en attente`;
    el.etat.innerHTML = `<svg class="ico"><use href="#i-${allume ? 'wifi' : 'wifi-off'}"/></svg><span>${texte}</span>`;
  }

  // ── Gestes ──
  function ajouter(id) {
    const p = PRODUITS.find((x) => x.id === id);
    if (reste(p) <= 0) {
      annoncer(p.nom, 'RUPTURE');
      noter(`${p.nom} : plus en stock, la caisse refuse.`, 'attention');
      return;
    }
    etat.panier[id] = dansPanier(id) + 1;
    dessinerProduits();
    dessinerPanier();
    cocher('plat');
    sauver();
    annoncer(p.nom, `${fcfa(p.prix)} F`, 1500);
  }

  function encaisser() {
    if (!totalPanier()) return;
    const maintenant = new Date();
    etat.compteur += 1;
    const numero = String(etat.compteur).padStart(4, '0');
    const vente = {
      numero,
      cle: nouvelleCle(),
      date: maintenant.toISOString(),
      lignes: PRODUITS.filter((p) => dansPanier(p.id)).map((p) => ({ nom: p.nom, prix: p.prix, q: dansPanier(p.id) })),
      total: totalPanier(),
      mode: document.querySelector('input[name="mode"]:checked').value,
      statut: 'attente',
      ref: '',
    };
    PRODUITS.forEach((p) => { etat.stock[p.id] -= dansPanier(p.id); });
    etat.panier = {};
    etat.ventes.push(vente);
    if (etat.ventes.length > 12) etat.ventes.splice(0, etat.ventes.length - 12);
    sauver();
    dessinerProduits();
    dessinerPanier();
    dessinerEtapes();

    if (etat.reseau) {
      confirmer(vente);
      dessinerVentes(vente.cle);
      noter(`Vente ${numero} reçue par le serveur.`, 'bien');
      annoncer('MERCI', `${fcfa(vente.total)} F`, 2200);
    } else {
      dessinerVentes(vente.cle);
      cocher('vente');
      noter(`Vente ${numero} gardée sur cet appareil.`, 'attention');
      annoncer('VENTE GARDEE', 'SUR L APPAREIL', 2400);
    }
    dessinerReseau();
    sauver();
  }

  function confirmer(v) {
    const d = new Date(v.date);
    v.statut = 'envoyee';
    v.ref = `VT-${d.getFullYear()}${deuxChiffres(d.getMonth() + 1)}${deuxChiffres(d.getDate())}-${v.numero}`;
  }

  const attendre = (ms) => new Promise((r) => { setTimeout(r, ms); });

  async function synchroniser({ retrouvees = false } = {}) {
    if (etat.envoi) return;
    const liste = enAttente();
    if (!liste.length) return;
    etat.envoi = true;
    if (retrouvees) noter(`${liste.length} vente(s) retrouvée(s) sur cet appareil.`);
    await attendre(650);
    for (const v of liste) {
      if (!etat.reseau) break;
      noter(`Vente ${v.numero} envoyée, clé ${v.cle}.`, 'bien');
      annoncer('ENVOI', `VENTE ${v.numero}`, 1200);
      confirmer(v);
      dessinerVentes(v.cle);
      dessinerReseau();
      sauver();
      await attendre(820);
      // Le renvoi : ce que fait l'appli si la réponse du serveur se perd en route.
      noter(`Renvoi de la clé ${v.cle} : déjà reçue, ignorée.`);
      await attendre(760);
    }
    etat.envoi = false;
    if (etat.reseau && !enAttente().length) {
      if (etat.etapes.vente) {
        cocher('retour');
        sauver();
        el.terminal.classList.add('reussi');
        noter('Rien de perdu, rien en double.', 'bien');
      }
      annoncer('RIEN DE PERDU', 'RIEN EN DOUBLE', 3600);
    }
  }

  function basculerReseau(voulu, { vrai = false } = {}) {
    etat.reseau = voulu;
    if (voulu) {
      noter(vrai ? 'Votre réseau est revenu, pour de vrai.' : 'Réseau rallumé.');
      dessinerReseau();
      if (enAttente().length) synchroniser();
      else annoncer('RESEAU', 'REVENU', 1600);
    } else {
      cocher('coupe');
      sauver();
      el.terminal.classList.remove('reussi');
      noter(vrai ? 'Votre réseau vient de couper, pour de vrai.' : 'Réseau coupé. La caisse continue.', 'attention');
      dessinerReseau();
      annoncer('RESEAU COUPE', 'ON ENCAISSE', 2400);
    }
  }

  function remettreAZero() {
    etat.panier = {};
    etat.ventes = [];
    etat.compteur = 0;
    etat.etapes = {};
    PRODUITS.forEach((p) => { etat.stock[p.id] = p.stock; });
    el.journal.innerHTML = '';
    el.terminal.classList.remove('reussi');
    try { localStorage.removeItem(CLE_STOCKAGE); } catch (e) { /* rien à effacer */ }
    if (!etat.reseau) basculerReseau(true);
    tout();
    repos();
  }

  function tout() {
    dessinerProduits();
    dessinerPanier();
    dessinerVentes();
    dessinerEtapes();
    dessinerReseau();
  }

  // ── Branchements ──
  el.produits.addEventListener('click', (e) => {
    const b = e.target.closest('.produit');
    if (b) ajouter(b.dataset.id);
  });
  el.encaisser.addEventListener('click', encaisser);
  el.vider.addEventListener('click', remettreAZero);
  el.reseau.addEventListener('click', () => {
    if (!etat.reseau && !navigator.onLine) {
      annoncer('TOUJOURS', 'PAS DE RESEAU', 2000);
      noter('Votre appareil n’a toujours pas de réseau.', 'attention');
      return;
    }
    basculerReseau(!etat.reseau);
  });
  window.addEventListener('offline', () => { if (etat.reseau) basculerReseau(false, { vrai: true }); });
  window.addEventListener('online', () => { if (!etat.reseau) basculerReseau(true, { vrai: true }); });

  charger();
  if (!navigator.onLine) etat.reseau = false;
  tout();
  afficheur.allumer();
  repos();
  if (etat.reseau && enAttente().length) setTimeout(() => synchroniser({ retrouvees: true }), 1400);
})();
