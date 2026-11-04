/* La caisse de démonstration. Mêmes produits, mêmes messages et même logique
   que Gab-POS Tech, en miniature : la vente s'écrit d'abord sur l'appareil,
   avec une clé unique, et part au serveur quand le réseau revient. */
(function () {
  'use strict';

  const { VERT, OR } = window.Afficheur;
  const CLE_STOCKAGE = 'caisse-demo-djabir';
  const VENTES_MONTREES = 3;

  const PRODUITS = [
    { id: 'poulet', nom: 'Poulet braisé entier', court: 'POULET', mini: 'POULET', prix: 5000, stock: 12, seuil: 5 },
    { id: 'capitaine', nom: 'Capitaine braisé', court: 'CAPITAINE', mini: 'CAPIT.', prix: 4500, stock: 4, seuil: 5 },
    { id: 'brochettes', nom: 'Brochettes de bœuf', court: 'BROCHETTES', mini: 'BROCH.', prix: 1500, stock: 26, seuil: 10 },
    { id: 'alloco', nom: 'Alloco', court: 'ALLOCO', mini: 'ALLOCO', prix: 1000, stock: 3, seuil: 8 },
    { id: 'regab', nom: 'Régab 65cl', court: 'REGAB', mini: 'REGAB', prix: 1000, stock: 48, seuil: 24 },
    { id: 'castel', nom: 'Castel 65cl', court: 'CASTEL', mini: 'CASTEL', prix: 1200, stock: 36, seuil: 24 },
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
    etat: $('#etat-reseau'), sous: $('#term-sous'), alerte: $('#alerte'), journal: $('#journal'), terminal: $('#terminal'),
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

  // ── L'afficheur : une ligne de 12 caractères sur ordinateur, deux de 6 sur téléphone ──
  const NOM = { une: [{ t: 'DJABIR', c: VERT }, { t: ' ALGO', c: OR }], l1: 'DJABIR', l2: 'ALGO' };
  const REPOS = [
    [NOM, 6500],
    [{ une: 'DEVELOPPEUR', l1: 'FULL', l2: 'STACK' }, 1500],
    [{ une: 'FULL-STACK', l1: 'FULL', l2: 'STACK' }, 1500],
    [{ une: [{ t: 'LIBREVILLE', c: OR }], l1: 'LIBRE', l2: 'VILLE' }, 1600],
    [{ une: [{ t: 'GABON', c: OR }], l1: 'GABON', l2: '' }, 1600],
    [NOM, 4200],
    [{ une: 'A VOUS :', l1: 'A VOUS', l2: '' }, 1300],
    [{ une: 'TOUCHEZ', l1: 'UN', l2: 'PLAT' }, 1300],
    [{ une: 'UN PLAT', l1: 'UN', l2: 'PLAT' }, 1500],
  ];
  let minuteur = 0;

  function afficher(m) {
    if (afficheur.deuxLignes) afficheur.montrer(m.l1, m.l2);
    else afficheur.montrer(m.une);
  }

  function repos(indice = 0) {
    clearTimeout(minuteur);
    const [message, duree] = REPOS[indice % REPOS.length];
    afficher(message);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    minuteur = setTimeout(() => repos(indice + 1), duree);
  }

  /** Une suite de messages, puis retour au total ou au repos. */
  function annoncer(...suite) {
    clearTimeout(minuteur);
    const etape = (i) => {
      if (i >= suite.length) { apresAnnonce(); return; }
      const [message, duree] = suite[i];
      afficher(message);
      minuteur = setTimeout(() => etape(i + 1), duree);
    };
    etape(0);
  }

  const messageTotal = (total) => ({ une: [{ t: 'TOTAL ', c: VERT }, { t: fcfa(total), c: OR }], l1: 'TOTAL', l2: fcfa(total) });

  function apresAnnonce() {
    const total = totalPanier();
    if (total) afficher(messageTotal(total));
    else repos();
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
    el.etat.textContent = allume ? 'Réseau allumé' : 'Réseau coupé';
    el.sous.textContent = attente ? `En attente de réseau : ${attente}` : 'Caisse de démonstration';
    el.sous.classList.toggle('attente', attente > 0);
  }

  // ── Gestes ──
  function ajouter(id) {
    const p = PRODUITS.find((x) => x.id === id);
    if (reste(p) <= 0) {
      annoncer([{ une: 'STOCK VIDE', l1: 'STOCK', l2: 'VIDE' }, 1800]);
      noter(`${p.nom} : plus en stock, la caisse refuse.`, 'attention');
      return;
    }
    etat.panier[id] = dansPanier(id) + 1;
    dessinerProduits();
    dessinerPanier();
    cocher('plat');
    sauver();
    const avecPrix = p.court.length + fcfa(p.prix).length < 12;
    annoncer([{
      une: avecPrix ? [{ t: `${p.court} `, c: VERT }, { t: fcfa(p.prix), c: OR }] : p.court,
      l1: p.mini,
      l2: fcfa(p.prix),
    }, 1000]);
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
      annoncer([{ une: [{ t: 'MERCI ', c: VERT }, { t: fcfa(vente.total), c: OR }], l1: 'MERCI', l2: fcfa(vente.total) }, 2400]);
    } else {
      dessinerVentes(vente.cle);
      cocher('vente');
      noter(`Vente ${numero} gardée sur cet appareil.`, 'attention');
      annoncer([{ une: [{ t: 'VENTE GARDEE', c: OR }], l1: 'VENTE', l2: 'GARDEE' }, 2600]);
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
      annoncer([{ une: [{ t: 'ENVOI ', c: VERT }, { t: v.numero, c: OR }], l1: 'ENVOI', l2: v.numero }, 1500]);
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
      annoncer([{ une: 'RIEN PERDU', l1: 'RIEN', l2: 'PERDU' }, 1900], [{ une: 'AUCUN DOUBLE', l1: 'AUCUN', l2: 'DOUBLE' }, 2300]);
    }
  }

  function basculerReseau(voulu, { vrai = false } = {}) {
    etat.reseau = voulu;
    if (voulu) {
      noter(vrai ? 'Votre réseau est revenu, pour de vrai.' : 'Réseau rallumé.');
      dessinerReseau();
      if (enAttente().length) synchroniser();
      else annoncer([{ une: 'RESEAU OK', l1: 'RESEAU', l2: 'OK' }, 1700]);
    } else {
      cocher('coupe');
      sauver();
      el.terminal.classList.remove('reussi');
      noter(vrai ? 'Votre réseau vient de couper, pour de vrai.' : 'Réseau coupé. La caisse continue.', 'attention');
      dessinerReseau();
      annoncer([{ une: [{ t: 'RESEAU COUPE', c: OR }], l1: 'RESEAU', l2: 'COUPE' }, 1700], [{ une: 'ON ENCAISSE', l1: 'VENTES', l2: 'OK' }, 2200]);
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
      annoncer([{ une: [{ t: 'SANS RESEAU', c: OR }], l1: 'SANS', l2: 'RESEAU' }, 2000]);
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
