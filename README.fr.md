# 🚴 VeloMétéo

> Extension pour navigateur et application web calculant et projetant les conditions météo heure par heure (direction du vent, résistance de face/dos, rafales, température, risque de pluie) le long de vos itinéraires cyclistes selon votre heure de départ et votre allure. Compatible avec les fichiers GPX, Komoot et Strava.

[English](README.md) • [Français](README.fr.md)

![VeloMétéo](public/favicon.svg)

---

## 📥 Guide d'installation pas-à-pas (Chrome, Edge, Brave, Opera)

Cette extension fonctionne sur tous les navigateurs basés sur Chromium pour ordinateur : **Google Chrome**, **Brave**, **Microsoft Edge**, **Opera**, **Vivaldi** et **Arc**.

L'installation manuelle prend moins de deux minutes et ne requiert aucune compétence technique. Suivez les 5 étapes ci-dessous :

### Étape 1 : Télécharger et décompresser l'extension
1. Téléchargez l'archive de l'extension (`velometeo.zip` depuis les versions publiées, ou le fichier ZIP du dépôt via le bouton vert **Code** > **Download ZIP**).
2. Décompressez (dézippez) le fichier téléchargé dans un dossier de votre ordinateur.
3. Placez ce dossier à un endroit stable où vous ne risquez pas de l'effacer par inadvertance (par exemple dans votre dossier `Documents`).

> [!IMPORTANT]
> **Ne déplacez pas et ne supprimez pas ce dossier après l'installation.** Votre navigateur lit directement les fichiers de l'extension depuis cet emplacement à chaque ouverture.

---

### Étape 2 : Ouvrir la page de gestion des extensions
Ouvrez un nouvel onglet dans votre navigateur et collez l'adresse correspondant à votre navigateur dans la barre d'adresse :

- **Google Chrome / Brave / Vivaldi / Arc** : `chrome://extensions`
- **Microsoft Edge** : `edge://extensions`
- **Opera** : `opera://extensions`

Appuyez sur la touche **Entrée** pour accéder à la page.

---

### Étape 3 : Activer le « Mode développeur »
- En haut à droite de la page des extensions (ou dans la colonne de gauche sur Edge), repérez l'interrupteur intitulé **Mode développeur**.
- Activez-le.
- De nouveaux boutons apparaissent immédiatement dans la barre supérieure, notamment **Charger l'extension non empaquetée**.

---

### Étape 4 : Charger le dossier de l'extension
1. Cliquez sur le bouton **Charger l'extension non empaquetée** (en haut à gauche).
2. Dans la fenêtre de sélection de fichiers qui s'ouvre, parcourez votre ordinateur jusqu'au dossier décompressé et sélectionnez le répertoire contenant le fichier `manifest.json` (le dossier `dist/` en cas de compilation par les sources, ou le dossier extrait).
3. Cliquez sur **Sélectionner un dossier** (ou **Ouvrir**).
4. La vignette **VeloMétéo** apparaît désormais dans la liste de vos extensions actives.

---

### Étape 5 : Épingler l'icône dans votre barre d'outils
1. Cliquez sur l'icône en forme de pièce de puzzle (**Extensions** 🧩), située à droite de la barre d'adresse de votre navigateur.
2. Repérez **VeloMétéo** dans la liste et cliquez sur l'icône d'épingle (📌).
3. L'icône du vélo VeloMétéo reste maintenant visible en permanence pour un accès en un clic.

---

### 🔄 Mettre à jour l'extension lors d'une nouvelle version
Lorsqu'une nouvelle version de VeloMétéo est disponible :
1. Téléchargez la nouvelle archive et remplacez les fichiers dans votre dossier existant.
2. Retournez sur la page `chrome://extensions` (ou `edge://extensions`).
3. Cliquez simplement sur l'icône de rafraîchissement (🔄) sur la vignette de VeloMétéo.

---

## 🚴 Utilisation au quotidien

