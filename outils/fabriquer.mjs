// Refait l'image d'aperçu des réseaux et le CV en PDF à partir des pages du dossier outils/.
// Usage : node outils/fabriquer.mjs <dossier contenant node_modules/playwright>
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = await import(pathToFileURL(path.join(process.argv[2], 'node_modules/playwright/index.mjs')).href);
const url = (f) => pathToFileURL(path.join(RACINE, f)).href;

const navigateur = await chromium.launch({ channel: 'chrome' });

const og = await navigateur.newPage({ viewport: { width: 1200, height: 627 } });
await og.goto(url('outils/og.html'));
await og.waitForFunction(() => window.pret === true);
await og.screenshot({ path: path.join(RACINE, 'img/og.png') });

const cv = await navigateur.newPage();
await cv.goto(url('outils/cv.html'));
await cv.evaluate(() => document.fonts.ready);
const debord = await cv.evaluate(() => document.querySelector('main').getBoundingClientRect().bottom);
await cv.pdf({ path: path.join(RACINE, 'cv/Djabir-Abdoul-Raouf-CV.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
console.log('bas du CV (1 page = 1123 px) :', Math.round(debord));
await navigateur.close();
