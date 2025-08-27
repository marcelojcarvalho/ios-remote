const { EventEmitter } = require("events");
const SimplePeer = require("simple-peer");

class WebRTCStream extends EventEmitter {
  constructor() {
    super();
    this.peers = new Map(); // Map of socket.id to peer connection
    this.isStreaming = false;
    this.simulatorId = null;
    this.screenshotMode = false; // Default to WebRTC mode
  }

  /**
   * Start WebRTC streaming from iOS device or simulator
   */
  async startStream(socket, simulatorId = null) {
    try {
      if (this.isStreaming) {
        await this.stopStream();
      }

      this.simulatorId = simulatorId;
      this.isStreaming = true;

      // Default to WebRTC mode, fallback to screenshots if needed
      if (this.screenshotMode) {
        await this.startScreenshotLoop(socket);
        this.emit("stream-started");
        console.log("📹 Started streaming (screenshot mode)");
      } else {
        await this.setupWebRTCConnection(socket);
        this.emit("stream-started");
        console.log("🌐 Started streaming (WebRTC mode)");
      }
    } catch (error) {
      console.error("Error starting stream:", error);
      throw error;
    }
  }

  /**
   * Start screenshot loop for simulator (fallback mode)
   */
  async startScreenshotLoop(socket) {
    if (this.screenshotInterval) {
      clearInterval(this.screenshotInterval);
    }

    // Take screenshot every 100ms (10 FPS)
    this.screenshotInterval = setInterval(async () => {
      try {
        if (socket && socket.connected) {
          socket.emit("request-screenshot");
        }
      } catch (error) {
        console.error("Error in screenshot loop:", error);
      }
    }, 100);
  }

  /**
   * Setup WebRTC connection for real iOS device
   */
  async setupWebRTCConnection(socket) {
    try {
      console.log("🌐 Setting up WebRTC connection...");

      // Create a new peer connection for this socket
      const peer = new SimplePeer({
        initiator: false,
        trickle: false,
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        },
      });

      // Store the peer connection
      this.peers.set(socket.id, peer);

      // Handle WebRTC signaling
      socket.on("webrtc-signal", (data) => {
        console.log("📡 Received WebRTC signal:", data.type);
        peer.signal(data);
      });

      // Handle peer connection events
      peer.on("signal", (data) => {
        console.log("📡 Sending WebRTC signal:", data.type);
        socket.emit("webrtc-signal", data);
      });

      peer.on("connect", () => {
        console.log("✅ WebRTC connection established");
        socket.emit("webrtc-connected");
      });

      peer.on("stream", (stream) => {
        console.log("📹 Received WebRTC stream");
        // Forward the stream to the client
        socket.emit("webrtc-stream", { streamId: stream.id });
      });

      peer.on("error", (error) => {
        console.error("❌ WebRTC peer error:", error);
        socket.emit("webrtc-error", { error: error.message });
      });

      peer.on("close", () => {
        console.log("🔌 WebRTC connection closed");
        this.peers.delete(socket.id);
      });

      console.log("✅ WebRTC connection setup completed");
    } catch (error) {
      console.error("Error setting up WebRTC:", error);
      throw error;
    }
  }

  /**
   * Switch to WebRTC mode (call this when testing on real iOS device)
   */
  async enableWebRTCMode() {
    try {
      this.screenshotMode = false;
      console.log("🌐 WebRTC mode enabled - ready for real iOS device");
      return { success: true, mode: "webrtc" };
    } catch (error) {
      console.error("Error enabling WebRTC mode:", error);
      throw error;
    }
  }

  /**
   * Switch back to screenshot mode (for simulator testing)
   */
  async enableScreenshotMode() {
    try {
      this.screenshotMode = true;
      console.log("📸 Screenshot mode enabled - for simulator testing");
      return { success: true, mode: "screenshot" };
    } catch (error) {
      console.error("Error enabling screenshot mode:", error);
      throw error;
    }
  }

  /**
   * Stop the current stream
   */
  async stopStream() {
    try {
      // Stop screenshot loop
      if (this.screenshotInterval) {
        clearInterval(this.screenshotInterval);
        this.screenshotInterval = null;
      }

      // Close all WebRTC connections
      for (const [socketId, peer] of this.peers) {
        try {
          peer.destroy();
        } catch (error) {
          console.error(`Error destroying peer ${socketId}:`, error);
        }
      }
      this.peers.clear();

      this.isStreaming = false;
      this.simulatorId = null;

      this.emit("stream-stopped");
      console.log("🛑 Stream stopped");
    } catch (error) {
      console.error("Error stopping stream:", error);
      throw error;
    }
  }

  /**
   * Get stream status
   */
  getStatus() {
    return {
      isStreaming: this.isStreaming,
      mode: this.screenshotMode ? "screenshot" : "webrtc",
      simulatorId: this.simulatorId,
      peerCount: this.peers.size,
      hasScreenshotInterval: !!this.screenshotInterval,
    };
  }

  /**
   * Handle client disconnection
   */
  handleClientDisconnect(socketId) {
    const peer = this.peers.get(socketId);
    if (peer) {
      try {
        peer.destroy();
        this.peers.delete(socketId);
        console.log(`🔌 Cleaned up WebRTC peer for socket ${socketId}`);
      } catch (error) {
        console.error(`Error cleaning up peer ${socketId}:`, error);
      }
    }
  }

  /**
   * Get supported streaming modes
   */
  getSupportedModes() {
    return {
      screenshot: {
        name: "Screenshot Mode",
        description: "High-frequency screenshots for simulator testing",
        supported: true,
        latency: "High",
        quality: "Medium",
      },
      webrtc: {
        name: "WebRTC Mode",
        description: "Real-time streaming for iOS devices",
        supported: true,
        latency: "Low",
        quality: "High",
      },
    };
  }

  /**
   * Update stream quality (for WebRTC mode)
   */
  async updateStreamQuality(quality) {
    try {
      if (!this.isStreaming) {
        throw new Error("No active stream to update");
      }

      if (this.screenshotMode) {
        // For screenshot mode, adjust interval
        const intervals = {
          low: 200, // 5 FPS
          medium: 100, // 10 FPS
          high: 50, // 20 FPS
        };

        if (intervals[quality]) {
          if (this.screenshotInterval) {
            clearInterval(this.screenshotInterval);
            this.screenshotInterval = setInterval(async () => {
              // Recreate screenshot loop with new interval
            }, intervals[quality]);
          }
        }
      } else {
        // For WebRTC mode, quality is handled by the peer connection
        console.log(`🔄 WebRTC quality update requested: ${quality}`);
      }

      return {
        success: true,
        quality,
        mode: this.screenshotMode ? "screenshot" : "webrtc",
      };
    } catch (error) {
      console.error("Error updating stream quality:", error);
      throw error;
    }
  }
}

module.exports = WebRTCStream;
