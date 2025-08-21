const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const cors = require("cors");
const SimctlManager = require("./simctl");
const WDAClient = require("./wda-client");
const FFmpegStream = require("./ffmpeg-stream");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

// Initialize managers
const simctl = new SimctlManager();
const wdaClient = new WDAClient();
const ffmpegStream = new FFmpegStream();

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Handle simulator control
  socket.on("start-simulator", async () => {
    try {
      const result = await simctl.startSimulator();
      socket.emit("simulator-status", { status: "started", result });
    } catch (error) {
      socket.emit("error", {
        message: "Failed to start simulator",
        error: error.message,
      });
    }
  });

  socket.on("stop-simulator", async () => {
    try {
      const result = await simctl.stopSimulator();
      socket.emit("simulator-status", { status: "stopped", result });
    } catch (error) {
      socket.emit("error", {
        message: "Failed to stop simulator",
        error: error.message,
      });
    }
  });

  socket.on("get-simulators", async () => {
    try {
      const simulators = await simctl.listSimulators();
      socket.emit("simulators-list", simulators);
    } catch (error) {
      socket.emit("error", {
        message: "Failed to get simulators",
        error: error.message,
      });
    }
  });

  // Handle input events
  socket.on("tap", async (data) => {
    try {
      const result = await wdaClient.tap(data.x, data.y);
      socket.emit("input-result", { type: "tap", success: true, result });
    } catch (error) {
      socket.emit("input-result", {
        type: "tap",
        success: false,
        error: error.message,
      });
    }
  });

  socket.on("swipe", async (data) => {
    try {
      const result = await wdaClient.swipe(
        data.startX,
        data.startY,
        data.endX,
        data.endY,
        data.duration
      );
      socket.emit("input-result", { type: "swipe", success: true, result });
    } catch (error) {
      socket.emit("input-result", {
        type: "swipe",
        success: false,
        error: error.message,
      });
    }
  });

  socket.on("keyboard-input", async (data) => {
    try {
      const result = await wdaClient.sendKeys(data.text);
      socket.emit("input-result", { type: "keyboard", success: true, result });
    } catch (error) {
      socket.emit("input-result", {
        type: "keyboard",
        success: false,
        error: error.message,
      });
    }
  });

  // Handle video streaming
  socket.on("start-stream", async () => {
    try {
      await ffmpegStream.startStream(socket);
      socket.emit("stream-status", { status: "started" });
    } catch (error) {
      socket.emit("error", {
        message: "Failed to start stream",
        error: error.message,
      });
    }
  });

  socket.on("stop-stream", async () => {
    try {
      await ffmpegStream.stopStream();
      socket.emit("stream-status", { status: "stopped" });
    } catch (error) {
      socket.emit("error", {
        message: "Failed to stop stream",
        error: error.message,
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// API endpoints
app.get("/api/simulators", async (req, res) => {
  try {
    const simulators = await simctl.listSimulators();
    res.json(simulators);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/screenshot", async (req, res) => {
  try {
    const screenshot = await simctl.takeScreenshot();
    res.set("Content-Type", "image/png");
    res.send(screenshot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 iOS Remote server running on http://localhost:${PORT}`);
  console.log(`📱 Ready to control iOS simulator`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down gracefully...");
  await ffmpegStream.stopStream();
  process.exit(0);
});

