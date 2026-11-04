/* Hors connexion : la page et ses fichiers sont gardés sur l'appareil. La page
   se recharge d'abord depuis le réseau ; sans réseau, depuis cette réserve. Les
   vidéos, plus lourdes, ne sont gardées qu'une fois regardées. */
const RESERVE = 'portfolio-v1';
const FICHIERS = [
  './',
  'css/site.css',
  'js/afficheur.js',
  'js/caisse.js',
  'js/site.js',
  'fonts/space-grotesk-500to700-latin.woff2',
  'fonts/ibm-plex-mono-400-latin.woff2',
  'fonts/ibm-plex-mono-600-latin.woff2',
  'img/favicon.png',
  'img/qr-linkedin.svg',
  'img/tirage-caisse-384.png',
  'img/tirage-caisse-288.png',
  'img/tirage-horsligne-384.png',
  'img/tirage-horsligne-288.png',
  'img/tirage-cuisine-384.png',
  'img/tirage-cuisine-288.png',
  'cv/Djabir-Abdoul-Raouf-CV.pdf',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(RESERVE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((c) => c !== RESERVE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  if (request.headers.has('range')) return;

  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((reponse) => {
          const copie = reponse.clone();
          caches.open(RESERVE).then((c) => c.put('./', copie));
          return reponse;
        })
        .catch(() => caches.match('./')),
    );
    return;
  }

  e.respondWith(
    caches.match(request).then((garde) => garde || fetch(request).then((reponse) => {
      if (reponse.ok && reponse.status === 200) {
        const copie = reponse.clone();
        caches.open(RESERVE).then((c) => c.put(request, copie));
      }
      return reponse;
    })),
  );
});
