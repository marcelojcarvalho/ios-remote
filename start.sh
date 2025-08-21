#!/bin/bash

echo "🍎 iOS Remote Control Server"
echo "============================"
echo ""
echo "Starting server on http://localhost:3000"
echo ""
echo "Prerequisites:"
echo "- macOS with Xcode (for iOS simulator)"
echo "- Node.js 16+"
echo "- FFmpeg (optional, for video streaming)"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Check if we're on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "✅ macOS detected - iOS simulator support available"
    
    # Check if Xcode is installed
    if command -v xcrun &> /dev/null; then
        echo "✅ Xcode command line tools found"
    else
        echo "⚠️  Xcode command line tools not found"
        echo "   Install with: xcode-select --install"
    fi
    
    # Check if FFmpeg is available
    if command -v ffmpeg &> /dev/null; then
        echo "✅ FFmpeg found - video streaming available"
    else
        echo "⚠️  FFmpeg not found - will use screenshot streaming only"
        echo "   Install with: brew install ffmpeg"
    fi
else
    echo "⚠️  Non-macOS system detected"
    echo "   iOS simulator functionality will not work"
    echo "   You can still test the web interface"
fi

echo ""
echo "Starting server..."
echo ""

npm start

