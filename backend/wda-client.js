const { spawn } = require("child_process");
const path = require("path");

class WDAClient {
  constructor() {
    this.isConnected = false;
    this.currentDevice = null;
    this.devices = [];
  }

  /**
   * Check if Xcode and iOS tools are available
   */
  async checkXcode() {
    try {
      const result = await this.runCommand(["version"]);

      if (result && result.trim()) {
        console.log("✅ Xcode is available:", result.trim());
        return true;
      } else {
        console.log("✅ Xcode is available");
        return true;
      }
    } catch (error) {
      console.error("❌ Xcode is not available:", error.message);
      console.error(
        "💡 Install Xcode from the Mac App Store or developer.apple.com"
      );
      return false;
    }
  }

  /**
   * List available iOS devices/simulators
   */
  async listDevices() {
    try {
      const result = await this.runCommand(["list-targets"]);

      // Parse xcrun simctl output
      const lines = result.trim().split("\n");

      this.devices = [];
      let currentOS = "";

      lines.forEach((line) => {
        line = line.trim();

        // Check for OS version headers like "-- iOS 17.0 --"
        if (
          line.startsWith("--") &&
          line.includes("iOS") &&
          line.endsWith("--")
        ) {
          currentOS = line.replace(/--\s*|\s*--/g, "").trim();
          return;
        }

        // Parse device lines like "iPhone 15 (57760A2B-C165-415B-8512-1E8158B3065B) (Shutdown)"
        if (
          line.includes("(") &&
          line.includes(")") &&
          !line.startsWith("==")
        ) {
          const match = line.match(/^(.+?)\s+\(([^)]+)\)\s+\(([^)]+)\)$/);
          if (match) {
            const [, name, udid, status] = match;
            this.devices.push({
              id: udid.trim(),
              name: name.trim(),
              type: "Simulator",
              status: status.trim(),
              os: currentOS,
            });
          }
        }
      });

