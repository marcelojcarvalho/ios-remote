const { spawn } = require("child_process");
const { EventEmitter } = require("events");

// Check if FFmpeg is available (optional dependency)
let ffmpegAvailable = false;
try {
  require("fluent-ffmpeg");
  ffmpegAvailable = true;
} catch (error) {
  console.log(
    "⚠️ FFmpeg not available - video streaming will use screenshots only"
  );
}

class FFmpegStream extends EventEmitter {
  constructor() {
    super();
    this.ffmpegProcess = null;
    this.isStreaming = false;
    this.currentSocket = null;
    this.simulatorId = null;
  }

  /**
   * Start video streaming from iOS simulator
   */
  async startStream(socket, simulatorId = null) {
    try {
      if (this.isStreaming) {
        await this.stopStream();
      }

      this.currentSocket = socket;
      this.simulatorId = simulatorId;

      // For Phase 1 MVP, we'll use screenshots in a loop
      // Later phases will implement actual FFmpeg streaming
      await this.startScreenshotLoop();

      this.isStreaming = true;
      this.emit("stream-started");

      console.log("📹 Started screenshot streaming loop");
    } catch (error) {
      console.error("Error starting stream:", error);
      throw error;
    }
  }

  /**
   * Start screenshot loop for Phase 1 MVP
   */
  async startScreenshotLoop() {
    if (this.screenshotInterval) {
      clearInterval(this.screenshotInterval);
    }

    // Take screenshot every 100ms (10 FPS)
    this.screenshotInterval = setInterval(async () => {
      try {
        if (this.currentSocket && this.currentSocket.connected) {
          // For now, we'll emit a screenshot request
          // The actual screenshot will be taken by the simctl module
          this.currentSocket.emit("request-screenshot");
        }
      } catch (error) {
        console.error("Error in screenshot loop:", error);
      }
    }, 100);
  }

  /**
   * Start actual FFmpeg streaming (Phase 2+)
   */
  async startFFmpegStream(simulatorId) {
    try {
      const targetDevice = simulatorId || "booted";

      // Command to record video from simulator
      const ffmpegArgs = [
        "-f",
        "avfoundation",
        "-i",
        `:${targetDevice}`,
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-tune",
        "zerolatency",
        "-f",
        "mpegts",
        "-flush_packets",
        "1",
        "pipe:1",
      ];

      console.log("🎬 Starting FFmpeg stream with args:", ffmpegArgs.join(" "));

      this.ffmpegProcess = spawn("ffmpeg", ffmpegArgs, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      this.ffmpegProcess.stdout.on("data", (data) => {
        if (this.currentSocket && this.currentSocket.connected) {
          // Send video data to client
          this.currentSocket.emit("video-frame", data);
        }
      });

      this.ffmpegProcess.stderr.on("data", (data) => {
        console.log("FFmpeg stderr:", data.toString());
      });

      this.ffmpegProcess.on("close", (code) => {
        console.log(`FFmpeg process exited with code ${code}`);
        this.isStreaming = false;
        this.emit("stream-stopped");
      });

      this.ffmpegProcess.on("error", (error) => {
        console.error("FFmpeg process error:", error);
        this.isStreaming = false;
        this.emit("stream-error", error);
      });

      this.isStreaming = true;
      console.log("✅ FFmpeg stream started");
    } catch (error) {
      console.error("Error starting FFmpeg stream:", error);
      throw error;
    }
  }

  /**
   * Start WebRTC streaming (Phase 3+)
   */
  async startWebRTCStream(simulatorId) {
    try {
      // This would integrate with a WebRTC server
      // For now, we'll use the screenshot approach
      console.log("🌐 WebRTC streaming not yet implemented, using screenshots");
      await this.startScreenshotLoop();
    } catch (error) {
      console.error("Error starting WebRTC stream:", error);
      throw error;
    }
  }

  /**
   * Stop the current stream
   */
  async stopStream() {
    try {
      if (this.screenshotInterval) {
        clearInterval(this.screenshotInterval);
        this.screenshotInterval = null;
      }

      if (this.ffmpegProcess) {
        this.ffmpegProcess.kill("SIGTERM");
        this.ffmpegProcess = null;
      }

      this.isStreaming = false;
      this.currentSocket = null;
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
      hasSocket: !!this.currentSocket,
      simulatorId: this.simulatorId,
      ffmpegRunning: !!this.ffmpegProcess,
    };
  }

  /**
   * Check if FFmpeg is available
   */
  async checkFFmpegAvailability() {
    return new Promise((resolve) => {
      const ffmpegCheck = spawn("ffmpeg", ["-version"]);

      ffmpegCheck.on("error", () => {
        resolve(false);
      });

      ffmpegCheck.on("close", (code) => {
        resolve(code === 0);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        ffmpegCheck.kill();
        resolve(false);
      }, 5000);
    });
  }

  /**
   * Get supported codecs
   */
  async getSupportedCodecs() {
    try {
      return new Promise((resolve, reject) => {
        const ffmpegCodecs = spawn("ffmpeg", ["-codecs"]);
        let output = "";

        ffmpegCodecs.stdout.on("data", (data) => {
          output += data.toString();
        });

        ffmpegCodecs.on("close", (code) => {
          if (code === 0) {
            const codecs = output
              .split("\n")
              .filter((line) => line.includes("DEV"))
              .map((line) => line.trim());
            resolve(codecs);
          } else {
            reject(new Error("Failed to get codecs"));
          }
        });

        ffmpegCodecs.on("error", reject);
      });
    } catch (error) {
      console.error("Error getting codecs:", error);
      return [];
    }
  }

  /**
   * Update stream quality
   */
  async updateStreamQuality(quality) {
    try {
      if (!this.isStreaming) {
        throw new Error("No active stream to update");
      }

      // For now, just log the quality change
      // In future phases, this would restart FFmpeg with new parameters
      console.log(`🔄 Updating stream quality to: ${quality}`);

      return { success: true, quality };
    } catch (error) {
      console.error("Error updating stream quality:", error);
      throw error;
    }
  }
}

module.exports = FFmpegStream;
