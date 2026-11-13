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

# Global sensor state
latest_sensor_state = {
    "status": 0,
    "state": "CLEAR",
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

    try:
        while True:
            if ser and ser.in_waiting > 0:
                line = ser.readline().decode(errors="ignore").strip()
                if line:
                    if line.startswith("1"):
                        latest_sensor_state["status"] = 1
                        latest_sensor_state["state"] = "BLOCKED"
                        latest_sensor_state["updated"] = time.time()
                        print(f"\033[91;1m>> 1 (BLOCKED - Obstacle detected)\033[0m")
                    elif line.startswith("0"):
                        latest_sensor_state["status"] = 0
                        latest_sensor_state["state"] = "CLEAR"
                        latest_sensor_state["updated"] = time.time()
                        print(f"\033[92;1m>> 0 (NOT BLOCKED - Clear)\033[0m")
                    else:
                        print(f"   {line}")
            time.sleep(0.01)
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        if ser:
            ser.close()

if __name__ == "__main__":
    main()
