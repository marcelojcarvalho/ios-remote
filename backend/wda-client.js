const axios = require("axios");

class WDAClient {
  constructor() {
    this.baseURL = "http://localhost:8100"; // Default WDA port
    this.sessionId = null;
    this.isConnected = false;
  }

  /**
   * Initialize connection to WebDriverAgent
   */
  async connect() {
    try {
      // Check if WDA is running
      const response = await axios.get(`${this.baseURL}/status`);

      if (response.data.status === 0) {
        this.isConnected = true;
        console.log("✅ WebDriverAgent is running");
        return true;
      } else {
        throw new Error("WebDriverAgent not ready");
      }
    } catch (error) {
      console.warn(
        "⚠️ WebDriverAgent not accessible. Make sure it's running on the simulator."
      );
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Create a new session
   */
  async createSession() {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const response = await axios.post(`${this.baseURL}/session`, {
        capabilities: {
          platformName: "iOS",
          automationName: "XCUITest",
          deviceName: "iPhone Simulator",
        },
      });

      this.sessionId = response.data.sessionId;
      console.log(`✅ WDA session created: ${this.sessionId}`);
      return this.sessionId;
    } catch (error) {
      console.error("Error creating WDA session:", error.message);
      throw new Error(`Failed to create WDA session: ${error.message}`);
    }
  }

  /**
   * Tap at specific coordinates
   */
  async tap(x, y) {
    try {
      if (!this.sessionId) {
        await this.createSession();
      }

      const response = await axios.post(
        `${this.baseURL}/session/${this.sessionId}/wda/tap/0`,
        {
          x: Math.round(x),
          y: Math.round(y),
        }
      );

      console.log(`👆 Tap at (${x}, ${y})`);
      return response.data;
    } catch (error) {
      console.error("Error performing tap:", error.message);
      throw new Error(`Failed to perform tap: ${error.message}`);
    }
  }

  /**
   * Swipe from start to end coordinates
   */
  async swipe(startX, startY, endX, endY, duration = 1000) {
    try {
      if (!this.sessionId) {
        await this.createSession();
      }

      const response = await axios.post(
        `${this.baseURL}/session/${this.sessionId}/wda/dragfromtoforduration`,
        {
          fromX: Math.round(startX),
          fromY: Math.round(startY),
          toX: Math.round(endX),
          toY: Math.round(endY),
          duration: duration / 1000, // Convert to seconds
        }
      );

      console.log(`👆 Swipe from (${startX}, ${startY}) to (${endX}, ${endY})`);
      return response.data;
    } catch (error) {
      console.error("Error performing swipe:", error.message);
      throw new Error(`Failed to perform swipe: ${error.message}`);
    }
  }

  /**
   * Send keyboard input
   */
  async sendKeys(text) {
    try {
      if (!this.sessionId) {
        await this.createSession();
      }

      // Find the active text field first
      const elements = await axios.post(
        `${this.baseURL}/session/${this.sessionId}/elements`,
        {
          using: "class name",
          value: "XCUIElementTypeTextField",
        }
      );

      if (elements.data.value && elements.data.value.length > 0) {
        const elementId = elements.data.value[0].ELEMENT;

        // Tap the text field to focus it
        await axios.post(
          `${this.baseURL}/session/${this.sessionId}/element/${elementId}/click`
        );

        // Send the text
        const response = await axios.post(
          `${this.baseURL}/session/${this.sessionId}/element/${elementId}/value`,
          {
            value: text.split(""),
          }
        );

        console.log(`⌨️ Sent keys: "${text}"`);
        return response.data;
      } else {
        // Try to send keys to the active element
        const response = await axios.post(
          `${this.baseURL}/session/${this.sessionId}/keys`,
          {
            value: text.split(""),
          }
        );

        console.log(`⌨️ Sent keys to active element: "${text}"`);
        return response.data;
      }
    } catch (error) {
      console.error("Error sending keys:", error.message);
      throw new Error(`Failed to send keys: ${error.message}`);
    }
  }

  /**
   * Get element by accessibility ID
   */
  async findElementByAccessibilityId(accessibilityId) {
    try {
      if (!this.sessionId) {
        await this.createSession();
      }

      const response = await axios.post(
        `${this.baseURL}/session/${this.sessionId}/element`,
        {
          using: "accessibility id",
          value: accessibilityId,
        }
      );

      return response.data.value.ELEMENT;
    } catch (error) {
      console.error("Error finding element:", error.message);
      throw new Error(`Failed to find element: ${error.message}`);
    }
  }

  /**
   * Click element by accessibility ID
   */
  async clickElementByAccessibilityId(accessibilityId) {
    try {
      const elementId = await this.findElementByAccessibilityId(
        accessibilityId
      );

      const response = await axios.post(
        `${this.baseURL}/session/${this.sessionId}/element/${elementId}/click`
      );

      console.log(`👆 Clicked element: ${accessibilityId}`);
      return response.data;
    } catch (error) {
      console.error("Error clicking element:", error.message);
      throw new Error(`Failed to click element: ${error.message}`);
    }
  }

  /**
   * Get screen dimensions
   */
  async getScreenSize() {
    try {
      if (!this.sessionId) {
        await this.createSession();
      }

      const response = await axios.get(
        `${this.baseURL}/session/${this.sessionId}/window/size`
      );

      return {
        width: response.data.value.width,
        height: response.data.value.height,
      };
    } catch (error) {
      console.error("Error getting screen size:", error.message);
      throw new Error(`Failed to get screen size: ${error.message}`);
    }
  }

  /**
   * Get current app state
   */
  async getAppState() {
    try {
      if (!this.sessionId) {
        await this.createSession();
      }

      const response = await axios.get(
        `${this.baseURL}/session/${this.sessionId}/wda/activeAppInfo`
      );

      return response.data.value;
    } catch (error) {
      console.error("Error getting app state:", error.message);
      throw new Error(`Failed to get app state: ${error.message}`);
    }
  }

  /**
   * Close the session
   */
  async closeSession() {
    try {
      if (this.sessionId) {
        await axios.delete(`${this.baseURL}/session/${this.sessionId}`);
        this.sessionId = null;
        console.log("✅ WDA session closed");
      }
    } catch (error) {
      console.error("Error closing session:", error.message);
    }
  }

  /**
   * Check if WDA is accessible
   */
  async isAccessible() {
    try {
      await this.connect();
      return this.isConnected;
    } catch (error) {
      return false;
    }
  }
}

module.exports = WDAClient;

