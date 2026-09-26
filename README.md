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

## 📄 Licence

MIT