### 1. Sur Komoot et Strava (Projection automatique sur la carte)
- Rendez-vous sur n'importe quel parcours planifié ou enregistré sur **Komoot** (`/tour/...`) ou sur **Strava** (`/routes/...`, `/activities/...`, `/maps`).
- VeloMétéo détecte automatiquement le tracé et projette les balises météo interactives directement sur la carte.
- Une fenêtre de réglages flottante et déplaçable s'affiche sur la carte pour ajuster en temps réel :
  - Votre **date et heure de départ**.
  - Votre **vitesse moyenne cible** (en km/h).
  - L'**espacement des balises** météo (tous les 5 km, 10 km, etc.).
  - La jauge de vent global (**face 🔴**, **côté 🟡**, **dos 🟢**).

### 2. Mode autonome GPX
- Cliquez sur l'icône VeloMétéo (🚴) dans votre barre d'outils à tout moment.
- Glissez-déposez n'importe quel fichier `.gpx` de votre ordinateur (ou chargez la trace de démonstration intégrée).
- Consultez le profil altimétrique dynamique, le déroulé chronologique heure par heure et la carte synchronisée.
- Basculez à tout moment entre le français et l'anglais via le sélecteur `FR | EN` dans l'en-tête.

---

## ✨ Fonctionnalités principales

- 📍 **Compatibilité GPX universelle** : Fichiers issus de compteurs Garmin, Wahoo, Hammerhead, RideWithGPS, Komoot ou Strava.
- 💨 **Calcul vectoriel du vent relatif** : Analyse l'angle du vent par rapport au cap réel du vélo sur chaque kilomètre (résistance de face et poussée latérale).
- ⏱️ **Modélisation physique de l'allure** : Ajuste les heures d'arrivée prévisionnelles selon le dénivelé (ralentissement en côte et vitesse plafonnée en descente).
- 🌦️ **Prévisions Open-Meteo haute précision** : Température réelle et ressentie, rafales maximales, probabilité et volume de pluie en millimètres.
- 🌐 **Bilingue natif (FR / EN)** : Détection automatique de la langue du navigateur et sélecteur manuel instantané.
- 🔒 **Respect strict de la vie privée (100% côté client)** : Aucun compte utilisateur requis, aucun serveur intermédiaire, aucun stockage distant de vos parcours.

---

## 🛠️ Compilation depuis les sources (Développeurs)

Si vous souhaitez modifier le code ou compiler l'extension par vous-même :

### Prérequis
- [Node.js](https://nodejs.org/) (v18+)
- `npm`

### Installation & Compilation
```bash
# 1. Installer les dépendances
npm install

# 2. Lancer le serveur local de développement (vue web)
npm run dev

# 3. Exécuter les tests de logique & linters
npm run check-logic
npm run lint

# 4. Compiler l'extension pour production (dossier dist/)
npm run build
```

Après la compilation, le dossier à charger dans `chrome://extensions` est le répertoire `dist/`.

---

## ⚖️ Mentions Légales, Confidentialité & Marques

### Non-affiliation
- **Komoot** est une marque déposée de **Komoot GmbH**.
- **Strava** est une marque déposée de **Strava, Inc**.  
VeloMétéo est un projet open-source communautaire indépendant. Il n'est en aucun cas affilié, sponsorisé, approuvé ou associé à Komoot GmbH ou Strava, Inc. Ces marques ne sont citées qu'à titre descriptif de compatibilité technique.

### Données & Attributions tierces
- 🌦️ **Données météo** : Fournies par l'API ouverte [Open-Meteo.com](https://open-meteo.com/) sous licence [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).
- 🗺️ **Cartographie** : Tuiles et données géographiques © les contributeurs d'[OpenStreetMap](https://www.openstreetmap.org/copyright) sous licence [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/).

### ⚠️ Avertissement de sécurité météo
Les prévisions météorologiques, estimations d'allure et calculs d'exposition au vent sont fournis **à titre purement informatif et prévisionnel**. Les conditions réelles sur le terrain (microclimats en montagne, orages soudains, état de la chaussée) peuvent différer sensiblement. Consultez toujours les bulletins météorologiques officiels avant de prendre la route. Les auteurs déclinent toute responsabilité en cas d'accident ou de dommage.

### 🔒 Politique de Confidentialité
VeloMétéo respecte les principes du *Privacy by Design* : aucun traceur, aucune publicité, aucune collecte de données personnelles. Pour plus de détails :  
👉 **[Consulter PRIVACY.md](PRIVACY.md)**

---

## 📄 Licence

Ce projet est distribué sous licence libre [MIT](LICENSE).
