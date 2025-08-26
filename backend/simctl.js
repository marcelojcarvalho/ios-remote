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
      // First get all devices (including booted ones)
      const { stdout } = await execAsync("xcrun simctl list devices");
      console.log("Raw simctl output:");
      console.log(stdout);

      const lines = stdout.split("\n");
      const simulators = [];

      for (const line of lines) {
        if (line.includes("iPhone") || line.includes("iPad")) {
          console.log(`Processing line: "${line}"`);

          // Updated regex to correctly parse: "Device Name (UUID) (State)"
          const match = line.match(
            /^\s+([^(]+)\s+\(([A-F0-9-]+)\)\s+\(([^)]+)\)/
          );

          if (match) {
            const deviceName = match[1].trim();
            const deviceId = match[2].trim();
            const deviceState = match[3].trim();

            console.log(
              `✅ Matched: Name="${deviceName}", ID="${deviceId}", State="${deviceState}"`
            );

            simulators.push({
              id: deviceId,
              name: deviceName,
              runtime: "iOS", // We'll get the actual runtime from the section header
              state: deviceState.toLowerCase(),
            });
          } else {
            console.log(`❌ No match for line: "${line}"`);
          }
        }
      }

      // State is already parsed from the line, just set currentSimulator if booted
      for (const simulator of simulators) {
        if (simulator.state === "booted") {
          this.currentSimulator = simulator;
          console.log(
            `🎯 Set current simulator: ${simulator.name} (${simulator.id})`
          );
        }
      }

      this.simulators = simulators;

      // Debug logging
      console.log(`📱 Found ${simulators.length} simulators:`);
      simulators.forEach((sim) => {
        console.log(`  - ${sim.name} (${sim.id}): ${sim.state}`);
      });

      // Check for booted simulators specifically
      const bootedCount = simulators.filter((s) => s.state === "booted").length;
      console.log(`🔍 Booted simulators: ${bootedCount}`);

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
        // First check if there's already a booted simulator
        const bootedSims = this.simulators.filter(
          (s) => s.state === "booted" && s.name.includes("iPhone")
        );

        if (bootedSims.length > 0) {
          console.log(`Found booted simulator: ${bootedSims[0].name}`);
          this.currentSimulator = bootedSims[0];
          return {
            success: true,
            deviceId: bootedSims[0].id,
            alreadyRunning: true,
          };
        }

        // If no booted simulator, check for any iPhone simulators (including shutdown ones)
        const anyIPhoneSims = this.simulators.filter((s) =>
          s.name.includes("iPhone")
        );

        if (anyIPhoneSims.length > 0) {
          targetDevice = anyIPhoneSims[0].id;
          console.log(
            `Using iPhone simulator: ${anyIPhoneSims[0].name} (${anyIPhoneSims[0].state})`
          );
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
   * Refresh simulator list and find booted ones
   */
  async refreshSimulators() {
    try {
      console.log("🔄 Refreshing simulator list...");
      await this.listSimulators();

      // Find currently booted simulator
      const bootedSim = this.simulators.find((s) => s.state === "booted");
      if (bootedSim) {
        this.currentSimulator = bootedSim;
        console.log(
          `✅ Found booted simulator: ${bootedSim.name} (${bootedSim.id})`
        );
        return bootedSim;
      } else {
        console.log("ℹ️ No booted simulator found");
      }

      return null;
    } catch (error) {
      console.error("❌ Error refreshing simulators:", error);
      throw error;
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
