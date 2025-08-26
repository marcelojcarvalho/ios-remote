# iOS Remote Control 🍎📱

Browser-based iOS simulator control with real-time streaming and touch input.

## ✨ Features

- Start/stop iOS simulators
- Live screen streaming (screenshots + video)
- Touch input and keyboard support
- WebDriverAgent integration
- Modern web UI

## 🚀 Quick Start

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Start server**

   ```bash
   npm start
   ```

3. **Open browser**
   Navigate to `http://localhost:3000`

4. **Use the app**
   - Click "Start Simulator" to boot iOS simulator
   - Click "Start Stream" for screen streaming
   - Click/tap on screen to interact

## 🛠️ Prerequisites

- **macOS** + **Xcode** (required for iOS simulator)
- **Node.js** 16+
- **FFmpeg** (optional, for video streaming)

## 🏗️ Architecture

```
ios-remote/
├── backend/          # Node.js server + Socket.IO
├── frontend/         # Web UI
└── package.json      # Dependencies
```

## 🔌 API

- **HTTP**: `/api/simulators`, `/api/screenshot`
- **Socket.IO**: Real-time events for simulator control

## 🐛 Troubleshooting

- Ensure Xcode and iOS Simulator are installed
- Check `xcrun simctl list devices` works
- Verify simulator is fully booted before streaming
