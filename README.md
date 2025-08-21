# iOS Remote Control 🍎📱

A browser-based iOS simulator streaming and control system, similar to ws-scrcpy for Android. Control your iOS simulator from any web browser with real-time screen streaming and touch input.

## ✨ Features

- **Real-time Simulator Control**: Start/stop iOS simulators using `xcrun simctl`
- **Live Screen Streaming**: View simulator screen in real-time (Phase 1: Screenshots, Phase 2: FFmpeg video)
- **Touch & Gesture Support**: Click, tap, swipe, and drag on the simulator screen
- **Keyboard Input**: Send text input directly to the simulator
- **WebDriverAgent Integration**: Full automation capabilities via WDA
- **Modern Web UI**: Beautiful, responsive interface with real-time status updates
- **Multi-Simulator Support**: Manage multiple iOS simulators simultaneously

## 🚀 MVP Phases

### Phase 1: Basic Control & Screenshots ✅

- [x] Simulator start/stop
- [x] Screenshot streaming (10 FPS refresh)
- [x] Basic touch input
- [x] Web UI with status indicators

### Phase 2: Video Streaming (Coming Soon)

- [ ] FFmpeg video capture
- [ ] WebRTC streaming
- [ ] Higher frame rates
- [ ] Quality settings

### Phase 3: Advanced Input (Coming Soon)

- [ ] Full WDA integration
- [ ] Multi-touch gestures
- [ ] Accessibility support
- [ ] App automation

### Phase 4: Production Ready (Coming Soon)

- [ ] Multiple device support
- [ ] User management
- [ ] Recording capabilities
- [ ] Performance optimization

## 🛠️ Prerequisites

- **macOS** (required for iOS simulator)
- **Xcode** with iOS Simulator
- **Node.js** 16+
- **FFmpeg** (for Phase 2+ video streaming)
- **WebDriverAgent** (for advanced automation)

## 📦 Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd ios-remote
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Verify Xcode setup**

   ```bash
   xcrun simctl list devices
   ```

4. **Install FFmpeg** (optional for Phase 1)

   ```bash
   # Using Homebrew
   brew install ffmpeg

   # Or download from https://ffmpeg.org/
   ```

## 🚀 Quick Start

1. **Start the server**

   ```bash
   npm start
   ```

2. **Open your browser**
   Navigate to `http://localhost:3000`

3. **Start a simulator**

   - Click "Start Simulator" to boot an iOS simulator
   - Wait for the simulator to fully load
   - Click "Start Stream" to begin screen streaming

4. **Control the simulator**
   - Click/tap on the screen to interact
   - Drag to swipe/scroll
   - Use the keyboard input to send text

## 🎯 Usage Guide

### Starting a Simulator

1. Click "Start Simulator" button
2. Wait for the simulator to boot (may take 10-30 seconds)
3. The simulator app will open automatically
4. Status indicator will show "Simulator: Running"

### Screen Streaming

1. Ensure simulator is running
2. Click "Start Stream" button
3. View real-time simulator screen in the browser
4. Screenshots refresh every 100ms for smooth experience

### Touch Input

- **Single Tap**: Click anywhere on the simulator screen
- **Swipe**: Click and drag to perform swipe gestures
- **Multi-touch**: Support for complex gestures (Phase 3+)

### Keyboard Input

1. Type text in the input field
2. Click "Send" or press Enter
3. Text will be sent to the active text field on simulator

### Taking Screenshots

- Click the camera button to capture current screen
- Screenshots are automatically downloaded as PNG files

## 🔧 Configuration

### Environment Variables

```bash
PORT=3000                    # Server port (default: 3000)
NODE_ENV=development         # Environment mode
WDA_PORT=8100               # WebDriverAgent port
FFMPEG_PATH=/usr/local/bin/ffmpeg  # FFmpeg binary path
```

### Simulator Selection

The system automatically selects the first available iPhone simulator. To use a specific simulator:

1. View available simulators in the right panel
2. Click on a simulator to select it
3. Start the simulator (it will use the selected one)

## 🏗️ Architecture

```
ios-remote/
├── backend/                 # Node.js server
│   ├── server.js           # Main Express server + Socket.IO
│   ├── simctl.js           # iOS simulator management
│   ├── wda-client.js       # WebDriverAgent client
│   └── ffmpeg-stream.js    # Video streaming pipeline
├── frontend/                # Web UI
│   ├── index.html          # Main HTML interface
│   ├── app.js              # JavaScript application
│   └── style.css           # Styling
└── package.json            # Dependencies & scripts
```

### Backend Components

- **SimctlManager**: Handles `xcrun simctl` commands
- **WDAClient**: Manages WebDriverAgent connections
- **FFmpegStream**: Video capture and streaming
- **Socket.IO Server**: Real-time communication

### Frontend Components

- **Control Panel**: Simulator and stream controls
- **Display Area**: Canvas for simulator screen
- **Status Indicators**: Real-time connection status
- **Simulator List**: Available device management

## 🔌 API Endpoints

### HTTP Endpoints

- `GET /api/simulators` - List available simulators
- `GET /api/screenshot` - Get current simulator screenshot

### Socket.IO Events

#### Client → Server

- `start-simulator` - Boot iOS simulator
- `stop-simulator` - Shutdown simulator
- `start-stream` - Begin screen streaming
- `stop-stream` - Stop streaming
- `tap` - Send tap event
- `swipe` - Send swipe gesture
- `keyboard-input` - Send text input

#### Server → Client

- `simulator-status` - Simulator state updates
- `stream-status` - Streaming state updates
- `simulators-list` - Available simulators
- `input-result` - Input event results
- `error` - Error messages

## 🐛 Troubleshooting

### Common Issues

**Simulator won't start**

- Ensure Xcode is properly installed
- Check that iOS Simulator app is available
- Verify `xcrun simctl` works in terminal

**No screen display**

- Check simulator is fully booted
- Verify streaming is started
- Check browser console for errors

**Touch input not working**

- Ensure simulator is running
- Check WebDriverAgent is accessible
- Verify WDA port 8100 is available

**Performance issues**

- Reduce screenshot frequency in `ffmpeg-stream.js`
- Check system resources
- Consider using FFmpeg streaming (Phase 2)

### Debug Mode

Enable debug logging:

```bash
DEBUG=* npm start
```

### Logs

Check server console for detailed error messages and status updates.

## 🚧 Development

### Running in Development Mode

```bash
npm run dev  # Uses nodemon for auto-restart
```

### Adding New Features

1. **Backend**: Extend relevant manager class
2. **Frontend**: Add UI elements and event handlers
3. **Communication**: Define Socket.IO events
4. **Testing**: Test with real iOS simulator

### Code Style

- Use ES6+ features
- Follow Node.js best practices
- Maintain consistent error handling
- Add JSDoc comments for complex functions

## 🔮 Roadmap

### Short Term (Phase 2)

- [ ] FFmpeg video streaming
- [ ] WebRTC integration
- [ ] Quality settings
- [ ] Performance optimization

### Medium Term (Phase 3)

- [ ] Full WDA automation
- [ ] Multi-touch gestures
- [ ] Accessibility features
- [ ] App testing tools

### Long Term (Phase 4)

- [ ] Real device support
- [ ] Cloud deployment
- [ ] Team collaboration
- [ ] Enterprise features

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- **WebDriverAgent** - iOS automation framework
- **Socket.IO** - Real-time communication
- **FFmpeg** - Video processing
- **iOS Simulator** - Apple's development tool

## 📞 Support

- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Documentation**: This README + code comments

---

**Note**: This project is designed for development and testing purposes. Use responsibly and in accordance with Apple's terms of service.

