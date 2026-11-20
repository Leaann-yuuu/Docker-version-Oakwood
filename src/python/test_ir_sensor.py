#!/usr/bin/env python
import os
import sys
import time
import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

try:
    import serial
    import serial.tools.list_ports
except ImportError:
    print("Error: 'pyserial' is not installed. Run: pip install pyserial")
    sys.exit(1)

# Auto-close delay (seconds) after obstacle clears
AUTO_CLOSE_DELAY = float(os.environ.get("AUTO_CLOSE_DELAY", "5.0"))

# Global sensor state
latest_sensor_state = {
    "status": 0,
    "state": "CLEAR",
    "gate": "CLOSED",
    "updated": time.time()
}

HTML_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ir_sensor_checker.html")

class SensorHTTPHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Enable CORS for easy cross-origin if opened from file:// or other ports
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET")

        if self.path == "/api/sensor":
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(latest_sensor_state).encode("utf-8"))
        else:
            # Serve ir_sensor_checker.html
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            if os.path.exists(HTML_PATH):
                with open(HTML_PATH, "rb") as f:
                    self.wfile.write(f.read())
            else:
                self.wfile.write(b"<h1>Error: ir_sensor_checker.html not found.</h1>")

    def log_message(self, format, *args):
        # Suppress noisy HTTP request logging in console
        return

def run_http_server(port=8080):
    try:
        server = HTTPServer(("0.0.0.0", port), SensorHTTPHandler)
        server.serve_forever()
    except Exception as e:
        print(f"Web server warning: {e}")

def find_arduino_port():
    ports = list(serial.tools.list_ports.comports())
    if not ports:
        return None
    for p in ports:
        desc = p.description.lower()
        if any(kw in desc for kw in ["arduino", "ch340", "usb serial", "ftdi", "cp210", "usb-to-uart", "uart", "ser"]):
            return p.device
    return ports[0].device

def main():
    port = os.environ.get("SERIAL_PORT") or find_arduino_port() or "COM5"

    print("\n=======================================================")
    print("   OakWood Gate - IR Sensor Live Monitor & Web Server")
    print("=======================================================")

    # Start HTTP Web Server in background thread
    server_thread = threading.Thread(target=run_http_server, args=(8080,), daemon=True)
    server_thread.start()

    print(f"🌐 Web Interface running at: http://localhost:8080")
    print(f"🔌 Connecting to Arduino on {port} at 9600 baud...")

    try:
        ser = serial.Serial(port, 9600, timeout=1)
        time.sleep(2)
        print(" Connected to Arduino! Listening for IR sensor changes...")
        print("   (Open http://localhost:8080 in your browser to see the live UI!)\n")
    except Exception as e:
        print(f"\n⚠️  Could not connect to {port}: {e}")
        print("   Tip 1: Make sure the Arduino IDE Serial Monitor is CLOSED.")
        print("   Tip 2: You can still open http://localhost:8080 to test the Web Serial button or Simulation mode!\n")
        ser = None

    gate_is_open = False
    clear_since = None
    last_countdown_printed = None

    print(f"Auto Gate Mode: Obstacle (1) -> OPEN | Clear (0) for {AUTO_CLOSE_DELAY:.0f}s -> CLOSE\n")

    try:
        while True:
            if ser and ser.in_waiting > 0:
                line = ser.readline().decode(errors="ignore").strip()
                if line:
                    lower_line = line.lower()
                    if line.startswith("1"):
                        latest_sensor_state["status"] = 1
                        latest_sensor_state["state"] = "BLOCKED"
                        latest_sensor_state["updated"] = time.time()
                        clear_since = None
                        last_countdown_printed = None
                        print(f"\033[91;1m>> 1 (BLOCKED - Obstacle detected)\033[0m")

                        if not gate_is_open:
                            print("[AUTO GATE] Obstacle detected -> Sending 'O' (OPENING GATE)")
                            ser.write(b"O")
                            ser.flush()
                            gate_is_open = True
                            latest_sensor_state["gate"] = "OPEN"
                    elif line.startswith("0"):
                        latest_sensor_state["status"] = 0
                        latest_sensor_state["state"] = "CLEAR"
                        latest_sensor_state["updated"] = time.time()
                        print(f"\033[92;1m>> 0 (NOT BLOCKED - Clear)\033[0m")

                        if gate_is_open and clear_since is None:
                            clear_since = time.time()
                            last_countdown_printed = None
                    else:
                        print(f"   {line}")
                        if "gate open!" in lower_line:
                            gate_is_open = True
                            latest_sensor_state["gate"] = "OPEN"
                            if latest_sensor_state["status"] == 0 and clear_since is None:
                                clear_since = time.time()
                                last_countdown_printed = None
                        elif "gate closed!" in lower_line:
                            gate_is_open = False
                            clear_since = None
                            last_countdown_printed = None
                            latest_sensor_state["gate"] = "CLOSED"
                        elif "safety lock" in lower_line or "emergency safety" in lower_line:
                            gate_is_open = True
                            clear_since = None
                            last_countdown_printed = None
                            latest_sensor_state["gate"] = "OPEN"

            # Auto-close timer when gate is open and path is clear
            if ser and gate_is_open and latest_sensor_state["status"] == 0:
                if clear_since is None:
                    clear_since = time.time()
                elapsed = time.time() - clear_since
                rem = int(AUTO_CLOSE_DELAY - elapsed) + 1
                if elapsed >= AUTO_CLOSE_DELAY:
                    print(f"[AUTO GATE] No obstacle for {AUTO_CLOSE_DELAY:.0f}s -> Sending 'C' (CLOSING GATE)")
                    ser.write(b"C")
                    ser.flush()
                    gate_is_open = False
                    clear_since = None
                    last_countdown_printed = None
                    latest_sensor_state["gate"] = "CLOSED"
                elif rem != last_countdown_printed:
                    print(f"[AUTO GATE] Clear -> Closing in {rem}s...")
                    last_countdown_printed = rem

            time.sleep(0.01)
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        if ser:
            ser.close()

if __name__ == "__main__":
    main()
