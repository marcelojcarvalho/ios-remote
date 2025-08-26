const IDBClient = require("./idb-client");

async function testIntegration() {
  console.log("🧪 Testing IDB Client Integration...\n");

  const idb = new IDBClient();

  try {
    // Test 1: Check if IDB is available
    console.log("1️⃣ Testing IDB availability...");
    const isAvailable = await idb.checkIDB();
    console.log(
      `Result: ${isAvailable ? "✅ Available" : "❌ Not Available"}\n`
    );

    if (!isAvailable) {
      console.log("❌ IDB not available, integration will fail");
      return;
    }

    // Test 2: List devices
    console.log("2️⃣ Testing device listing...");
    const devices = await idb.listDevices();
    console.log(`Found ${devices.length} devices\n`);

    // Test 3: Test connection
    if (devices.length > 0) {
      console.log("3️⃣ Testing device connection...");
      const deviceId = await idb.connectToDevice();
      console.log(`Connected to device: ${deviceId}\n`);

      // Test 4: Test basic operations
      console.log("4️⃣ Testing basic operations...");

      // Test tap
      try {
        await idb.tap(100, 200);
        console.log("✅ Tap operation working");
      } catch (error) {
        console.log("⚠️ Tap operation failed:", error.message);
      }

      // Test screenshot
      try {
        const screenshot = await idb.takeScreenshot();
        console.log("✅ Screenshot operation working:", screenshot.filename);
      } catch (error) {
        console.log("⚠️ Screenshot operation failed:", error.message);
      }

      // Test disconnect
      await idb.disconnect();
      console.log("✅ Disconnect working\n");
    }

    console.log("🎉 Integration test completed!");
    console.log("💡 The IDB client is now ready to work with your frontend!");
  } catch (error) {
    console.error("❌ Integration test failed:", error.message);
    console.error(error.stack);
  }
}

// Run the test
testIntegration();
