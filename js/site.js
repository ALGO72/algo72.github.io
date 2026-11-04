/* Le reste de la page : impression au fil du défilement, vidéos, longueur du
   ticket et mode hors connexion. */
(function () {
  'use strict';

  const calme = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const economie = navigator.connection?.saveData === true;
  const large = window.matchMedia('(min-width: 1080px)');

  // Impression : chaque bloc se révèle une fois, de haut en bas, par à-coups.
  const blocs = document.querySelectorAll('.imp');
  if (calme || !('IntersectionObserver' in window)) {
    blocs.forEach((b) => b.classList.add('vu'));
  } else {
    const impression = new IntersectionObserver((entrees) => {
      for (const e of entrees) {
        if (e.isIntersecting) {
          e.target.classList.add('vu');
          impression.unobserve(e.target);
        }
      }
    }, { rootMargin: '0px 0px -6% 0px' });
    blocs.forEach((b) => impression.observe(b));
  }

  // Sur grand écran, la vidéo du téléphone joue quand elle est à l'écran.
  const videos = document.querySelectorAll('.tel video');
  const lecteur = new IntersectionObserver((entrees) => {
    for (const e of entrees) {
      const v = e.target;
      if (e.isIntersecting) {
        if (!v.src) v.src = v.dataset.src;
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    }
  }, { threshold: 0.35 });
  if (large.matches && !calme && !economie) videos.forEach((v) => lecteur.observe(v));
  else if (large.matches) {
    videos.forEach((v) => {
      v.controls = true;
      v.src = v.dataset.src;
    });
  }

  // Sur téléphone, le tirage est léger ; la vraie vidéo vient seulement sur demande.
  document.querySelectorAll('.tirage-voir').forEach((bouton) => {
    bouton.addEventListener('click', () => {
      const figure = bouton.closest('.tirage');
      const video = document.createElement('video');
      Object.assign(video, {
        src: figure.dataset.video, poster: figure.dataset.poster,
        muted: true, loop: true, playsInline: true, autoplay: true, controls: true,
      });
      video.setAttribute('aria-label', figure.dataset.legende);
      const legende = document.createElement('figcaption');
      legende.textContent = figure.dataset.legende;
      figure.replaceChildren(video, legende);
      figure.classList.add('en-vrai');
    });
  });

  // La vraie longueur de ce ticket, à 96 points par pouce.
  const longueur = document.getElementById('longueur');
  function mesurer() {
    const papiers = document.querySelectorAll('.papier');
    if (!longueur || !papiers.length) return;
    const haut = papiers[0].getBoundingClientRect().top;
    const bas = papiers[papiers.length - 1].getBoundingClientRect().bottom;
    const metres = ((bas - haut) / 96) * 0.0254;
    longueur.textContent = `${metres.toFixed(2).replace('.', ',')} m`;
  }
  mesurer();
  window.addEventListener('load', mesurer);
  window.addEventListener('resize', mesurer);

  // Après une première visite, la page s'ouvre sans réseau.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }
})();