      console.log(
        `📱 Found ${this.devices.length} iOS simulators:`,
        this.devices
      );
      return this.devices;
    } catch (error) {
      console.error("❌ Error listing devices:", error.message);
      return [];
    }
  }

  /**
   * Connect to a specific device/simulator
   */
  async connectToDevice(deviceId = null) {
    try {
      if (!deviceId) {
        // Auto-select first available simulator
        const devices = await this.listDevices();
        const simulator = devices.find(
          (d) => d.type === "Simulator" && d.status === "Booted"
        );

        if (!simulator) {
          // Try to boot the first available simulator
          const firstSim = devices.find((d) => d.type === "Simulator");
          if (firstSim) {
            console.log(
              `🚀 Booting simulator: ${firstSim.name} (${firstSim.id})`
            );
            await this.runCommand(["boot", firstSim.id]);
            deviceId = firstSim.id;
          } else {
            throw new Error(
              "No iOS simulator found. Please start a simulator first."
            );
          }
        } else {
          deviceId = simulator.id;
          console.log(
            `🔗 Auto-selected simulator: ${simulator.name} (${deviceId})`
          );
        }
      }

      // Test connection to the device by checking its status
      const result = await this.runCommand(["list-targets"]);
      const deviceLine = result
        .split("\n")
        .find((line) => line.includes(deviceId));

      if (deviceLine && deviceLine.includes("Booted")) {
        this.currentDevice = deviceId;
        this.isConnected = true;
        console.log(`✅ Connected to device: ${deviceId}`);
        return deviceId;
      } else {
        throw new Error(`Device ${deviceId} is not booted`);
      }
    } catch (error) {
      console.error("❌ Error connecting to device:", error.message);
      this.isConnected = false;
      this.currentDevice = null;
      throw error;
    }
  }

  /**
   * Tap at specific coordinates
   */
  async tap(x, y) {
    try {
      if (!this.isConnected || !this.currentDevice) {
        await this.connectToDevice();
      }

      console.log(`👆 Tapping at (${x}, ${y}) on device ${this.currentDevice}`);

      // Use a simpler approach with simctl tap command
      const { execSync } = require("child_process");

      try {
        // Try multiple approaches for tap without device validation
        let success = false;
        let lastError = null;

        // Try 1: WebDriverAgent (WDA) - most reliable method
        try {
          // Check if WDA is available
          const wdaCheck = execSync(`xcrun devicectl list devices`, {
            encoding: "utf8",
          });
          if (wdaCheck.includes(this.currentDevice)) {
            // Use WDA for touch events
            execSync(
              `xcrun devicectl device ${
                this.currentDevice
              } send-input touch --x ${Math.round(x)} --y ${Math.round(y)}`
            );
            success = true;
          } else {
            throw new Error("WDA not available for this device");
          }
        } catch (error) {
          console.log("⚠️ WDA failed:", error.message);
          lastError = error;
        }

        // Try 2: Use xcrun simctl with UI automation
        if (!success) {
          try {
            // Try using simctl with UI automation commands
            execSync(
              `xcrun simctl ui ${this.currentDevice} tap ${Math.round(
                x
              )} ${Math.round(y)}`
            );
            success = true;
          } catch (error) {
            console.log("⚠️ simctl ui tap failed:", error.message);
            lastError = error;
          }
        }

        // Try 3: Use AppleScript with proper coordinate mapping
        if (!success) {
          try {
            // Use a more direct approach - map web coordinates to Simulator coordinates
            const script = `
              tell application "System Events"
                tell process "Simulator"
                  -- Get the Simulator window info
                  set windowList to windows
                  set windowCount to count of windowList
                  
                  if windowCount > 0 then
                    set firstWindow to item 1 of windowList
                    set windowPos to position of firstWindow
                    set windowSize to size of firstWindow
                    
                    -- Web interface dimensions (your frontend canvas)
                    set webWidth to 315
                    set webHeight to 560
                    
                    -- Simulator content area (typical iPhone simulator dimensions)
                    -- The simulator window has borders and UI elements, so we need to account for that
                    set simContentWidth to (item 1 of windowSize) - 40  -- Account for window borders
                    set simContentHeight to (item 2 of windowSize) - 80  -- Account for title bar and bottom UI
                    
                    -- Calculate the content area position (center of window)
                    set contentStartX to (item 1 of windowPos) + 20  -- Left border offset
                    set contentStartY to (item 2 of windowPos) + 40  -- Top border offset
                    
                    -- Map web coordinates to simulator coordinates
                    -- This maps (0,0) in web to (contentStartX, contentStartY) in simulator
                    -- And maps (315,560) in web to (contentStartX + simContentWidth, contentStartY + simContentHeight)
                    set scaleX to (simContentWidth / webWidth)
                    set scaleY to (simContentHeight / webHeight)
                    
                    set adjustedX to contentStartX + (${Math.round(x)} * scaleX)
                    set adjustedY to contentStartY + (${Math.round(y)} * scaleY)
                    
                    -- Log the coordinate transformation for debugging
                    log "Web coordinates: (${Math.round(x)}, ${Math.round(y)})"
                    log "Window position: " & windowPos
                    log "Window size: " & windowSize
                    log "Content area: " & simContentWidth & "x" & simContentHeight
                    log "Content start: (" & contentStartX & ", " & contentStartY & ")"
                    log "Scale factors: (" & scaleX & ", " & scaleY & ")"
                    log "Final coordinates: (" & adjustedX & ", " & adjustedY & ")"
                    
                    -- Click at the calculated coordinates
                    click at {adjustedX, adjustedY}
                  else
                    log "No Simulator windows found"
                    error "No Simulator windows available"
                  end if
                end tell
              end tell
            `;
            execSync(`osascript -e '${script}'`);
            success = true;
          } catch (error) {
            console.log(
              "⚠️ AppleScript with coordinate scaling failed:",
              error.message
            );
            lastError = error;
          }
        }

        // Try 4: Enhanced debug AppleScript with coordinate testing
        if (!success) {
          try {
            const script = `
              tell application "System Events"
                tell process "Simulator"
                  -- Enhanced debugging: Get detailed window info
                  set windowList to windows
                  set windowCount to count of windowList
                  log "🔍 Found " & windowCount & " Simulator windows"
                  
                  if windowCount > 0 then
                    set firstWindow to item 1 of windowList
                    set windowPos to position of firstWindow
                    set windowSize to size of firstWindow
                    
                    log "📍 Window position: " & windowPos
                    log "📏 Window size: " & windowSize
                    
                    -- Test click at different coordinate systems
                    log "🧪 Testing coordinate systems..."
                    
                    -- Test 1: Raw coordinates (likely wrong)
                    log "🧪 Test 1: Raw coordinates (${Math.round(
                      x
                    )}, ${Math.round(y)})"
                    click at {${Math.round(x)}, ${Math.round(y)}}
                    
                    delay 0.5
                    
                    -- Test 2: Window-relative coordinates
                    set testX to (item 1 of windowPos) + ${Math.round(x)}
                    set testY to (item 2 of windowPos) + ${Math.round(y)}
                    log "🧪 Test 2: Window-relative (" & testX & ", " & testY & ")"
                    click at {testX, testY}
                    
                    delay 0.5
                    
                    -- Test 3: Center of window (should be safe)
                    set centerX to (item 1 of windowPos) + ((item 1 of windowSize) / 2)
                    set centerY to (item 2 of windowPos) + ((item 2 of windowSize) / 2)
                    log "🧪 Test 3: Center of window (" & centerX & ", " & centerY & ")"
                    click at {centerX, centerY}
                    
                  else
                    log "❌ No Simulator windows found"
                    error "No Simulator windows available"
                  end if
                end tell
              end tell
            `;
            execSync(`osascript -e '${script}'`);
            success = true;
          } catch (error) {
            console.log("⚠️ Enhanced debug AppleScript failed:", error.message);
            lastError = error;
          }
        }

        if (success) {
          console.log(`✅ Tap successful at (${x}, ${y})`);
          return { success: true, x, y, device: this.currentDevice };
        } else {
          throw new Error(
            `Failed to tap at (${x}, ${y}): ${
              lastError?.message || "All methods failed"
            }`
          );
        }
      } catch (execError) {
        console.error("❌ Tap failed:", execError.message);
        throw new Error(`Failed to tap at (${x}, ${y}): ${execError.message}`);
      }
    } catch (error) {
      console.error("❌ Tap failed:", error.message);
      throw new Error(`Failed to tap at (${x}, ${y}): ${error.message}`);
    }
  }

  /**
   * Swipe from start to end coordinates
   */
  async swipe(startX, startY, endX, endY, duration = 1000) {
    try {
      if (!this.isConnected || !this.currentDevice) {
        await this.connectToDevice();
      }

      console.log(
        `👆 Swiping from (${startX}, ${startY}) to (${endX}, ${endY}) on device ${this.currentDevice}`
      );

      // Use a simpler approach with simctl swipe command
      const { execSync } = require("child_process");

      try {
        // Calculate duration in seconds
        const durationInSeconds = Math.max(0.1, duration / 1000);

        // Try multiple approaches for swipe
        let success = false;
        let lastError = null;

        // Try 1: WebDriverAgent (WDA) - most reliable method
        try {
          // Check if WDA is available
          const wdaCheck = execSync(`xcrun devicectl list devices`, {
            encoding: "utf8",
          });
          if (wdaCheck.includes(this.currentDevice)) {
            // Use WDA for swipe events
            execSync(
              `xcrun devicectl device ${
                this.currentDevice
              } send-input swipe --start-x ${Math.round(
                startX
              )} --start-y ${Math.round(startY)} --end-x ${Math.round(
                endX
              )} --end-y ${Math.round(endY)}`
            );
            success = true;
          } else {
            throw new Error("WDA not available for this device");
          }
        } catch (error) {
          console.log("⚠️ WDA swipe failed:", error.message);
          lastError = error;
        }

        // Try 2: Use AppleScript as fallback
        if (!success) {
          try {
            const script = `
              tell application "System Events"
                tell process "Simulator"
                  -- Simple approach: click start and end points
                  click at {${Math.round(startX)}, ${Math.round(startY)}}
                  delay 0.2
                  click at {${Math.round(endX)}, ${Math.round(endY)}}
                end tell
              end tell
            `;
            execSync(`osascript -e '${script}'`);
            success = true;
          } catch (error) {
            console.log("⚠️ AppleScript swipe failed:", error.message);
            lastError = error;
          }
        }

        if (!success) {
          throw new Error(
            `Swipe failed: ${lastError?.message || "All methods failed"}`
          );
        }

        console.log(
          `✅ Swipe successful from (${startX}, ${startY}) to (${endX}, ${endY})`
        );
        return {
          success: true,
          startX,
          startY,
          endX,
          endY,
          duration,
          device: this.currentDevice,
        };
      } catch (execError) {
        console.error("❌ Swipe command failed:", execError.message);

        // Fallback to AppleScript if available
        try {
          // Use AppleScript as ultimate fallback
          const script = `
            tell application "System Events"
              tell process "Simulator"
                set dragStartX to ${Math.round(startX)}
                set dragStartY to ${Math.round(startY)}
                set dragEndX to ${Math.round(endX)}
                set dragEndY to ${Math.round(endY)}


                mousedown at {dragStartX, dragStartY}
                delay 0.1
                mousemove to {dragEndX, dragEndY}
                delay 0.1
                mouseup at {dragEndX, dragEndY}
              end tell
            end tell
          `;
          execSync(`osascript -e '${script}'`);
          console.log(
            `✅ Swipe successful (AppleScript method) from (${startX}, ${startY}) to (${endX}, ${endY})`
          );
          return {
            success: true,
            startX,
            startY,
            endX,
            endY,
            duration,
            device: this.currentDevice,
          };
        } catch (fallbackError) {
          console.error("❌ Fallback swipe failed:", fallbackError.message);
          throw new Error(
            `Failed to swipe from (${startX}, ${startY}) to (${endX}, ${endY}): ${fallbackError.message}`
          );
        }
      }
    } catch (error) {
      console.error("❌ Swipe failed:", error.message);
      throw new Error(
        `Failed to swipe from (${startX}, ${startY}) to (${endX}, ${endY}): ${error.message}`
      );
    }
  }

  /**
   * Send keyboard input
   */
  async sendKeys(text) {
    try {
      if (!this.isConnected || !this.currentDevice) {
        await this.connectToDevice();
      }

      console.log(`⌨️ Sending keys: "${text}" to device ${this.currentDevice}`);

      // Use xcrun simctl keyboard command
      const { execSync } = require("child_process");
      execSync(`xcrun simctl keyboard ${this.currentDevice} type "${text}"`);

      console.log(`✅ Keys sent successfully: "${text}"`);
      return { success: true, text, device: this.currentDevice };
    } catch (error) {
      console.error("❌ Send keys failed:", error.message);
      throw new Error(`Failed to send keys "${text}": ${error.message}`);
    }
  }

  /**
   * Take a screenshot
   */
  async takeScreenshot(outputPath = null) {
    try {
      if (!this.isConnected || !this.currentDevice) {
        await this.connectToDevice();
      }

      const filename = outputPath || `screenshot_${Date.now()}.png`;
      console.log(
        `📸 Taking screenshot on device ${this.currentDevice} -> ${filename}`
      );

      // Use xcrun simctl io command for screenshots
      const result = await this.runCommand([
        "screenshot",
        this.currentDevice,
        filename,
      ]);

      console.log(`✅ Screenshot saved: ${filename}`);
      return { success: true, filename, device: this.currentDevice };
    } catch (error) {
      console.error("❌ Screenshot failed:", error.message);
      throw new Error(`Failed to take screenshot: ${error.message}`);
    }
  }

  /**
   * Get device info
   */
  async getDeviceInfo() {
    try {
      if (!this.isConnected || !this.currentDevice) {
        await this.connectToDevice();
      }

      console.log(`📱 Getting device info for ${this.currentDevice}`);

      // Get device status and details
      const result = await this.runCommand(["list-targets"]);
      const deviceLine = result
        .split("\n")
        .find((line) => line.includes(this.currentDevice));

      // Get device properties
      const properties = await this.runCommand([
        "getenv",
        this.currentDevice,
        "SIMULATOR_DEVICE_NAME",
      ]);

      return {
        deviceId: this.currentDevice,
        status: deviceLine
          ? deviceLine.includes("Booted")
            ? "Booted"
            : "Shutdown"
          : "Unknown",
        properties: properties.trim(),
        isConnected: this.isConnected,
      };
    } catch (error) {
      console.error("❌ Get device info failed:", error.message);
      throw new Error(`Failed to get device info: ${error.message}`);
    }
  }

  /**
   * Run iOS device command and return result
   */
  runCommand(args) {
    return new Promise((resolve, reject) => {
      // Use xcrun commands for iOS device management
      let command, commandArgs;

      if (args[0] === "list-targets") {
        // List iOS simulators and devices
        command = "xcrun";
        commandArgs = ["simctl", "list", "devices", "available"];
      } else if (args[0] === "list-devices") {
        // List physical iOS devices
        command = "xcrun";
        commandArgs = ["devicectl", "list", "devices"];
      } else if (args[0] === "version") {
        // Get Xcode version
        command = "xcodebuild";
        commandArgs = ["-version"];
      } else if (args[0] === "boot") {
        // Boot a simulator
        command = "xcrun";
        commandArgs = ["simctl", "boot", args[1]];
      } else if (args[0] === "getenv") {
        // Get simulator environment variable
        command = "xcrun";
        commandArgs = ["simctl", "getenv", args[1], args[2]];
        // UI and keyboard commands now use AppleScript directly
      } else if (args[0] === "screenshot") {
        // Take screenshot using simctl
        command = "xcrun";
        commandArgs = ["simctl", "io", args[1], "screenshot", args[2]];
      } else {
        // Default to simctl list
        command = "xcrun";
        commandArgs = ["simctl", "list"];
      }

      const child = spawn(command, commandArgs, {
        stdio: ["pipe", "pipe", "pipe"],
        shell: false,
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(
            new Error(
              `iOS command failed (${code}): ${stderr || "Unknown error"}`
            )
          );
        }
      });

      child.on("error", (error) => {
        reject(new Error(`Failed to execute iOS command: ${error.message}`));
      });
    });
  }
  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      currentDevice: this.currentDevice,
      devices: this.devices,
      hasDevices: this.devices.length > 0,
    };
  }

  /**
   * Debug coordinate system by getting Simulator window info
   */
  async debugCoordinateSystem() {
    try {
      const { execSync } = require("child_process");
      const script = `
        tell application "System Events"
          tell process "Simulator"
            set windowList to windows
            set windowCount to count of windowList
            
            if windowCount > 0 then
              set firstWindow to item 1 of windowList
              set windowPos to position of firstWindow
              set windowSize to size of firstWindow
              
              return "Window Count: " & windowCount & " | Position: " & windowPos & " | Size: " & windowSize
            else
              return "No Simulator windows found"
            end if
          end tell
        end tell
      `;

      const result = execSync(`osascript -e '${script}'`, { encoding: "utf8" });
      console.log("🔍 Coordinate System Debug:", result.trim());
      return result.trim();
    } catch (error) {
      console.error("❌ Coordinate system debug failed:", error.message);
      throw error;
    }
  }

  /**
   * Disconnect from current device
   */
  async disconnect() {
    this.isConnected = false;
    this.currentDevice = null;
    console.log("🔌 Disconnected from device");
  }
}

module.exports = WDAClient;
