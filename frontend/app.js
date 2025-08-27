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
    this.webrtcPeer = null;
    this.webrtcStream = null;
    this.streamingMode = "webrtc"; // 'screenshot' or 'webrtc'

    this.init();
  }

  init() {
    console.log("🚀 Initializing iOS Remote App...");

    // Check if required elements exist
    if (!this.checkRequiredElements()) {
      console.error("❌ Required elements not found, retrying in 500ms...");
      setTimeout(() => this.init(), 500);
      return;
    }

    this.connectSocket();
    this.setupEventListeners();
    this.setupCanvas();
    this.loadSimulators();
    this.initializeStreamingStatus();

    // Test touch indicator positioning after a short delay
    setTimeout(() => {
      this.testTouchIndicator();
      // Debug coordinate system after touch test
      setTimeout(() => this.debugCoordinateSystem(), 2500);
    }, 1000);

    console.log("✅ iOS Remote App initialized successfully");
  }

  checkRequiredElements() {
    const requiredElements = [
      "start-simulator",
      "stop-simulator",
      "refresh-simulators",
      "start-stream",
      "stop-stream",
      "keyboard-input",
      "send-keys",
      "fullscreen-btn",
      "screenshot-btn",
      "close-error-modal",
      "error-modal",
      "loading-spinner",
      "simulator-canvas",
      "simulator-video",
      "touch-overlay",
      "placeholder",
      "display-container",
      "simulator-grid",
    ];

    for (const id of requiredElements) {
      const element = document.getElementById(id);
      if (!element) {
        console.error(`❌ Required element not found: ${id}`);
        return false;
      }
    }

    console.log("✅ All required elements found");
    return true;
  }

  connectSocket() {
    // Configure socket.io with reconnection options
    this.socket = io({
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

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

    this.socket.on("connect_error", (error) => {
      console.log("Connection error:", error);
      this.showError(`Connection error: ${error.message}`);
    });

    this.socket.on("reconnect", (attemptNumber) => {
      console.log(`Reconnected after ${attemptNumber} attempts`);
      this.isConnected = true;
      this.updateConnectionStatus();
    });

    this.socket.on("reconnect_failed", () => {
      console.log("Failed to reconnect");
      this.showError("Failed to reconnect to server. Please refresh the page.");
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

    // WebRTC event handlers
    this.socket.on("webrtc-signal", (data) => {
      this.handleWebRTCSignal(data);
    });

    this.socket.on("webrtc-connected", () => {
      console.log("✅ WebRTC connection established");
      this.handleWebRTCConnected();
    });

    this.socket.on("webrtc-stream", (data) => {
      console.log("📹 WebRTC stream received:", data);
      this.handleWebRTCStream(data);
    });

    this.socket.on("webrtc-error", (data) => {
      console.error("❌ WebRTC error:", data.error);
      this.showError(`WebRTC error: ${data.error}`);
    });

    this.socket.on("streaming-mode-changed", (data) => {
      console.log("🔄 Streaming mode changed:", data);
      this.handleStreamingModeChange(data);
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

    // Streaming mode control buttons
    document
      .getElementById("enable-screenshot-mode")
      .addEventListener("click", () => {
        this.enableScreenshotMode();
      });

    document
      .getElementById("enable-webrtc-mode")
      .addEventListener("click", () => {
        this.enableWebRTCMode();
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

    document.getElementById("debug-btn").addEventListener("click", () => {
      this.debugCoordinateSystem();
    });

    document.getElementById("test-grid-btn").addEventListener("click", () => {
      this.testCoordinateGrid();
    });

    document.getElementById("test-click-btn").addEventListener("click", () => {
      this.testCanvasClickability();
    });

    document.getElementById("test-canvas-btn").addEventListener("click", () => {
      this.testCanvasFunctionality();
    });

    document
      .getElementById("check-viewport-btn")
      .addEventListener("click", () => {
        this.checkViewportPositioning();
      });

    document
      .getElementById("test-alignment-btn")
      .addEventListener("click", () => {
        this.testCanvasOverlayAlignment();
      });

    // Add global click handler for debugging
    document.addEventListener("click", (e) => {
      console.log("🌍 Global click detected:", e.target);
      if (e.target === this.canvas) {
        console.log("✅ Click detected on canvas via global handler");
      }
    });

    // Canvas touch/mouse events - delay this until canvas is ready
    setTimeout(() => {
      this.setupCanvasEvents();
    }, 300);

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
    // Try to find canvas with retry mechanism
    this.canvas = this.findCanvasElement();
    this.video = document.getElementById("simulator-video");

    if (!this.canvas) {
      console.error("❌ Canvas element not found: simulator-canvas");
      return;
    }

    this.ctx = this.canvas.getContext("2d");

    if (!this.ctx) {
      console.error("❌ Could not get canvas context");
      return;
    }

    console.log("✅ Canvas setup successful");

    // Set initial canvas size
    this.resizeCanvas();

    // Handle window resize
    window.addEventListener("resize", () => {
      this.resizeCanvas();
    });
  }

  findCanvasElement() {
    let canvas = document.getElementById("simulator-canvas");

    if (!canvas) {
      console.log("🔍 Canvas not found, retrying...");
      // Try a few more times with delays
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          canvas = document.getElementById("simulator-canvas");
          if (canvas) {
            console.log("✅ Canvas found on retry attempt", i + 1);
            this.setupCanvas(); // Re-run setup
          }
        }, (i + 1) * 100);
      }
      return null;
    }

    return canvas;
  }

  setupCanvasEvents() {
    const canvas = this.canvas;
    const touchOverlay = document.getElementById("touch-overlay");

    // Check if canvas exists
    if (!canvas) {
      console.error("❌ Cannot setup canvas events: canvas not found");
      return;
    }

    console.log("🎯 Setting up canvas events...");
    console.log(`🎯 Canvas element:`, canvas);
    console.log(`🎯 Canvas style:`, canvas.style.cssText);

    // Mouse events
    canvas.addEventListener("mousedown", (e) => {
      console.log("🖱️ Mouse down event triggered on canvas");
      this.handlePointerDown(e);
    });
    canvas.addEventListener("mousemove", (e) => this.handlePointerMove(e));
    canvas.addEventListener("mouseup", (e) => this.handlePointerUp(e));
    canvas.addEventListener("click", (e) => {
      console.log("🖱️ Click event triggered on canvas");
      this.handlePointerDown(e);
    });

    // Touch events
    canvas.addEventListener("touchstart", (e) => {
      console.log("👆 Touch start event triggered on canvas");
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

    console.log("✅ Canvas events setup completed");
  }

  handlePointerDown(e) {
    console.log("🎯 handlePointerDown called with event:", e);
    console.log("🎯 simulatorRunning:", this.simulatorRunning);

    if (!this.simulatorRunning) {
      console.log("❌ Simulator not running, ignoring tap");
      return;
    }

    // Get the canvas element's position relative to the viewport
    const rect = this.canvas.getBoundingClientRect();

    // Calculate coordinates relative to the canvas element
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    console.log(
      `🖱️ Pointer down - clientX: ${e.clientX}, clientY: ${e.clientY}`
    );
    console.log(`🖱️ Canvas rect - left: ${rect.left}, top: ${rect.top}`);
    console.log(`🖱️ Calculated coordinates - x: ${x}, y: ${y}`);

    // Validate coordinates are within canvas bounds
    if (x < 0 || x > this.canvas.width || y < 0 || y > this.canvas.height) {
      console.warn(
        `⚠️ Tap coordinates (${x}, ${y}) outside canvas bounds (${this.canvas.width}x${this.canvas.height})`
      );
      return;
    }

    // Ensure coordinates are positive and within reasonable bounds
    if (x < 0 || y < 0 || x > 10000 || y > 10000) {
      console.error(`❌ Invalid tap coordinates: (${x}, ${y})`);
      return;
    }

    this.touchStartPos = { x, y };
    this.showTouchIndicator(x, y);

    // Draw crosshair on canvas for visual debugging
    this.drawTapCrosshair(x, y);

    // Send tap event to server with proper coordinate scaling
    const scaledX = Math.round(x);
    const scaledY = Math.round(y);
    console.log(`📤 Sending tap to server: (${scaledX}, ${scaledY})`);
    this.socket.emit("tap", { x: scaledX, y: scaledY });
  }

  handlePointerMove(e) {
    if (!this.simulatorRunning || !this.touchStartPos) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    console.log(`🔄 Pointer move - x: ${x}, y: ${y}`);

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
    const coordDisplay = document.getElementById("coordinate-display");

    if (!indicator || !overlay) {
      console.error("❌ Touch indicator or overlay not found");
      return;
    }

    // Position the indicator relative to the overlay
    // The indicator should be positioned at the exact tap coordinates
    indicator.style.left = x + "px";
    indicator.style.top = y + "px";
    overlay.style.display = "block";

    // Show coordinate display
    if (coordDisplay) {
      coordDisplay.textContent = `(${Math.round(x)}, ${Math.round(y)})`;
      coordDisplay.style.display = "block";
    }

    console.log(`🔵 Touch indicator shown at: (${x}, ${y})`);
    console.log(
      `🔵 Overlay display: ${overlay.style.display}, size: ${overlay.style.width}x${overlay.style.height}`
    );
    console.log(
      `🔵 Indicator position: left=${indicator.style.left}, top=${indicator.style.top}`
    );
    console.log(
      `🔵 Overlay position: left=${overlay.style.left}, top=${overlay.style.top}`
    );

    // Debug: Check if overlay and canvas are aligned
    const canvasRect = this.canvas.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    console.log(`🔵 Canvas rect: ${canvasRect.left}, ${canvasRect.top}`);
    console.log(`🔵 Overlay rect: ${overlayRect.left}, ${overlayRect.top}`);
    console.log(
      `🔵 Alignment check: Canvas-Overlay offset: (${
        canvasRect.left - overlayRect.left
      }, ${canvasRect.top - overlayRect.top})`
    );
  }

  updateTouchIndicator(x, y) {
    const indicator = document.getElementById("touch-indicator");

    // Update the indicator position using canvas coordinates directly
    indicator.style.left = x + "px";
    indicator.style.top = y + "px";

    console.log(`🔄 Touch indicator updated to: (${x}, ${y})`);
  }

  hideTouchIndicator() {
    const overlay = document.getElementById("touch-overlay");
    const coordDisplay = document.getElementById("coordinate-display");

    if (overlay) overlay.style.display = "none";
    if (coordDisplay) coordDisplay.style.display = "none";
  }

  resizeCanvas() {
    const container = document.getElementById("display-container");
    const containerRect = container.getBoundingClientRect();
    const touchOverlay = document.getElementById("touch-overlay");

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

    // Set canvas dimensions
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.width = width + "px";
    this.canvas.style.height = height + "px";

    // Position canvas in center of container using absolute positioning
    const leftOffset = (containerRect.width - width) / 2;
    const topOffset = (containerRect.height - height) / 2;

    this.canvas.style.position = "absolute";
    this.canvas.style.left = leftOffset + "px";
    this.canvas.style.top = topOffset + "px";
    this.canvas.style.margin = "0"; // Remove margin positioning

    // Position and size the touch overlay to match the canvas exactly
    if (touchOverlay) {
      touchOverlay.style.position = "absolute";
      touchOverlay.style.width = width + "px";
      touchOverlay.style.height = height + "px";
      touchOverlay.style.left = leftOffset + "px";
      touchOverlay.style.top = topOffset + "px";
      touchOverlay.style.pointerEvents = "none"; // Keep overlay non-interactive

      console.log(
        `📐 Canvas resized to: ${width}x${height}, positioned at: (${leftOffset}, ${topOffset})`
      );
      console.log(
        `📐 Touch overlay positioned at: (${leftOffset}, ${topOffset}), size: ${width}x${height}`
      );
    }
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
      console.log("📸 Requesting screenshot...");

      // Add timestamp to prevent caching
      const timestamp = Date.now();
      const response = await fetch(`/api/screenshot?t=${timestamp}`, {
        method: "GET",
        cache: "no-cache",
        headers: {
          "Cache-Control": "no-cache, no-store",
        },
      });

      console.log("📸 Screenshot response status:", response.status);

      if (response.ok) {
        const blob = await response.blob();
        console.log("📸 Screenshot blob received, size:", blob.size);

        if (blob.size === 0) {
          console.error("❌ Empty screenshot blob received");
          return;
        }

        // Create a new image and verify it loads before displaying
        const img = new Image();
        img.onload = () => {
          const imageUrl = URL.createObjectURL(blob);
          this.displayScreenshot(imageUrl);
        };
        img.onerror = (err) => {
          console.error("❌ Failed to load screenshot image:", err);
        };
        img.src = URL.createObjectURL(blob);
      } else {
        console.error(
          "❌ Screenshot request failed:",
          response.status,
          response.statusText
        );
      }
    } catch (error) {
      console.error("❌ Failed to get screenshot:", error);
    }
  }

  displayScreenshot(imageUrl) {
    // Check if canvas and context exist
    if (!this.canvas || !this.ctx) {
      console.error(
        "❌ Cannot display screenshot: canvas or context not available"
      );
      return;
    }

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
    const placeholder = document.getElementById("placeholder");
    const touchOverlay = document.getElementById("touch-overlay");

    if (placeholder) placeholder.style.display = "none";
    if (this.canvas) this.canvas.style.display = "block";
    if (touchOverlay) touchOverlay.style.display = "block";
  }

  hideSimulatorDisplay() {
    const placeholder = document.getElementById("placeholder");
    const touchOverlay = document.getElementById("touch-overlay");

    if (placeholder) placeholder.style.display = "flex";
    if (this.canvas) this.canvas.style.display = "none";
    if (touchOverlay) touchOverlay.style.display = "none";
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

  testTouchIndicator() {
    const canvas = this.canvas;
    if (!canvas) {
      console.error("Canvas not ready for touch indicator test.");
      return;
    }

    // Test coordinates (e.g., center of the canvas)
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    console.log("🧪 Testing touch indicator positioning...");
    console.log(`🧪 Canvas dimensions: ${canvas.width}x${canvas.height}`);
    console.log(`🧪 Test coordinates: (${centerX}, ${centerY})`);

    this.showTouchIndicator(centerX, centerY);

    // Hide after 2 seconds
    setTimeout(() => {
      this.hideTouchIndicator();
      console.log("🧪 Touch indicator test completed.");
    }, 2000);
  }

  // Debug method to show coordinate system
  debugCoordinateSystem() {
    const canvas = this.canvas;
    const overlay = document.getElementById("touch-overlay");

    if (!canvas || !overlay) {
      console.error("❌ Canvas or overlay not available for debugging");
      return;
    }

    const canvasRect = canvas.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();

    console.log("🔍 Coordinate System Debug:");
    console.log(
      `🔍 Canvas: ${canvas.width}x${canvas.height}, pos: (${canvasRect.left}, ${canvasRect.top})`
    );
    console.log(
      `🔍 Overlay: ${overlay.offsetWidth}x${overlay.offsetHeight}, pos: (${overlayRect.left}, ${overlayRect.top})`
    );
    console.log(
      `🔍 Canvas style: left=${canvas.style.left}, top=${canvas.style.top}`
    );
    console.log(
      `🔍 Overlay style: left=${overlay.style.left}, top=${overlay.style.top}`
    );

    // Check if canvas is visible and positioned correctly
    console.log("🔍 Canvas visibility check:");
    console.log(`🔍 Canvas display: ${canvas.style.display}`);
    console.log(`🔍 Canvas visibility: ${canvas.style.visibility}`);
    console.log(`🔍 Canvas opacity: ${canvas.style.opacity}`);
    console.log(`🔍 Canvas z-index: ${canvas.style.zIndex}`);
    console.log(
      `🔍 Canvas rect width/height: ${canvasRect.width}x${canvasRect.height}`
    );
    console.log(
      `🔍 Canvas offset width/height: ${canvas.offsetWidth}x${canvas.offsetHeight}`
    );

    // Check if canvas is in viewport
    const isInViewport =
      canvasRect.top >= 0 &&
      canvasRect.left >= 0 &&
      canvasRect.bottom <=
        (window.innerHeight || document.documentElement.clientHeight) &&
      canvasRect.right <=
        (window.innerWidth || document.documentElement.clientWidth);
    console.log(`🔍 Canvas in viewport: ${isInViewport}`);
  }

  // Test coordinate system with visual grid
  testCoordinateGrid() {
    const canvas = this.canvas;
    if (!canvas) {
      console.error("❌ Canvas not available for grid test");
      return;
    }

    console.log("🔲 Testing coordinate grid...");

    // Test multiple points to verify coordinate system
    const testPoints = [
      { x: 50, y: 50, name: "Top-left" },
      { x: canvas.width / 2, y: 50, name: "Top-center" },
      { x: canvas.width - 50, y: 50, name: "Top-right" },
      { x: 50, y: canvas.height / 2, name: "Left-center" },
      { x: canvas.width / 2, y: canvas.height / 2, name: "Center" },
      { x: canvas.width - 50, y: canvas.height / 2, name: "Right-center" },
      { x: 50, y: canvas.height - 50, name: "Bottom-left" },
      { x: canvas.width / 2, y: canvas.height - 50, name: "Bottom-center" },
      { x: canvas.width - 50, y: canvas.height - 50, name: "Bottom-right" },
    ];

    testPoints.forEach((point, index) => {
      setTimeout(() => {
        console.log(
          `🔲 Testing point ${index + 1}: ${point.name} at (${Math.round(
            point.x
          )}, ${Math.round(point.y)})`
        );
        this.showTouchIndicator(point.x, point.y);

        // Hide after 500ms and move to next point
        setTimeout(() => {
          this.hideTouchIndicator();
        }, 500);
      }, index * 600);
    });
  }

  // Test if canvas is clickable
  testCanvasClickability() {
    const canvas = this.canvas;
    if (!canvas) {
      console.error("❌ Canvas not available for clickability test");
      return;
    }

    console.log("🖱️ Testing canvas clickability...");
    console.log(`🖱️ Canvas dimensions: ${canvas.width}x${canvas.height}`);
    console.log(
      `🖱️ Canvas position: ${canvas.style.left}, ${canvas.style.top}`
    );
    console.log(
      `🖱️ Canvas getBoundingClientRect:`,
      canvas.getBoundingClientRect()
    );

    // Add a temporary click handler to test
    const testClickHandler = (e) => {
      console.log("✅ Canvas click test successful!", e);
      canvas.removeEventListener("click", testClickHandler);
    };

    canvas.addEventListener("click", testClickHandler);

    // Simulate a click after 1 second
    setTimeout(() => {
      console.log("🖱️ Simulating click on canvas...");
      canvas.click();
    }, 1000);
  }

  // Test basic canvas functionality
  testCanvasFunctionality() {
    const canvas = this.canvas;
    if (!canvas) {
      console.error("❌ Canvas not available for functionality test");
      return;
    }

    console.log("🎨 Testing basic canvas functionality...");

    try {
      // Test drawing on canvas
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.error("❌ Could not get canvas context");
        return;
      }

      // Draw a test pattern
      ctx.fillStyle = "red";
      ctx.fillRect(10, 10, 50, 50);
      ctx.fillStyle = "blue";
      ctx.fillRect(70, 10, 50, 50);
      ctx.fillStyle = "green";
      ctx.fillRect(130, 10, 50, 50);

      console.log("✅ Canvas drawing test successful");

      // Test if canvas is visible
      const rect = canvas.getBoundingClientRect();
      console.log(
        `🎨 Canvas rect: ${rect.width}x${rect.height} at (${rect.left}, ${rect.top})`
      );
      console.log(`🎨 Canvas computed style:`, window.getComputedStyle(canvas));
    } catch (error) {
      console.error("❌ Canvas functionality test failed:", error);
    }
  }

  // Check viewport positioning
  checkViewportPositioning() {
    const canvas = this.canvas;
    if (!canvas) {
      console.error("❌ Canvas not available for viewport check");
      return;
    }

    console.log("🌍 Checking viewport positioning...");

    const canvasRect = canvas.getBoundingClientRect();
    const viewportWidth =
      window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight;

    console.log(`🌍 Viewport dimensions: ${viewportWidth}x${viewportHeight}`);
    console.log(
      `🌍 Canvas rect: ${canvasRect.width}x${canvasRect.height} at (${canvasRect.left}, ${canvasRect.top})`
    );
    console.log(
      `🌍 Canvas right: ${canvasRect.right}, bottom: ${canvasRect.bottom}`
    );

    // Check if canvas is in viewport
    const isInViewport =
      canvasRect.top >= 0 &&
      canvasRect.left >= 0 &&
      canvasRect.bottom <= viewportHeight &&
      canvasRect.right <= viewportWidth;

    console.log(`🌍 Canvas in viewport: ${isInViewport}`);

    if (!isInViewport) {
      console.warn(
        "⚠️ Canvas is outside viewport - this could cause click issues"
      );

      // Check which edges are outside
      if (canvasRect.top < 0)
        console.warn(`⚠️ Canvas top edge outside viewport: ${canvasRect.top}`);
      if (canvasRect.left < 0)
        console.warn(
          `⚠️ Canvas left edge outside viewport: ${canvasRect.left}`
        );
      if (canvasRect.bottom > viewportHeight)
        console.warn(
          `⚠️ Canvas bottom edge outside viewport: ${canvasRect.bottom}`
        );
      if (canvasRect.right > viewportWidth)
        console.warn(
          `⚠️ Canvas right edge outside viewport: ${canvasRect.right}`
        );
    }

    // Check if canvas has zero dimensions
    if (canvasRect.width === 0 || canvasRect.height === 0) {
      console.error("❌ Canvas has zero dimensions - this will prevent clicks");
    }
  }

  // Test alignment between canvas and touch overlay
  testCanvasOverlayAlignment() {
    const canvas = this.canvas;
    const overlay = document.getElementById("touch-overlay");

    if (!canvas || !overlay) {
      console.error("❌ Canvas or overlay not available for alignment test");
      return;
    }

    console.log("🔍 Testing canvas-overlay alignment...");

    const canvasRect = canvas.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();

    console.log(
      `🔍 Canvas rect: ${canvasRect.left}, ${canvasRect.top}, ${canvasRect.width}x${canvasRect.height}`
    );
    console.log(
      `🔍 Overlay rect: ${overlayRect.left}, ${overlayRect.top}, ${overlayRect.width}x${overlayRect.height}`
    );

    // Check alignment
    const offsetX = Math.abs(canvasRect.left - overlayRect.left);
    const offsetY = Math.abs(canvasRect.top - overlayRect.top);
    const sizeDiffX = Math.abs(canvasRect.width - overlayRect.width);
    const sizeDiffY = Math.abs(canvasRect.height - overlayRect.height);

    console.log(`🔍 Position offset: (${offsetX}, ${offsetY})`);
    console.log(`🔍 Size difference: (${sizeDiffX}, ${sizeDiffY})`);

    if (offsetX > 1 || offsetY > 1) {
      console.warn("⚠️ Canvas and overlay are not properly aligned!");
    } else {
      console.log("✅ Canvas and overlay are properly aligned");
    }

    if (sizeDiffX > 1 || sizeDiffY > 1) {
      console.warn("⚠️ Canvas and overlay have different sizes!");
    } else {
      console.log("✅ Canvas and overlay have matching sizes");
    }
  }

  // Draw a visual crosshair on the canvas at tap location
  drawTapCrosshair(x, y) {
    const canvas = this.canvas;
    if (!canvas || !this.ctx) {
      console.error("❌ Canvas or context not available for crosshair");
      return;
    }

    console.log(`🎯 Drawing crosshair at (${x}, ${y})`);

    // Save current context state
    this.ctx.save();

    // Draw crosshair
    this.ctx.strokeStyle = "red";
    this.ctx.lineWidth = 2;

    // Horizontal line
    this.ctx.beginPath();
    this.ctx.moveTo(x - 10, y);
    this.ctx.lineTo(x + 10, y);
    this.ctx.stroke();

    // Vertical line
    this.ctx.beginPath();
    this.ctx.moveTo(x, y - 10);
    this.ctx.lineTo(x, y + 10);
    this.ctx.stroke();

    // Circle at center
    this.ctx.beginPath();
    this.ctx.arc(x, y, 3, 0, 2 * Math.PI);
    this.ctx.fillStyle = "red";
    this.ctx.fill();

    // Restore context state
    this.ctx.restore();

    console.log("✅ Crosshair drawn successfully");
  }

  // WebRTC Methods
  async handleWebRTCSignal(data) {
    try {
      if (this.webrtcPeer) {
        this.webrtcPeer.signal(data);
      }
    } catch (error) {
      console.error("Error handling WebRTC signal:", error);
    }
  }

  handleWebRTCConnected() {
    console.log("🌐 WebRTC connection established");
    this.streamingMode = "webrtc";
    this.updateStreamStatus("webrtc-connected");
  }

  handleWebRTCStream(data) {
    try {
      console.log("📹 Handling WebRTC stream:", data);
      // When we receive a WebRTC stream, we'll display it
      // For now, this is a placeholder for when testing on real iOS device
      this.showWebRTCStream();
    } catch (error) {
      console.error("Error handling WebRTC stream:", error);
    }
  }

  showWebRTCStream() {
    // This will be implemented when testing on real iOS device
    console.log("🌐 WebRTC stream display placeholder");
    // The actual implementation would:
    // 1. Get the video element
    // 2. Set the WebRTC stream as the source
    // 3. Hide canvas, show video
  }

  handleStreamingModeChange(data) {
    if (data.success) {
      this.streamingMode = data.mode;
      console.log(`🔄 Streaming mode changed to: ${this.streamingMode}`);

      // Update UI to reflect current mode
      this.updateStreamingModeUI();

      if (this.streamingMode === "webrtc") {
        this.updateStreamStatus("webrtc-ready");
        this.showMessage(`Streaming mode: ${data.modes[data.mode].name}`);
      } else {
        this.updateStreamStatus("screenshot-mode");
        this.showMessage(`Streaming mode: ${data.modes[data.mode].name}`);
      }
    }
  }

  updateStreamingModeUI() {
    const screenshotBtn = document.getElementById("enable-screenshot-mode");
    const webrtcBtn = document.getElementById("enable-webrtc-mode");
    const modeInfo = document.getElementById("current-mode-info");

    if (screenshotBtn && webrtcBtn && modeInfo) {
      if (this.streamingMode === "screenshot") {
        screenshotBtn.classList.add("active");
        webrtcBtn.classList.remove("active");
        modeInfo.textContent =
          "Current: Screenshot Mode (for simulator testing)";
      } else {
        webrtcBtn.classList.add("active");
        screenshotBtn.classList.remove("active");
        modeInfo.textContent = "Current: WebRTC Mode (for real iOS device)";
      }
    }
  }

  // Initialize streaming status and UI with WebRTC as default
  async initializeStreamingStatus() {
    try {
      const status = await this.getStreamingStatus();
      if (status) {
        this.updateStreamingModeUI();
      } else {
        // If no status from server, default to WebRTC mode
        this.streamingMode = "webrtc";
        this.updateStreamingModeUI();
      }
    } catch (error) {
      console.error("Error initializing streaming status:", error);
      // Default to WebRTC mode on error
      this.streamingMode = "webrtc";
      this.updateStreamingModeUI();
    }
  }

  // Method to enable WebRTC mode (for testing on real iOS device)
  async enableWebRTCMode() {
    try {
      this.socket.emit("enable-webrtc-mode");
    } catch (error) {
      this.showError("Failed to enable WebRTC mode: " + error.message);
    }
  }

  // Method to enable screenshot mode (for simulator testing)
  async enableScreenshotMode() {
    try {
      this.socket.emit("enable-screenshot-mode");
    } catch (error) {
      this.showError("Failed to enable screenshot mode: " + error.message);
    }
  }

  // Get streaming status from server
  async getStreamingStatus() {
    try {
      const response = await fetch("/api/streaming-status");
      const data = await response.json();

      if (data.status === "success") {
        this.streamingMode = data.currentMode;
        console.log("📊 Streaming status:", data);
        return data;
      }
    } catch (error) {
      console.error("Error getting streaming status:", error);
    }
  }

  // Initialize streaming status and UI
  async initializeStreamingStatus() {
    try {
      const status = await this.getStreamingStatus();
      if (status) {
        this.updateStreamingModeUI();
      }
    } catch (error) {
      console.error("Error initializing streaming status:", error);
    }
  }

  // Show informational message
  showMessage(message) {
    console.log("ℹ️", message);
    // You could implement a toast notification here
  }
}

// Initialize the application when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Wait for all resources to load
  window.addEventListener("load", () => {
    // Add a small delay to ensure all elements are properly rendered
    setTimeout(() => {
      new IOSRemoteApp();
    }, 200);
  });
});
