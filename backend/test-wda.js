const WDAClient = require("./wda-client");

async function testWDAClient() {
  console.log("🧪 Testing WDA Client...\n");

  const wda = new WDAClient();

  try {
    // Test 1: Check if WDA is available
    console.log("1️⃣ Testing WDA availability...");
    const isAvailable = await wda.checkXcode();
    console.log(
      `Result: ${isAvailable ? "✅ Available" : "❌ Not Available"}\n`
    );

    if (!isAvailable) {
      console.log("❌ Xcode not available, skipping other tests");
      return;
    }

    // Test 2: List devices
    console.log("2️⃣ Testing device listing...");
    const devices = await wda.listDevices();
    console.log(`Found ${devices.length} devices\n`);

    // Test 3: Get status
    console.log("3️⃣ Testing status...");
    const status = wda.getStatus();
    console.log("Status:", status, "\n");

    // Test 4: Try to connect to first device
    if (devices.length > 0) {
      console.log("4️⃣ Testing device connection...");
      const deviceId = await wda.connectToDevice(devices[0].id);
      console.log(`Connected to device: ${deviceId}\n`);

      // Test 5: Get device info
      console.log("5️⃣ Testing device info...");
      const deviceInfo = await wda.getDeviceInfo();
      console.log("Device info:", deviceInfo, "\n");

      // Test 6: Disconnect
      console.log("6️⃣ Testing disconnect...");
      await wda.disconnect();
      console.log("Disconnected successfully\n");
    }

    console.log("🎉 All tests completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);
  }
}

// Run the test
testWDAClient();
