// iOS Remote Control Frontend Application
class IOSRemoteApp {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.simulatorRunning = false;
    this.streaming = false;
    this.wdaConnected = false;
    this.currentSimulator = null;
    this.simulators = [];
    this.canvas = null;
    this.ctx = null;
    this.video = null;
    this.touchStartPos = null;
    this.screenshotInterval = null;

    this.init();
  }

  init() {
    this.connectSocket();
    this.setupEventListeners();
    this.setupCanvas();
    this.loadSimulators();
  }

  connectSocket() {
    this.socket = io();

    this.socket.on("connect", () => {
      console.log("Connected to server");
      this.isConnected = true;
      this.updateConnectionStatus();
    });

    this.socket.on("disconnect", () => {
      console.log("Disconnected from server");
      this.isConnected = false;
      this.updateConnectionStatus();
    });

    this.socket.on("simulator-status", (data) => {
      this.handleSimulatorStatus(data);
    });

    this.socket.on("stream-status", (data) => {
      this.handleStreamStatus(data);
    });

    this.socket.on("simulators-list", (data) => {
      this.updateSimulatorsList(data);
    });

    this.socket.on("input-result", (data) => {
      this.handleInputResult(data);
    });

    this.socket.on("error", (data) => {
      this.showError(data.message);
    });

    this.socket.on("request-screenshot", () => {
      this.requestScreenshot();
    });
  }

  setupEventListeners() {
    // Simulator control buttons
    document.getElementById("start-simulator").addEventListener("click", () => {
      this.startSimulator();
    });

    document.getElementById("stop-simulator").addEventListener("click", () => {
      this.stopSimulator();
    });

    document
      .getElementById("refresh-simulators")
      .addEventListener("click", () => {
        this.loadSimulators();
      });

    // Streaming control buttons
    document.getElementById("start-stream").addEventListener("click", () => {
      this.startStream();
    });

    document.getElementById("stop-stream").addEventListener("click", () => {
      this.stopStream();
    });

    // Input controls
    document.getElementById("send-keys").addEventListener("click", () => {
      this.sendKeyboardInput();
    });

    document
      .getElementById("keyboard-input")
      .addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.sendKeyboardInput();
        }
      });

    // Display controls
    document.getElementById("fullscreen-btn").addEventListener("click", () => {
      this.toggleFullscreen();
    });

    document.getElementById("screenshot-btn").addEventListener("click", () => {
      this.takeScreenshot();
    });

    // Canvas touch/mouse events
    this.setupCanvasEvents();

    // Modal close button
    document
      .getElementById("close-error-modal")
      .addEventListener("click", () => {
        this.hideError();
      });

    // Click outside modal to close
    window.addEventListener("click", (e) => {
      const modal = document.getElementById("error-modal");
      if (e.target === modal) {
        this.hideError();
      }
    });
  }

  setupCanvas() {
    this.canvas = document.getElementById("simulator-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.video = document.getElementById("simulator-video");

    // Set initial canvas size
    this.resizeCanvas();

    // Handle window resize
    window.addEventListener("resize", () => {
      this.resizeCanvas();
    });
  }

  setupCanvasEvents() {
    const canvas = this.canvas;
    const touchOverlay = document.getElementById("touch-overlay");

    // Mouse events
    canvas.addEventListener("mousedown", (e) => this.handlePointerDown(e));
    canvas.addEventListener("mousemove", (e) => this.handlePointerMove(e));
    canvas.addEventListener("mouseup", (e) => this.handlePointerUp(e));

    // Touch events
    canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      this.handlePointerDown(e.touches[0]);
    });

    canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      this.handlePointerMove(e.touches[0]);
    });

    canvas.addEventListener("touchend", (e) => {
      e.preventDefault();
      this.handlePointerUp(e.changedTouches[0]);
    });
  }

  handlePointerDown(e) {
    if (!this.simulatorRunning) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.touchStartPos = { x, y };
    this.showTouchIndicator(x, y);

    // Send tap event to server
    this.socket.emit("tap", { x, y });
  }

  handlePointerMove(e) {
    if (!this.simulatorRunning || !this.touchStartPos) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Update touch indicator
    this.updateTouchIndicator(x, y);
  }

  handlePointerUp(e) {
    if (!this.simulatorRunning || !this.touchStartPos) return;

    const rect = this.canvas.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    // Check if it's a swipe (movement > threshold)
    const deltaX = Math.abs(endX - this.touchStartPos.x);
    const deltaY = Math.abs(endY - this.touchStartPos.y);
    const threshold = 30;

    if (deltaX > threshold || deltaY > threshold) {
      // Send swipe event
      this.socket.emit("swipe", {
        startX: this.touchStartPos.x,
        startY: this.touchStartPos.y,
        endX: endX,
        endY: endY,
        duration: 1000,
      });
    }

    this.touchStartPos = null;
    this.hideTouchIndicator();
  }

  showTouchIndicator(x, y) {
    const indicator = document.getElementById("touch-indicator");
    const overlay = document.getElementById("touch-overlay");

    indicator.style.left = x + "px";
    indicator.style.top = y + "px";
    overlay.style.display = "block";
  }

  updateTouchIndicator(x, y) {
    const indicator = document.getElementById("touch-indicator");
    indicator.style.left = x + "px";
    indicator.style.top = y + "px";
  }

  hideTouchIndicator() {
    const overlay = document.getElementById("touch-overlay");
    overlay.style.display = "none";
  }

  resizeCanvas() {
    const container = document.getElementById("display-container");
    const containerRect = container.getBoundingClientRect();

    // Maintain aspect ratio (iPhone-like)
    const aspectRatio = 9 / 16;
    const maxWidth = containerRect.width - 40;
    const maxHeight = containerRect.height - 40;

    let width = maxWidth;
    let height = width / aspectRatio;

    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }

    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.width = width + "px";
    this.canvas.style.height = height + "px";
  }

  async startSimulator() {
    try {
      this.showLoading(true);
      this.socket.emit("start-simulator");
    } catch (error) {
      this.showError("Failed to start simulator: " + error.message);
      this.showLoading(false);
    }
  }

  async stopSimulator() {
    try {
      this.showLoading(true);
      this.socket.emit("stop-simulator");
    } catch (error) {
      this.showError("Failed to stop simulator: " + error.message);
      this.showLoading(false);
    }
  }

  async startStream() {
    try {
      this.showLoading(true);
      this.socket.emit("start-stream");
    } catch (error) {
      this.showError("Failed to start stream: " + error.message);
      this.showLoading(false);
    }
  }

  async stopStream() {
    try {
      this.showLoading(true);
      this.socket.emit("stop-stream");
    } catch (error) {
      this.showError("Failed to stop stream: " + error.message);
      this.showLoading(false);
    }
  }

  async sendKeyboardInput() {
    const input = document.getElementById("keyboard-input");
    const text = input.value.trim();

    if (!text) return;

    try {
      this.socket.emit("keyboard-input", { text });
      input.value = "";
    } catch (error) {
      this.showError("Failed to send keyboard input: " + error.message);
    }
  }

  async loadSimulators() {
    try {
      this.socket.emit("get-simulators");
    } catch (error) {
      this.showError("Failed to load simulators: " + error.message);
    }
  }

  async requestScreenshot() {
    try {
      const response = await fetch("/api/screenshot");
      if (response.ok) {
        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        this.displayScreenshot(imageUrl);
      }
    } catch (error) {
      console.error("Failed to get screenshot:", error);
    }
  }

  displayScreenshot(imageUrl) {
    const img = new Image();
    img.onload = () => {
      // Clear canvas and draw image
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // Calculate dimensions to maintain aspect ratio
      const canvasAspect = this.canvas.width / this.canvas.height;
      const imageAspect = img.width / img.height;

      let drawWidth, drawHeight, offsetX, offsetY;

      if (imageAspect > canvasAspect) {
        // Image is wider than canvas
        drawHeight = this.canvas.height;
        drawWidth = drawHeight * imageAspect;
        offsetX = (this.canvas.width - drawWidth) / 2;
        offsetY = 0;
      } else {
        // Image is taller than canvas
        drawWidth = this.canvas.width;
        drawHeight = drawWidth / imageAspect;
        offsetX = 0;
        offsetY = (this.canvas.height - drawHeight) / 2;
      }

      this.ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

      // Clean up
      URL.revokeObjectURL(imageUrl);
    };
    img.src = imageUrl;
  }

  takeScreenshot() {
    if (!this.simulatorRunning) {
      this.showError("No simulator running");
      return;
    }

    // Create a download link for the current canvas
    const link = document.createElement("a");
    link.download = `ios-simulator-${Date.now()}.png`;
    link.href = this.canvas.toDataURL();
    link.click();
  }

  toggleFullscreen() {
    const container = document.getElementById("display-container");

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch((err) => {
        this.showError("Failed to enter fullscreen: " + err.message);
      });
    } else {
      document.exitFullscreen();
    }
  }

  handleSimulatorStatus(data) {
    this.showLoading(false);

    if (data.status === "started") {
      this.simulatorRunning = true;
      this.updateSimulatorStatus("connected");
      this.enableStreamingControls();
      this.showSimulatorDisplay();
    } else if (data.status === "stopped") {
      this.simulatorRunning = false;
      this.updateSimulatorStatus("disconnected");
      this.disableStreamingControls();
      this.hideSimulatorDisplay();
    }
  }

  handleStreamStatus(data) {
    this.showLoading(false);

    if (data.status === "started") {
      this.streaming = true;
      this.updateStreamStatus("streaming");
      this.startScreenshotLoop();
    } else if (data.status === "stopped") {
      this.streaming = false;
      this.updateStreamStatus("disconnected");
      this.stopScreenshotLoop();
    }
  }

  handleInputResult(data) {
    if (data.success) {
      console.log(`${data.type} successful:`, data.result);
    } else {
      console.error(`${data.type} failed:`, data.error);
      this.showError(`${data.type} failed: ${data.error}`);
    }
  }

  updateSimulatorsList(simulators) {
    this.simulators = simulators;
    const grid = document.getElementById("simulator-grid");

    if (simulators.length === 0) {
      grid.innerHTML = '<div class="loading">No simulators found</div>';
      return;
    }

    grid.innerHTML = simulators
      .map(
        (sim) => `
            <div class="simulator-item ${
              sim.state === "booted" ? "active" : ""
            }" 
                 data-id="${sim.id}">
                <h4>${sim.name}</h4>
                <p>Runtime: ${sim.runtime}</p>
                <p>ID: ${sim.id}</p>
                <span class="status ${sim.state}">${sim.state}</span>
            </div>
        `
      )
      .join("");

    // Add click handlers
    grid.querySelectorAll(".simulator-item").forEach((item) => {
      item.addEventListener("click", () => {
        this.selectSimulator(item.dataset.id);
      });
    });
  }

  selectSimulator(simulatorId) {
    // Remove active class from all items
    document.querySelectorAll(".simulator-item").forEach((item) => {
      item.classList.remove("active");
    });

    // Add active class to selected item
    const selectedItem = document.querySelector(`[data-id="${simulatorId}"]`);
    if (selectedItem) {
      selectedItem.classList.add("active");
    }

    this.currentSimulator = simulatorId;
  }

  updateConnectionStatus() {
    const statusDot = document.querySelector("#simulator-status .status-dot");
    const statusText = document.querySelector("#simulator-status span");

    if (this.isConnected) {
      statusDot.className = "status-dot connected";
      statusText.textContent = "Server: Connected";
    } else {
      statusDot.className = "status-dot disconnected";
      statusText.textContent = "Server: Disconnected";
    }
  }

  updateSimulatorStatus(status) {
    const statusDot = document.querySelector("#simulator-status .status-dot");
    const statusText = document.querySelector("#simulator-status span");

    statusDot.className = `status-dot ${status}`;

    switch (status) {
      case "connected":
        statusText.textContent = "Simulator: Running";
        break;
      case "disconnected":
        statusText.textContent = "Simulator: Stopped";
        break;
      default:
        statusText.textContent = "Simulator: Unknown";
    }
  }

  updateStreamStatus(status) {
    const statusDot = document.querySelector("#stream-status .status-dot");
    const statusText = document.querySelector("#stream-status span");

    statusDot.className = `status-dot ${status}`;

    switch (status) {
      case "streaming":
        statusText.textContent = "Stream: Active";
        break;
      case "disconnected":
        statusText.textContent = "Stream: Stopped";
        break;
      default:
        statusText.textContent = "Stream: Unknown";
    }
  }

  updateWDAStatus(status) {
    const statusDot = document.querySelector("#wda-status .status-dot");
    const statusText = document.querySelector("#wda-status span");

    statusDot.className = `status-dot ${status}`;

    switch (status) {
      case "connected":
        statusText.textContent = "WDA: Connected";
        break;
      case "disconnected":
        statusText.textContent = "WDA: Disconnected";
        break;
      default:
        statusText.textContent = "WDA: Unknown";
    }
  }

  enableStreamingControls() {
    document.getElementById("start-stream").disabled = false;
    document.getElementById("keyboard-input").disabled = false;
    document.getElementById("send-keys").disabled = false;
  }

  disableStreamingControls() {
    document.getElementById("start-stream").disabled = true;
    document.getElementById("stop-stream").disabled = true;
    document.getElementById("keyboard-input").disabled = true;
    document.getElementById("send-keys").disabled = true;
  }

  showSimulatorDisplay() {
    document.getElementById("placeholder").style.display = "none";
    this.canvas.style.display = "block";
    document.getElementById("touch-overlay").style.display = "block";
  }

  hideSimulatorDisplay() {
    document.getElementById("placeholder").style.display = "flex";
    this.canvas.style.display = "none";
    document.getElementById("touch-overlay").style.display = "none";
  }

  startScreenshotLoop() {
    // Screenshots are requested by the server every 100ms
    // This creates a smooth video-like experience
    console.log("Screenshot loop started");
  }

  stopScreenshotLoop() {
    console.log("Screenshot loop stopped");
  }

  showLoading(show) {
    const spinner = document.getElementById("loading-spinner");
    spinner.style.display = show ? "flex" : "none";
  }

  showError(message) {
    const modal = document.getElementById("error-modal");
    const errorMessage = document.getElementById("error-message");

    errorMessage.textContent = message;
    modal.style.display = "block";
  }

  hideError() {
    const modal = document.getElementById("error-modal");
    modal.style.display = "none";
  }
}

// Initialize the application when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new IOSRemoteApp();
});

