# 🚴 VeloMétéo

> Application web et extension de navigateur (Chrome / Chromium) qui prédit et projette la météo (vent, rafales, pluie, température) le long de vos sorties vélo selon votre heure de départ et votre allure.

![VeloMétéo](public/favicon.svg)

---

## ✨ Fonctionnalités

- 📍 **Import GPX universel** : Déposez n'importe quel fichier GPX ou testez avec un parcours d'exemple.
- 🗺️ **Intégration directe Komoot** : Détecte automatiquement le parcours sur l'onglet Komoot actif (`/tour/...` et `/tour/.../zoom`).
- 🎯 **Projection sur la carte Komoot** : Affiche les balises météo interactives directement sur la trace de la carte MapLibre/Mapbox avec un widget récapitulatif flottant et déplaçable (Drag & Drop).
- ⏱️ **Modélisation physique d'allure** : Calcul du profil de vitesse pondéré selon la pente (pénalité en montée, gain plafonné en descente) normalisé sur votre vitesse moyenne cible.
- 💨 **Analyse vectorielle du vent** :
  - Angle relatif selon le cap du cycliste (face 🔴, 3/4 face 🟠, travers 🟡, 3/4 dos 🟢, dos 🚀).
  - Composantes de vent de face et de vent latéral calculées à chaque kilomètre.
- 🌦️ **Données Open-Meteo précises** : Température réelle & ressentie, rafales max, probabilité de précipitation et cumul en mm.
- 🔒 **100% Client-Side & Confidentialité** : Zéro serveur tiers, zéro stockage de données, requêtes directes côté navigateur.

---

## 🚀 Installation & Développement

### Prérequis
- [Node.js](https://nodejs.org/) (v18+)
- `npm`

### Installation des dépendances
```bash
npm install
```

### Lancement de l'application web locale
```bash
npm run dev
```

### Vérification de la logique métier & Linters
```bash
npm run check-logic
npm run lint
```

### Compilation pour l'extension Chrome
```bash
npm run build
```
Les fichiers prêts pour le navigateur sont générés dans le dossier `dist/`.

---

## 🧩 Charger l'extension dans Chrome

1. Ouvrez Google Chrome et accédez à `chrome://extensions/`.
2. Activez le **Mode développeur** en haut à droite.
3. Cliquez sur **Charger l'extension non empaquetée** (*Load unpacked*).
4. Sélectionnez le dossier `dist/` du projet.
5. Rendez-vous sur n'importe quel parcours Komoot et ouvrez l'extension !

---

## 🛠️ Stack Technique

- **Framework** : React 19, TypeScript, Vite
- **Styling & UI** : Tailwind CSS, Lucide Icons
- **Cartographie** : Leaflet & React-Leaflet (Web UI), MapLibre GL (Overlay Komoot)
- **API Météo** : Open-Meteo (sans clé API)
- **Extension** : Chrome Manifest V3 (`activeTab`, `scripting`, `sidePanel`)

---

## ⚖️ Mentions Légales, Confidentialité & Marques

### Non-affiliation Komoot
**Komoot** est une marque déposée de **Komoot GmbH**. 
VeloMétéo est un projet open-source indépendant développé par la communauté. Il n'est en aucun cas affilié, sponsorisé, approuvé ou associé à Komoot GmbH. Le nom « Komoot » n'est utilisé ici qu'à titre descriptif de compatibilité technique.

### Données & Attributions tierces
- 🌦️ **Données météo** : Fournies par l'excellente API open-source [Open-Meteo.com](https://open-meteo.com/) sous licence [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).
- 🗺️ **Cartographie** : Tuiles et données cartographiques © les contributeurs d'[OpenStreetMap](https://www.openstreetmap.org/copyright) sous licence [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/).

### ⚠️ Avertissement Météo & Sécurité
Les prévisions météorologiques, estimations d'allure et calculs d'angle de vent sont fournis **à titre purement informatif et estimatif**. Les conditions réelles sur le terrain (microclimats, rafales soudaines, orages, état des routes) peuvent varier significativement. Consultez toujours les bulletins de vigilance officiels avant votre sortie vélo. Les auteurs et contributeurs déclinent toute responsabilité en cas d'accident, incident ou dommage lié à l'utilisation de ces données.

### 🔒 Politique de Confidentialité
VeloMétéo fonctionne selon le principe du *Privacy by Design* : zéro serveur VeloMétéo, zéro traqueur, zéro profilage. Pour consulter le détail du traitement des données et des permissions du navigateur, référez-vous à notre politique complète :
👉 **[Consulter PRIVACY.md](PRIVACY.md)**

---

## 📄 Licence

Ce projet est distribué sous licence libre [MIT](LICENSE).

