# 🚴 VeloMétéo

> A browser extension and web application that calculates and projects hour-by-hour weather conditions (wind direction, headwind/tailwind resistance, gusts, temperature, rain risk) along your cycling routes based on your departure time and target pace. Compatible with GPX files, Komoot, and Strava.

[English](README.md) • [Français](README.fr.md)

![VeloMétéo](public/favicon.svg)

---

## 📥 Installation Guide (Chrome, Edge, Brave, Opera)

This extension works on any Chromium-based desktop browser, including **Google Chrome**, **Brave**, **Microsoft Edge**, **Opera**, **Vivaldi**, and **Arc**.

Installing it takes less than two minutes and requires no technical knowledge. Follow the 5 steps below:

### Step 1: Download and Extract the Extension
1. Download the extension archive (`velometeo.zip` from the latest release, or download the repository ZIP via the green **Code** button > **Download ZIP**).
2. Extract (unzip) the file into a folder on your computer.
3. Place this folder in a location where it will not be accidentally deleted (for example, in your `Documents` folder).

> [!IMPORTANT]
> **Do not move or delete this folder after installation.** Your browser loads the extension files directly from this directory each time it starts.

---

### Step 2: Open Your Browser's Extensions Page
Open a new tab in your browser and enter the corresponding address in the URL bar:

- **Google Chrome / Brave / Vivaldi / Arc**: `chrome://extensions`
- **Microsoft Edge**: `edge://extensions`
- **Opera**: `opera://extensions`

Press **Enter** to open the management page.

---

### Step 3: Turn On "Developer Mode"
- In the top-right corner of the Extensions page (or in the left sidebar on Edge), locate the **Developer mode** toggle.
- Switch it **ON**.
- A new toolbar with buttons such as **Load unpacked** will appear.

---

### Step 4: Load the Extension
1. Click the **Load unpacked** button in the top-left toolbar.
2. In the file window that opens, navigate to your extracted folder and select the directory containing `manifest.json` (the `dist` folder if building from source, or the extracted root folder).
3. Click **Select Folder** (or **Open**).
4. The **VeloMétéo** card will now appear among your active extensions.

---

### Step 5: Pin the Extension for Easy Access
1. Click the puzzle-piece icon (**Extensions** 🧩) in your browser toolbar, located to the right of the address bar.
2. Find **VeloMétéo** in the list and click the **Pin** icon (📌).
3. The VeloMétéo icon will now remain visible in your toolbar for quick access.

---

### 🔄 How to Update the Extension
When a new version is released:
1. Download the new version and replace the files inside your existing folder.
2. Go back to `chrome://extensions` (or `edge://extensions`).
3. Click the circular **Reload** icon (🔄) on the VeloMétéo card.

---

## 🚴 How to Use VeloMétéo

### 1. On Komoot & Strava (Automatic In-Page Integration)
- Navigate to any saved tour or planned route on **Komoot** (`/tour/...`) or **Strava** (`/routes/...`, `/activities/...`, `/maps`).
- VeloMétéo automatically detects the route coordinates and projects interactive weather markers directly onto the map.
- A floating, movable control panel appears on the map:
  - Adjust your **departure date and time**.
  - Modify your **target average speed** (km/h).
  - Change the **checkpoint interval** (every 5 km, 10 km, etc.).
  - View real-time wind breakdown (**headwind 🔴**, **crosswind 🟡**, **tailwind 🟢**).

### 2. Standalone GPX Mode
- Click the VeloMétéo icon (🚴) in your browser toolbar at any time.
- Drag and drop any `.gpx` file from your computer (or click **Load demo route** to explore).
- Access the full route analysis: elevation profile, chronological weather timetable, and wind vector map.
- Switch language anytime between **Français** and **English** via the `FR | EN` toggle in the header.

---

## ✨ Key Features

- 📍 **Universal GPX Support**: Works with GPX files exported from Garmin, Wahoo, Hammerhead, RideWithGPS, Komoot, or Strava.
- 💨 **Relative Wind Calculation**: Analyzes wind direction relative to your cycling heading at every point of the journey (computes exact headwind resistance and crosswind push).
- ⏱️ **Pacing Physics Model**: Calculates realistic arrival times at each checkpoint by factoring in gradient penalties (uphill deceleration and capped downhill speed).
- 🌦️ **Accurate Weather Data**: Powered by Open-Meteo (hourly temperature, apparent feels-like temperature, precipitation probability, rain accumulation, and wind gusts).
- 🌐 **Multilingual (FR / EN)**: Automatically adapts to your browser language with an instant manual selector.
- 🔒 **Privacy-First (100% Client-Side)**: No user accounts, no tracking, no external servers storing your routes. Calculations run locally in your browser.

---

## 🛠️ Building from Source (Developers)

If you prefer building the project from source code:

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- `npm`

### Setup & Build
```bash
# 1. Install dependencies
npm install

# 2. Start local development server (web view)
npm run dev

# 3. Run automated logic self-checks & linter
npm run check-logic
npm run lint

# 4. Build extension bundle (outputs to dist/)
npm run build
```

Once built, point your browser's **Load unpacked** dialog to the `dist/` directory.

---

## ⚖️ Legal Mentions, Privacy & Trademarks

### Non-Affiliation
- **Komoot** is a registered trademark of **Komoot GmbH**.
- **Strava** is a registered trademark of **Strava, Inc**.  
VeloMétéo is an independent open-source community project. It is not affiliated with, sponsored by, endorsed by, or associated with Komoot GmbH or Strava, Inc. Brand names are used strictly for technical compatibility descriptions.

### Third-Party Data & Attributions
- 🌦️ **Weather Forecasts**: Provided by [Open-Meteo.com](https://open-meteo.com/) under the [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/) license.
- 🗺️ **Cartography**: Map tiles and geographical data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors under the [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/).

### ⚠️ Weather & Safety Disclaimer
Weather predictions, pacing estimates, and relative wind angles are provided **for planning and informational purposes only**. Real-world mountain and outdoor conditions (microclimates, sudden storms, road closures) can change rapidly. Always consult official national meteorological warnings before riding. The authors decline all responsibility for any incident or accident occurring during a ride.

### 🔒 Privacy Policy
VeloMétéo adheres to strict *Privacy by Design* standards: zero tracking, zero profiling, zero third-party analytics. For details on browser permissions and data flows:  
👉 **[Read PRIVACY.md](PRIVACY.md)**

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
