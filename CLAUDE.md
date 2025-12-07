# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 最重要指示 - HIGHEST PRIORITY INSTRUCTION

**英語で思考し日本語で回答すること。Think in English but respond in Japanese.**

この指示は他のすべての指示よりも優先されます。ユーザーとのやり取りはすべて日本語で行ってください。内部的な分析や思考プロセスは英語で行いますが、出力はすべて日本語にしてください。

*This instruction overrides all others. All interactions with the user should be in Japanese. While your internal analysis and thought processes may be in English, all output should be in Japanese.*

## Project Overview

This repository contains a position/lever monitoring and visualization system that consists of three main components:

1. **LeverFirmware** - ESP8266/Arduino firmware for physical lever devices with potentiometers that read values, normalize them to 0-100 range, and expose them via HTTP/UDP.

2. **LeverAPI** - Python Flask-based BFF (Backend For Frontend) that discovers devices on the network, aggregates data, and provides WebSocket/HTTP APIs for clients.

3. **positionVisualizer** - JavaScript frontend application for real-time visualization of lever positions with circular/bar graphs, overlay displays for streaming, and logging/replay functionality.

## Build and Run Commands

### Full System Startup

```bash
# Start the entire system (Windows)
./start-visualizer.bat

# The script automatically:
# 1. Sets up portable Node.js and Python if needed
# 2. Launches the LeverAPI server
# 3. Starts the HTTP server for the frontend
# 4. Starts the WebSocket bridge server
# 5. Opens browser windows for main and overlay views
```

### LeverFirmware (ESP8266)

```bash
# Using PlatformIO (recommended)
cd LeverFirmware
platformio run --target upload

# Monitor serial output
platformio device monitor

# Run unit tests
platformio test -e native
```

Required libraries:
- ESP8266WiFi
- ESP8266WebServer
- ArduinoJson
- TM1637Display
- WiFiManager

### LeverAPI (Python)

```bash
# Install dependencies
cd LeverAPI
pip install -r requirements.txt

# Run the API server
python app.py

# Run test UI (if needed)
cd LeverAPI/test_ui
python test_app.py
```

### Frontend (JavaScript)

```bash
# Install dependencies
cd positionVisualizer
npm install

# Run HTTP server
node tools/http-server.js

# Run WebSocket bridge server
node tools/bridge-server.js
```

## Architecture Overview

### Component Communication

1. **Device Discovery Protocol**:
   - UDP broadcast on port 4210 with message "DISCOVER_ENCODER"
   - Devices respond with: `{"type":"encoder","id":"[device-id]","ip":"[ip-address]"}`

2. **Data Flow**:
   - ESP8266 devices → LeverAPI (HTTP/UDP) → WebSocket Bridge → Frontend Visualization
   - Multiple devices can be monitored simultaneously
   - Data can be recorded, saved, and replayed

### LeverFirmware Architecture

- **Core**: Hardware abstraction, calibration, and device management
- **Communication**: Network interfaces, API controllers
- **Display**: LED indicators for device status

Key classes:
- `LeverController`: Main class orchestrating all components
- `NetworkInterface`: Handles WiFi, HTTP server, and UDP discovery
- `Calibration`: Manages value normalization and calibration storage

### LeverAPI Architecture

- **Flask-based BFF**: Aggregates data from multiple devices
- **Real-time Communication**: WebSockets for push updates
- **Device Management**: Discovery, status tracking, and connection handling

Key modules:
- `api/discovery.py`: UDP-based device discovery
- `api/device_manager.py`: Device state management and polling
- `app.py`: Main API server with HTTP endpoints and WebSocket handling

### Frontend Architecture

- **Clean Architecture**: Domain, Infrastructure, Use Cases, and Presentation layers
- **MVVM Pattern**: For UI binding and state management
- **Real-time Visualization**: Canvas-based meters and icons

Key components:
- **Bridge Client**: Handles WebSocket communication with LeverAPI
- **LiveMonitorService**: Manages real-time device updates
- **Recording/Replay**: For logging and playback functionality
- **Main View & Overlay View**: Different visualization modes for normal and streaming use

## Development Notes

### Adding New Features

When adding features, consider which component requires modification:

1. **LeverFirmware changes**: For new hardware functionality, sensor reading, or device-level features
2. **LeverAPI changes**: For new data aggregation, device management, or API endpoints
3. **Frontend changes**: For visualization enhancements, UI improvements, or new user interactions

### Testing

- **Firmware Testing**: Use `platformio test -e native` for unit tests
- **API Testing**: Test endpoints manually with the test_ui or tools like Postman
- **Frontend Testing**: Check rendering in both main view and overlay view

### Simulation Mode

The system includes simulation capabilities for development without physical hardware:

```bash
# Enable simulation in LeverAPI
curl -X POST http://localhost:5000/api/simulation/toggle

# Build firmware with simulation enabled
platformio run -e simulation
```

## Troubleshooting

### Common Issues

1. **Device Discovery**:
   - Ensure UDP broadcast packets aren't blocked by firewall
   - Verify devices are connected to the same network as LeverAPI

2. **WebSocket Connection**:
   - Check that bridge-server.js is running on port 8123
   - Verify browser supports WebSockets

3. **Visualization Issues**:
   - Clear browser cache if display doesn't update
   - Check browser console for JavaScript errors

### Debugging

- **Firmware**: Monitor serial output at 115200 baud
- **LeverAPI**: Check console logs with verbosity level at INFO or DEBUG
- **Frontend**: Use browser dev tools and enable verbose logging in settings