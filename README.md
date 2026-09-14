<div align="center">

# 🧿 Hangly-Win

**Lightweight physics-based desktop charms for Windows**

*Traditional protective symbols that hang from the top of your screen — powered by real 2D physics.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-0078D4)](https://github.com/Saranraj-dev007/Hangly-Win/releases)
[![Version](https://img.shields.io/badge/Version-1.0.0-brightgreen)](https://github.com/Saranraj-dev007/Hangly-Win/releases/latest)

</div>

---

## ✨ Features

- **Transparent Desktop Overlay** — Charms appear to float above your desktop
- **Real 2D Physics** — Powered by Matter.js with gravity, rotation, and collision
- **Four Charm Types:**
  - 🧿 **Nazar Boncuğu** — Traditional Turkish evil-eye amulet
  - 🪬 **Hamsa Hand** — Protective hand symbol
  - 🍋 **Nimbu-Mirchi** — Indian lemon-chili good luck charm
  - 🔔 **Temple Bell (Ghanta)** — Traditional brass temple bell
- **Drag & Swing** — Grab any charm and watch it swing naturally when released
- **Charm Collisions** — Charms bump into each other realistically
- **System Tray** — Quietly runs in the background
- **Settings Window** — Customize physics, appearance, and behavior
- **Start with Windows** — Auto-launch on login
- **Lightweight** — Minimal CPU and RAM usage

---

## 📥 Download

> **For normal users — no developer tools required!**

1. Go to the **[Latest Release](https://github.com/Saranraj-dev007/Hangly-Win/releases/latest)**
2. Download **`Hangly-Win-1.0.0-Setup.exe`**
3. Run the installer
4. Launch Hangly-Win from your Start Menu or desktop shortcut

**Portable version** (no installation needed): Download `Hangly-Win-Portable.exe` and run it directly.

---

## 🚀 Installation

1. Download `Hangly-Win-1.0.0-Setup.exe` from [Releases](https://github.com/Saranraj-dev007/Hangly-Win/releases)
2. Double-click the installer
3. Follow the setup wizard
4. Hangly-Win will appear in your Start Menu
5. Launch it — your charms will appear at the top of the screen!

To uninstall: **Control Panel → Programs → Uninstall a program → Hangly-Win**

---

## 🎮 How to Use

| Action | How |
|--------|-----|
| **Drag a charm** | Left-click and drag |
| **Swing a charm** | Drag and release — it swings with momentum |
| **Right-click a charm** | Change type, duplicate, remove, reset |
| **Add a charm** | Right-click tray icon → Add Charm |
| **Hide/Show overlay** | Right-click tray icon → Show/Hide |
| **Open Settings** | Right-click tray icon → Settings |
| **Quit** | Right-click tray icon → Quit Hangly-Win |

---

## 🛠️ Development

Prerequisites: [Node.js](https://nodejs.org/) (v18 or later)

```bash
# 1. Clone the repository
git clone https://github.com/Saranraj-dev007/Hangly-Win.git
cd Hangly-Win

# 2. Install dependencies
npm install

# 3. Run in development mode
npm start
```

---

## 📦 Build

Build a Windows installer (`.exe`):

```bash
npm run dist
```

This produces:
- `dist/Hangly-Win-1.0.0-Setup.exe` — Standard installer
- `dist/Hangly-Win-Portable.exe` — Portable version

> Requires Windows or Wine on Linux/macOS for packaging.

---

## 🎨 Custom Charm Assets

You can replace the charm images with your own artwork:

1. Navigate to `assets/charms/` in the installation directory
2. Replace any of these files:
   - `nazar.jpg` — Nazar Boncuğu
   - `hamsa.jpg` — Hamsa Hand
   - `nimbu-mirchi.jpg` — Nimbu-Mirchi
   - `temple-bell.jpg` — Temple Bell
3. Use images with **transparent backgrounds** (PNG recommended)
4. Restart Hangly-Win

Recommended size: **256×256 pixels** or larger, square aspect ratio.

---

## 🔧 Troubleshooting

### Charms don't appear
- Check that Hangly-Win is running (look for the icon in the system tray)
- Right-click the tray icon → **Show Hangly-Win**

### App uses too much CPU
- Open Settings → Physics → Reduce **Animation Intensity**
- Disable **Idle Movement**
- Increase **Air Damping**

### Charms flying off screen
- Right-click tray icon → Settings → Charms → **Reset Positions**

### Transparent overlay not working
- Ensure your Windows display drivers are up to date
- Try disabling "Hardware-accelerated GPU scheduling" in Windows settings

### App doesn't start with Windows
- Open Settings → General → enable **Start with Windows**
- Or add manually: Run `shell:startup` and create a shortcut

---

## 📁 Project Structure

```
Hangly-Win/
├── main.js              # Main Electron process
├── preload.js           # Secure preload script
├── package.json
├── src/
│   ├── renderer/
│   │   ├── index.html   # Overlay window
│   │   ├── app.js       # Physics + rendering
│   │   ├── style.css    # Overlay styles
│   │   ├── settings.html
│   │   └── settings.js
│   └── config/
│       └── defaults.js  # Default configuration
├── assets/
│   ├── charms/          # Charm images (replaceable)
│   └── icons/           # App icons
└── build/               # Build resources
```

---

## 📝 License

[MIT License](LICENSE) — Free to use, modify, and distribute.

---

<div align="center">

Made with ❤️ | Built with [Electron](https://www.electronjs.org/) + [Matter.js](https://brm.io/matter-js/)

</div>
