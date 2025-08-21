const { spawn, exec } = require("child_process");
const { promisify } = require("util");
const fs = require("fs").promises;
const path = require("path");

const execAsync = promisify(exec);

class SimctlManager {
  constructor() {
    this.currentSimulator = null;
    this.simulators = [];
  }

  /**
   * List all available simulators
   */
  async listSimulators() {
    try {
      const { stdout } = await execAsync("xcrun simctl list devices available");
      const lines = stdout.split("\n");
      const simulators = [];

      for (const line of lines) {
        if (line.includes("iPhone") || line.includes("iPad")) {
          const match = line.match(/([A-F0-9-]+)\s+\(([^)]+)\)\s+\(([^)]+)\)/);
          if (match) {
            simulators.push({
              id: match[1].trim(),
              name: match[2].trim(),
              runtime: match[3].trim(),
              state: "unknown",
            });
          }
        }
      }

      // Get state for each simulator
      for (const simulator of simulators) {
        try {
          const { stdout: stateOutput } = await execAsync(
            `xcrun simctl list devices | grep "${simulator.id}"`
          );
          if (stateOutput.includes("Booted")) {
            simulator.state = "booted";
            this.currentSimulator = simulator;
          } else if (stateOutput.includes("Shutdown")) {
            simulator.state = "shutdown";
          }
        } catch (error) {
          simulator.state = "unknown";
        }
      }

      this.simulators = simulators;
      return simulators;
    } catch (error) {
      console.error("Error listing simulators:", error);
      throw new Error(`Failed to list simulators: ${error.message}`);
    }
  }

  /**
   * Start a simulator
   */
  async startSimulator(deviceId = null) {
    try {
      let targetDevice = deviceId;

      if (!targetDevice) {
        // Use first available iPhone simulator if none specified
        const availableSims = this.simulators.filter((s) =>
          s.name.includes("iPhone")
        );
        if (availableSims.length > 0) {
          targetDevice = availableSims[0].id;
        } else {
          throw new Error("No iPhone simulators available");
        }
      }

      console.log(`Starting simulator: ${targetDevice}`);
      await execAsync(`xcrun simctl boot "${targetDevice}"`);

      // Wait a bit for simulator to fully boot
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Open simulator app
      await execAsync("open -a Simulator");

      this.currentSimulator = this.simulators.find(
        (s) => s.id === targetDevice
      );
      return { success: true, deviceId: targetDevice };
    } catch (error) {
      console.error("Error starting simulator:", error);
      throw new Error(`Failed to start simulator: ${error.message}`);
    }
  }

  /**
   * Stop the current simulator
   */
  async stopSimulator() {
    try {
      if (!this.currentSimulator) {
        throw new Error("No simulator currently running");
      }

      console.log(`Stopping simulator: ${this.currentSimulator.id}`);
      await execAsync(`xcrun simctl shutdown "${this.currentSimulator.id}"`);

      this.currentSimulator = null;
      return { success: true };
    } catch (error) {
      console.error("Error stopping simulator:", error);
      throw new Error(`Failed to stop simulator: ${error.message}`);
    }
  }

  /**
   * Take a screenshot of the current simulator
   */
  async takeScreenshot() {
    try {
      if (!this.currentSimulator) {
        throw new Error("No simulator currently running");
      }

      const timestamp = Date.now();
      const screenshotPath = path.join(
        process.cwd(),
        "temp",
        `screenshot_${timestamp}.png`
      );

      // Ensure temp directory exists
      await fs.mkdir(path.dirname(screenshotPath), { recursive: true });

      console.log(`Taking screenshot: ${screenshotPath}`);
      await execAsync(
        `xcrun simctl io "${this.currentSimulator.id}" screenshot "${screenshotPath}"`
      );

      // Read the screenshot file
      const screenshot = await fs.readFile(screenshotPath);

      // Clean up temp file
      await fs.unlink(screenshotPath);

      return screenshot;
    } catch (error) {
      console.error("Error taking screenshot:", error);
      throw new Error(`Failed to take screenshot: ${error.message}`);
    }
  }

  /**
   * Get simulator info
   */
  async getSimulatorInfo(deviceId) {
    try {
      const { stdout } = await execAsync(
        `xcrun simctl list devices | grep "${deviceId}"`
      );
      return stdout.trim();
    } catch (error) {
      console.error("Error getting simulator info:", error);
      throw new Error(`Failed to get simulator info: ${error.message}`);
    }
  }

  /**
   * Install app on simulator
   */
  async installApp(appPath, deviceId = null) {
    try {
      const targetDevice =
        deviceId || (this.currentSimulator ? this.currentSimulator.id : null);
      if (!targetDevice) {
        throw new Error("No target device specified");
      }

      console.log(`Installing app on simulator: ${targetDevice}`);
      await execAsync(`xcrun simctl install "${targetDevice}" "${appPath}"`);

      return { success: true, deviceId: targetDevice };
    } catch (error) {
      console.error("Error installing app:", error);
      throw new Error(`Failed to install app: ${error.message}`);
    }
  }

  /**
   * Launch app on simulator
   */
  async launchApp(bundleId, deviceId = null) {
    try {
      const targetDevice =
        deviceId || (this.currentSimulator ? this.currentSimulator.id : null);
      if (!targetDevice) {
        throw new Error("No target device specified");
      }

      console.log(`Launching app on simulator: ${targetDevice}`);
      await execAsync(`xcrun simctl launch "${targetDevice}" "${bundleId}"`);

      return { success: true, deviceId: targetDevice, bundleId };
    } catch (error) {
      console.error("Error launching app:", error);
      throw new Error(`Failed to launch app: ${error.message}`);
    }
  }
}

module.exports = SimctlManager;
