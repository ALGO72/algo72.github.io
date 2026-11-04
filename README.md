# algo72.github.io

Le portfolio de Djabir Abdoul Raouf : une vraie petite caisse à essayer, puis tout le parcours sur un seul ticket.
Écrit à la main, sans framework ni traceur, pour rester léger sur un réseau faible. En ligne : https://algo72.github.io

- `index.html`, `css/site.css` : la page. Les chiffres sont écrits en clair dans le ticket : les relever et mettre à jour la date du « Z de caisse ».
- `js/afficheur.js` : l'afficheur à points. `js/caisse.js` : la caisse de démonstration. `js/site.js` : impression, vidéos, mesure du ticket.
- `sw.js` : le mode hors connexion. **Changer `RESERVE` à chaque mise en ligne**, sinon les anciens visiteurs gardent l'ancienne version des fichiers.
- `outils/tirages.py` : capture d'écran vers tirage thermique. `outils/fabriquer.mjs` : image d'aperçu et CV en PDF depuis `outils/og.html` et `outils/cv.html`.
