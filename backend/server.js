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
      console.log("🔄 Starting simulator process...");

      // Use WDA client to start simulator
      console.log("🔍 Checking Xcode availability...");
      const isAvailable = await wdaClient.checkXcode();

      if (!isAvailable) {
        throw new Error("Xcode tools not available");
      }

      console.log("📱 Listing available simulators...");
      const devices = await wdaClient.listDevices();

      if (devices.length === 0) {
        throw new Error("No iOS simulators found");
      }

      console.log("🚀 Connecting to simulator...");
      const deviceId = await wdaClient.connectToDevice();

      console.log("✅ Simulator connected successfully:", deviceId);
      socket.emit("simulator-status", {
        status: "started",
        result: { deviceId },
      });
    } catch (error) {
      console.error("❌ Error starting simulator:", error);
      socket.emit("error", {
        message: "Failed to start simulator",
        error: error.message,
      });
    }
  });

  socket.on("stop-simulator", async () => {
    try {
      await wdaClient.disconnect();
      socket.emit("simulator-status", { status: "stopped", result: {} });
    } catch (error) {
      socket.emit("error", {
        message: "Failed to stop simulator",
        error: error.message,
      });
    }
  });

  socket.on("get-simulators", async () => {
    try {
      // Use WDA client to list simulators
      const devices = await wdaClient.listDevices();

      // Convert to format expected by frontend
      const simulators = devices.map((device) => ({
        id: device.id,
        name: device.name,
        runtime: device.os || "Unknown",
        state: device.status === "Booted" ? "booted" : "shutdown",
      }));

      socket.emit("simulators-list", simulators);
    } catch (error) {
      socket.emit("error", {
        message: "Failed to get simulators",
        error: error.message,
      });
    }
  });

  // Handle input events using WDA client with error handling
  socket.on("tap", async (data) => {
    try {
      console.log("👆 Received tap event:", data);
      if (!data.x || !data.y) {
        throw new Error("Invalid tap coordinates");
      }

      const result = await wdaClient.tap(data.x, data.y);
      socket.emit("input-result", { type: "tap", success: true, result });
    } catch (error) {
      console.error("❌ Tap error:", error.message);
      socket.emit("input-result", {
        type: "tap",
        success: false,
        error: error.message,
      });
    }
  });

  socket.on("swipe", async (data) => {
    try {
      console.log("👆 Received swipe event:", data);
      if (!data.startX || !data.startY || !data.endX || !data.endY) {
        throw new Error("Invalid swipe coordinates");
      }

      const result = await wdaClient.swipe(
        data.startX,
        data.startY,
        data.endX,
        data.endY,
        data.duration || 1000
      );
      socket.emit("input-result", { type: "swipe", success: true, result });
    } catch (error) {
      console.error("❌ Swipe error:", error.message);
      socket.emit("input-result", {
        type: "swipe",
        success: false,
        error: error.message,
      });
    }
  });

  socket.on("keyboard-input", async (data) => {
    try {
      console.log("⌨️ Received keyboard event:", data);
      if (!data.text || data.text.trim().length === 0) {
        throw new Error("Empty keyboard input");
      }

      const result = await wdaClient.sendKeys(data.text);
      socket.emit("input-result", { type: "keyboard", success: true, result });
    } catch (error) {
      console.error("❌ Keyboard error:", error.message);
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
    const devices = await wdaClient.listDevices();
    const simulators = devices.map((device) => ({
      id: device.id,
      name: device.name,
      runtime: device.os || "Unknown",
      state: device.status === "Booted" ? "booted" : "shutdown",
    }));
    res.json(simulators);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/screenshot", async (req, res) => {
  try {
    console.log("📸 Screenshot API called");

    if (!wdaClient.isConnected) {
      console.log("⚠️ No simulator connected, connecting...");
      await wdaClient.connectToDevice();
    }

    // Take screenshot with absolute path
    const screenshotPath = path.join(__dirname, `screenshot_${Date.now()}.png`);

    try {
      // Use simpler approach with execSync
      const { execSync } = require("child_process");
      execSync(
        `xcrun simctl io ${wdaClient.currentDevice} screenshot ${screenshotPath}`
      );
      console.log("✅ Screenshot taken successfully");

      // Read the screenshot file and send it
      const fs = require("fs");
      const screenshotData = fs.readFileSync(screenshotPath);

      // Set proper headers
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Content-Length": screenshotData.length,
        "Cache-Control": "no-cache, no-store",
      });

      // Send the data
      res.end(screenshotData);

      // Clean up the file after sending (with delay to ensure it's sent)
      setTimeout(() => {
        try {
          fs.unlinkSync(screenshotPath);
        } catch (cleanupError) {
          console.log(
            "⚠️ Could not delete screenshot file:",
            cleanupError.message
          );
        }
      }, 100);
    } catch (screenshotError) {
      console.error("❌ Screenshot error:", screenshotError.message);
      res.status(500).json({ error: "Failed to take screenshot" });
    }
  } catch (error) {
    console.error("❌ Screenshot API error:", error);
    res.status(500).json({ error: error.message });
  }
});

// New API endpoint to test WDA client
app.get("/api/test-wda", async (req, res) => {
  try {
    const isAvailable = await wdaClient.checkXcode();
    const devices = await wdaClient.listDevices();
    const status = wdaClient.getStatus();

    res.json({
      status: isAvailable ? "success" : "error",
      message: isAvailable ? "WDA client working" : "WDA is not available",
      wdaStatus: status,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
      wdaStatus: wdaClient.getStatus(),
    });
  }
});

// New API endpoint to debug coordinate system
app.get("/api/debug-coordinates", async (req, res) => {
  try {
    console.log("🔍 Debug coordinate system requested");
    const coordinateInfo = await wdaClient.debugCoordinateSystem();

    res.json({
      status: "success",
      message: "Coordinate system debug info retrieved",
      coordinateInfo: coordinateInfo,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

// Start server
server.listen(PORT, async () => {
  console.log(`🚀 iOS Remote server running on http://localhost:${PORT}`);
  console.log(`📱 Ready to control iOS simulator`);

  // Test WDA client on startup
  try {
    console.log("🔍 Testing WDA client...");
    const isAvailable = await wdaClient.checkXcode();
    if (isAvailable) {
      const devices = await wdaClient.listDevices();
      console.log(`✅ WDA client working - Found ${devices.length} simulators`);
    } else {
      console.log("❌ WDA client not available");
    }
  } catch (error) {
    console.log(`❌ Error testing WDA client: ${error.message}`);
  }
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down gracefully...");
  await ffmpegStream.stopStream();
  await wdaClient.disconnect();
  process.exit(0);
});
