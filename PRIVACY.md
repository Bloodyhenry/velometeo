# 🔒 Politique de Confidentialité / Privacy Policy

*Dernière mise à jour : 26 septembre 2026*

Le projet **VeloMétéo** est un logiciel libre et open-source conçu selon le principe de **confidentialité dès la conception (*Privacy by Design*)**.

Cette politique de confidentialité explique comment vos données sont traitées lorsque vous utilisez l'application web ou l'extension de navigateur VeloMétéo.

---

## 1. Résumé en un coup d'œil

- 🚫 **Zéro serveur VeloMétéo** : Nous n'opérons aucun serveur applicatif ni backend.
- 🚫 **Zéro compte, zéro traqueur** : Aucun cookie publicitaire, aucun outil d'analyse (Google Analytics ou autre), aucun profilage.
- 💻 **Traitement 100% local (Client-Side)** : Vos fichiers GPX et vos parcours sont analysés directement dans votre navigateur.
- 🌐 **Appels tiers nécessaires** : Seules les coordonnées géographiques indispensables au calcul météo sont transmises à l'API publique Open-Meteo.

---

## 2. Données traitées et finalités

### A. Données de parcours et géolocalisation
- **Fichiers GPX déposés manuellement** : Traités exclusivement dans la mémoire volatile de votre navigateur via l'API FileReader. Aucune copie n'est envoyée sur un quelconque serveur.
- **Parcours Komoot** : Lorsque vous activez l'extension sur un onglet Komoot, le script extrait uniquement les points géographiques (latitude, longitude, altitude) de la trace active pour pouvoir y superposer la météo. Vos identifiants, mot de passe ou informations de compte Komoot ne sont **jamais** lus ni transmis.

### B. Requêtes vers l'API météo (Open-Meteo)
Pour calculer les prévisions (direction du vent, vitesse, rafales, température, pluie), l'extension envoie une requête HTTP directe depuis votre navigateur vers les serveurs d'**Open-Meteo** (`api.open-meteo.com`).
- **Données transmises** : Une liste de coordonnées géographiques arrondies à ~1 km (2 décimales pour préserver votre vie privée et ne pas révéler votre adresse précise) correspondant aux balises d'échantillonnage de votre parcours, ainsi que les heures de passage estimées.
- **Absence d'identifiant** : Aucun identifiant personnel, nom, adresse IP persistante ou cookie tiers n'est associé à cette requête par VeloMétéo.
- Pour plus d'informations sur leur politique : [Politique de confidentialité d'Open-Meteo](https://open-meteo.com/en/features#terms).

### C. Données cartographiques (OpenStreetMap)
Dans l'interface autonome, les tuiles cartographiques sont chargées directement depuis OpenStreetMap (`*.tile.openstreetmap.org`). Aucune donnée personnelle n'est envoyée en dehors de la requête standard de chargement d'image effectuée par le navigateur.

---

## 3. Justification des permissions de l'extension (Manifest V3)

Conformément aux exigences du Chrome Web Store et de l'écosystème Chromium :

| Permission | Pourquoi est-elle nécessaire ? |
| :--- | :--- |
| `activeTab` / `tabs` | Permet de détecter si l'onglet actif est une page de parcours Komoot ou Strava compatible. |
| `scripting` | Permet d'extraire les coordonnées du tracé en cours sur la page hôte lors de l'import automatique. |
| `sidePanel` | Permet d'ouvrir l'interface de contrôle dans le volet latéral natif du navigateur pour une ergonomie optimale. |
| `host_permissions` (`*.komoot.*`) | Nécessaire pour communiquer avec la page du tour Komoot et récupérer les coordonnées du tracé. |
| `host_permissions` (`api.open-meteo.com`) | Nécessaire pour récupérer les données météorologiques sans blocage CORS. |
| `host_permissions` (`*.tile.openstreetmap.org`) | Nécessaire pour afficher le fond de carte Leaflet en mode autonome GPX. |

---

## 4. Stockage et conservation des données

- VeloMétéo **ne stocke aucune donnée sur un serveur distant**.
- Vos préférences d'affichage (vitesse moyenne cible, intervalle d'échantillonnage des balises) peuvent être temporairement conservées dans la session de l'onglet actif.
- Fermer l'onglet ou l'extension efface immédiatement l'ensemble des données chargées en mémoire.

---

## 5. Droits de l'utilisateur (RGPD)

Conformément au Règlement Général sur la Protection des Données (RGPD) :
Comme VeloMétéo ne collecte, ne stocke ni ne traite aucune donnée nominative ou identifiante sur ses propres infrastructures, nous n'avons aucun registre ni base de données à consulter, modifier ou effacer.

Pour toute question ou remontée concernant la sécurité et la confidentialité du code :
- Consultez le code source ouvert sur le dépôt GitHub.
- Ouvrez une *issue* sur GitHub pour contacter les mainteneurs du projet.

---

## 6. Modifications

Cette politique de confidentialité peut être mise à jour en cas d'évolution des fonctionnalités ou des exigences réglementaires des plateformes de distribution d'extensions (Chrome Web Store, Apple App Store).
