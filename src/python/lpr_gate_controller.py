#!/usr/bin/env python
import os
import re
import json
import time
import sys
import threading
import queue
import socket
import requests
import warnings
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn

# Suppress PyTorch/dataloader depreciation warnings for a clean console
warnings.filterwarnings("ignore")

# Force OpenCV to use TCP for RTSP to prevent packet drop/corruption
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"

# Try importing camera/LPR dependencies
try:
    import cv2
    import easyocr
    import numpy as np
    LPR_AVAILABLE = True
except ImportError:
    LPR_AVAILABLE = False
    print("Note: Camera/LPR libraries (cv2, easyocr, numpy) not fully installed.")
    print("      Please install dependencies to enable LPR camera features.")

# Try importing serial (pyserial)
try:
    import serial
    import serial.tools.list_ports
except ImportError:
    print("Warning: 'pyserial' is not installed. Running in Serial Simulation Mode.")
    serial = None

# ==========================================
# ENVIRONMENT CONFIGURATION LOADER
# ==========================================
def load_env_file():
    """Loads environment variables from the server/.env file if it exists."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    paths = [
        os.path.join(script_dir, "../server/.env"),
        os.path.join(script_dir, ".env"),
        os.path.join(os.getcwd(), "server/.env"),
        os.path.join(os.getcwd(), ".env")
    ]
    for path in paths:
        if os.path.exists(path):
            print(f"Loading environment variables from: {os.path.abspath(path)}")
            try:
                with open(path, "r") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#"):
                            continue
                        if "=" in line:
                            key, val = line.split("=", 1)
                            val = val.strip().strip('"').strip("'")
                            os.environ[key.strip()] = val
                break
            except Exception as e:
                print(f"Error loading env file {path}: {e}")

# Load server environment variables first
load_env_file()

# ==========================================
# CONFIGURATION CONSTANTS
# ==========================================
API_BASE_URL = os.environ.get("API_BASE_URL") or (os.environ.get("APP_URL", "http://127.0.0.1:8080").rstrip("/") + "/api")
API_USERNAME = os.environ.get("API_USERNAME", "johndoe")
API_PASSWORD = os.environ.get("API_PASSWORD", "johndoe")
API_LOGIN_PATH = os.environ.get("API_LOGIN_PATH", "/auth/admin/login")

# Camera Setup
# Entrance CCTV RTSP stream (used for LPR at gate entry)
ENTRANCE_CAMERA_SOURCE = os.environ.get("ESP32_CAM_ENTRANCE_STREAM_URL") or os.environ.get("ESP32_CAM_STREAM_URL") or "rtsp://Capstonecamera:Capstonecamera@192.168.86.38:554/stream2"
# Exit CCTV RTSP stream (used for LPR at gate exit)
EXIT_CAMERA_SOURCE = os.environ.get("ESP32_CAM_EXIT_STREAM_URL") or "rtsp://Capstonecameraexit:Capstonecameraexit@192.168.86.26:554/stream2"
# Active camera for LPR processing
CAMERA_SOURCE = ENTRANCE_CAMERA_SOURCE

# Serial Configuration
SERIAL_PORT = os.environ.get("SERIAL_PORT") or None
BAUD_RATE = 9600

# OCR/LPR Settings
COOLDOWN_PERIOD = int(os.environ.get("LPR_COOLDOWN_PERIOD", "30"))     
CONFIDENCE_THRESHOLD = 0.5 
GATE_AUTO_CLOSE_DELAY = int(os.environ.get("GATE_AUTO_CLOSE_DELAY", "10"))

# ==========================================
# GLOBAL STATE & 15 FPS STREAM ENGINE
# ==========================================
token = None
headers = {}
arduino = None
gate_state = "closed"
entrance_gate_state = "closed"
exit_gate_state = "closed"
last_scanned_plates = {}
running = True
lpr_lock = threading.Lock()
lpr_locks = {"IN": threading.Lock(), "OUT": threading.Lock()}
gate_cycle_lock = threading.Lock()
is_gate_cycling = False
last_plate_seen_time = 0
gate_opened_event = threading.Event()
gate_closed_event = threading.Event()

STREAM_TARGET_FPS = 15
FRAME_INTERVAL = 1.0 / STREAM_TARGET_FPS  # ~0.0667s for 15 FPS
last_frame_save_time = {"IN": 0.0, "OUT": 0.0}
last_disk_save_time = {"IN": 0.0, "OUT": 0.0}
DISK_SAVE_INTERVAL = 1.0  # Write snapshot to disk only 1/sec instead of 15/sec (93% I/O saving)

last_motion_thumb = {"IN": None, "OUT": None}
last_ocr_time = {"IN": 0.0, "OUT": 0.0}
OCR_MIN_INTERVAL = 0.35   # Max ~2.8 scans/sec when vehicle moves (drops OCR CPU by 70%)

def detect_motion(frame, direction):
    """Ultra-fast 160x90 thumbnail motion check (<0.1ms). Skips heavy OCR when driveway is empty."""
    try:
        small = cv2.resize(frame, (160, 90), interpolation=cv2.INTER_NEAREST)
        gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
        prev = last_motion_thumb.get(direction)
        last_motion_thumb[direction] = gray
        if prev is None:
            return True
        diff = cv2.absdiff(gray, prev)
        mean_diff = float(np.mean(diff))
        return mean_diff > 2.0  # Significant motion detected
    except Exception:
        return True

active_detections = {
    "IN": {
        "plate": None,
        "raw_text": None,
        "confidence": 0.0,
        "box": None,
        "timestamp": 0.0,
        "authorized": None,
        "resident": None,
        "car": None,
        "logged_at": None,
    },
    "OUT": {
        "plate": None,
        "raw_text": None,
        "confidence": 0.0,
        "box": None,
        "timestamp": 0.0,
        "authorized": None,
        "resident": None,
        "car": None,
        "logged_at": None,
    }
}
verification_cache = {"IN": {}, "OUT": {}}
db_plate_cache = {}
authorized_whitelist = {}
whitelist_synced = False
whitelist_lock = threading.Lock()
WHITELIST_SYNC_INTERVAL = 10.0  # Sync authorized plates into RAM every 10s for 0ms lookup
http_session = requests.Session()
detection_lock = threading.Lock()

# ==========================================
# ARDUINO SERIAL CONNECTION
# ==========================================
def find_arduino_port():
    if serial is None:
        return None
    ports = list(serial.tools.list_ports.comports())
    if not ports:
        return None
    for p in ports:
        desc = p.description.lower()
        if any(kw in desc for kw in ["arduino", "ch340", "usb serial", "ftdi", "cp210", "usb-to-uart", "uart", "prolific", "ser"]):
            print(f"Auto-detected Arduino on port: {p.device} ({p.description})")
            return p.device
    print(f"Fallback: Auto-detecting first available port: {ports[0].device} ({ports[0].description})")
    return ports[0].device

def init_serial():
    global arduino
    if serial is None:
        print("Serial module not available. Running in Simulation Mode.")
        return False
    port = SERIAL_PORT or find_arduino_port()
    if not port:
        print("Error: No serial port found. Connect your Arduino or set SERIAL_PORT in config. Running in Simulation Mode.")
        return False
    try:
        arduino = serial.Serial(port, BAUD_RATE, timeout=1)
        time.sleep(2)
        print(f"Connected to Arduino on port {port} at {BAUD_RATE} baud.")
        return True
    except Exception as e:
        print(f"Error opening serial port {port}: {e}. Running in Simulation Mode.")
        arduino = None
        return False

def close_command_for_gate(gate_command):
    return 'C' if gate_command == 'O' else 'Z'

def send_arduino_command(cmd):
    global gate_state, entrance_gate_state, exit_gate_state
    if cmd == 'O':
        entrance_gate_state = "open"
        gate_state = "open"
    elif cmd == 'X':
        exit_gate_state = "open"
        gate_state = "open"
    elif cmd == 'C':
        entrance_gate_state = "closed"
        gate_state = "closed" if exit_gate_state == "closed" else "open"
    elif cmd == 'Z':
        exit_gate_state = "closed"
        gate_state = "closed" if entrance_gate_state == "closed" else "open"

    if arduino and arduino.is_open:
        try:
            arduino.write(cmd.encode())
            arduino.flush()
            print(f"[Serial -> Arduino] Sent: '{cmd}'")
        except Exception as e:
            print(f"Serial write error: {e}")
    else:
        print(f"[Serial Simulation] Arduino received command: '{cmd}' (State: {gate_state.upper()})")

def trigger_gate_access_cycle(gate_command, hold_seconds=GATE_AUTO_CLOSE_DELAY):
    """
    Opens the barrier gate upon authorized plate detection,
    waits until the plate is no longer detected, then waits hold_seconds (10s)
    and automatically closes the gate.
    """
    global is_gate_cycling

    with gate_cycle_lock:
        if is_gate_cycling:
            print("[Gate Controller] Gate cycle already in progress. Ignoring duplicate trigger.")
            return
        is_gate_cycling = True

    def _cycle():
        global is_gate_cycling
        try:
            close_cmd = close_command_for_gate(gate_command)
            gate_opened_event.clear()
            gate_closed_event.clear()

            print(f"\n========================================================")
            print(f" [GATE CONTROLLER] Plate Authorized -> OPENING GATE ('{gate_command}')")
            print(f"========================================================")
            send_arduino_command(gate_command)
            sync_gate_status_with_laravel("open")

            if arduino and arduino.is_open:
                print("[GATE CONTROLLER] Waiting for barrier gate to reach OPEN position (~3s)...")
                gate_opened_event.wait(timeout=5)
                print("[GATE CONTROLLER] Barrier gate is fully OPEN.")
            else:
                print("[GATE CONTROLLER] [Simulation] Gate is now OPEN.")

            # Check if vehicle / plate is currently in camera view
            if (time.time() - last_plate_seen_time) < 2.0:
                print("[GATE CONTROLLER] Vehicle/Plate currently visible in front of gate. Holding gate open...")
                while (time.time() - last_plate_seen_time) < 2.0:
                    time.sleep(0.5)
                print("[GATE CONTROLLER] Plate is NO LONGER DETECTED (Vehicle has cleared gate).")

            print(f"[GATE CONTROLLER] Waiting {hold_seconds} seconds before closing barrier gate...")
            remaining = hold_seconds
            while remaining > 0:
                time.sleep(1)
                remaining -= 1
                # If plate reappears in front of camera during the countdown, hold open
                if (time.time() - last_plate_seen_time) < 1.5:
                    print("[GATE CONTROLLER] Plate detected again! Pausing close timer...")
                    while (time.time() - last_plate_seen_time) < 2.0:
                        time.sleep(0.5)
                    print(f"[GATE CONTROLLER] Plate cleared again. Restarting {hold_seconds}s countdown...")
                    remaining = hold_seconds
                if remaining in (10, 5, 3, 2, 1):
                    print(f"[GATE CONTROLLER] Auto-closing in {remaining}s...")

            print(f"\n========================================================")
            print(f" [GATE CONTROLLER] Timer Expired -> CLOSING GATE ('{close_cmd}')")
            print(f"========================================================")
            # Send close command and immediately sync closed status to backend
            send_arduino_command(close_cmd)
            sync_gate_status_with_laravel("closed")

            if arduino and arduino.is_open:
                print("[GATE CONTROLLER] Waiting for barrier gate to reach CLOSED position (~3s)...")
                gate_closed_event.wait(timeout=5)
                print("[GATE CONTROLLER] Barrier gate is fully CLOSED.")

            print("[GATE CONTROLLER] Gate cycle complete. Barrier arm safely CLOSED.\n")
        except Exception as e:
            print(f"[GATE CONTROLLER ERROR] Error during gate cycle: {e}")
            try:
                send_arduino_command('C')
                sync_gate_status_with_laravel("closed")
            except Exception:
                pass
        finally:
            with gate_cycle_lock:
                is_gate_cycling = False

    cycle_thread = threading.Thread(target=_cycle)
    cycle_thread.daemon = True
    cycle_thread.start()

# ==========================================
# LARAVEL BACKEND API COMMUNICATION
# ==========================================
def login_to_laravel():
    global token, headers, API_BASE_URL
    print(f"Authenticating with Laravel API at {API_BASE_URL}...")
    candidate_bases = [API_BASE_URL]
    for alt in ["http://127.0.0.1:8080/api", "http://localhost:8080/api", "http://127.0.0.1:8000/api", "http://localhost:8000/api"]:
        if alt not in candidate_bases:
            candidate_bases.append(alt)

    login_attempts = [
        API_LOGIN_PATH,
        "/auth/admin/login",
        "/auth/login",
    ]
    seen_paths = set()
    payload = {
        "username": API_USERNAME,
        "password": API_PASSWORD
    }
    for base in candidate_bases:
        for login_path in login_attempts:
            full_key = f"{base}{login_path}"
            if full_key in seen_paths:
                continue
            seen_paths.add(full_key)
            login_url = full_key
            try:
                response = requests.post(login_url, json=payload, timeout=4)
                if response.status_code == 200:
                    data = response.json()
                    token = data.get("token")
                    headers = {
                        "Authorization": f"Bearer {token}",
                        "Accept": "application/json"
                    }
                    API_BASE_URL = base
                    print(f"Successfully authenticated with Laravel backend at {base} via {login_path}!")
                    return True
                print(f"Authentication via {login_url} failed (HTTP {response.status_code}): {response.text}")
            except Exception as e:
                # Silently try next candidate port
                pass
    print("Warning: Dashboard sync is disabled until authentication succeeds. Plate verification still works.")
    return False

def sync_gate_status_with_laravel(status):
    global gate_state, entrance_gate_state, exit_gate_state
    gate_state = status
    if status == "closed":
        entrance_gate_state = "closed"
        exit_gate_state = "closed"
    if not token:
        return
    toggle_url = f"{API_BASE_URL}/gate/toggle"
    payload = {"gate_status": status}
    try:
        response = requests.put(toggle_url, json=payload, headers=headers, timeout=3)
        if response.status_code == 200:
            print(f"Successfully synced gate status '{status}' to Laravel.")
        else:
            print(f"Failed to sync gate status (HTTP {response.status_code}): {response.text}")
    except Exception as e:
        print(f"Network error syncing gate status: {e}")

# ==========================================
# CAMERA SNAPSHOT CAPTURE HELPERS
# ==========================================
def resolve_capture_urls(stream_url):
    if not stream_url:
        return []

    trimmed = stream_url.strip().rstrip("/")
    candidates = []

    if re.search(r"/stream/?$", trimmed, flags=re.I):
        candidates.append(re.sub(r"/stream/?$", "/capture", trimmed, flags=re.I))
        candidates.append(re.sub(r"/stream/?$", "/jpg", trimmed, flags=re.I))

    if ":81" in trimmed:
        without_stream_port = trimmed.replace(":81", "")
        candidates.append(re.sub(r"/stream/?$", "/capture", without_stream_port, flags=re.I))
        candidates.append(re.sub(r"/stream/?$", "/jpg", without_stream_port, flags=re.I))

    candidates.append(trimmed)

    unique_candidates = []
    seen = set()
    for url in candidates:
        if url and url not in seen:
            seen.add(url)
            unique_candidates.append(url)
    return unique_candidates

def capture_snapshot_from_camera(direction):
    """Fetches a single JPEG frame from the camera corresponding to the direction."""
    source = EXIT_CAMERA_SOURCE if direction == "OUT" else ENTRANCE_CAMERA_SOURCE
    if not source:
        return None

    capture_urls = resolve_capture_urls(source)
    print(f"Attempting to capture snapshot for {direction or 'IN'} gate from camera source: {source}")
    for capture_url in capture_urls:
        try:
            response = requests.get(
                capture_url,
                timeout=1.0,
                headers={"Accept": "image/*"},
            )
            content_type = response.headers.get("Content-Type", "")
            if response.status_code == 200 and content_type.startswith("image/"):
                return response.content
            print(
                f"HTTP snapshot failed for {capture_url} "
                f"(status: {response.status_code}, content-type: {content_type})"
            )
        except Exception as e:
            print(f"Error fetching HTTP snapshot from {capture_url}: {e}")

    # Avoid blocking the gate verification threads with OpenCV video capture fallback
    return None

# ==========================================
# LICENSE PLATE RECOGNITION (LPR) LOGIC
# ==========================================
def preprocess_plate_contour(frame):
    if not LPR_AVAILABLE:
        return None, None
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    blur = cv2.bilateralFilter(gray, 11, 17, 17)
    edged = cv2.Canny(blur, 30, 200)
    contours, _ = cv2.findContours(edged.copy(), cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:10]
    
    screenCnt = None
    for c in contours:
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.018 * peri, True)
        if len(approx) == 4:
            screenCnt = approx
            break
            
    if screenCnt is not None:
        mask = np.zeros(gray.shape, np.uint8)
        new_image = cv2.drawContours(mask, [screenCnt], 0, 255, -1)
        new_image = cv2.bitwise_and(frame, frame, mask=mask)
        (x, y) = np.where(mask == 255)
        (topx, topy) = (np.min(x), np.min(y))
        (bottomx, bottomy) = (np.max(x), np.max(y))
        cropped = gray[topx:bottomx+1, topy:bottomy+1]
        return cropped, (topy, topx, bottomy, bottomx)
    return None, None

def clean_plate_text(text):
    cleaned = re.sub(r'[^A-Za-z0-9]', '', text)
    return cleaned.upper()

IGNORED_OSD_WORDS = {
    "EXIT", "ENTRANCE", "CAMERA", "TAPO", "LIVE", "ANPR", "FPS", "REC",
    "CH1", "CH2", "CH3", "CH4", "HD", "SD", "DVR", "NVR", "IPCAM", "RTSP",
    "HIKVISION", "DAHUA", "GATE", "STATE", "OPEN", "CLOSED", "FULL",
    "SCREEN", "SCAN", "PLATE", "CONF", "AUTHORIZED", "DENIED",
    "UNAUTHORIZED", "VERIFYING", "DATABASE", "REGISTERED", "UNKNOWN",
}

def is_ignored_osd_text(text):
    if not text:
        return True
    cleaned = clean_plate_text(text)
    if not cleaned or cleaned in IGNORED_OSD_WORDS:
        return True
    # Ignore timestamps like 042205PM, pure dates like 11052026, times like 1523
    if re.match(r'^\d{4,8}(AM|PM)?$', cleaned):
        return True
    # Ignore date patterns like 2026-11-13 -> 20261113
    if re.match(r'^20\d{6}$', cleaned):
        return True
    # Ignore pure letters or pure digits of length >= 4 (cannot be a PH plate)
    if re.match(r'^[A-Z]+$', cleaned) or re.match(r'^\d+$', cleaned):
        return True
    return False

# Philippine license plate format patterns
PH_PLATE_PATTERNS = [
    re.compile(r'^[A-Z]{3}\d{4}$'),       # Standard 4-wheel private (ABC 1234)
    re.compile(r'^[A-Z]{3}\d{3}$'),       # Old 4-wheel private (ABC 123)
    re.compile(r'^\d{4}[A-Z]{2}$'),       # New motorcycle (6465 SR)
    re.compile(r'^[A-Z]{2}\d{4,5}$'),     # Temporary / Protocol / Utility (AB 1234, AB 12345)
    re.compile(r'^[A-Z]{1}\d{3}[A-Z]{2}$'),  # Conduction / Special (A 123 BC)
    re.compile(r'^[A-Z]{2}\d{3}[A-Z]{1}$'),  # Special 2L-3D-1L (AB 123 C)
    re.compile(r'^\d{3}[A-Z]{2,3}$'),     # Motorcycle 3D-2L/3L (123 AB, 123 ABC)
    re.compile(r'^[A-Z]{1,3}\d{3,5}$'),   # General L+D formats
    re.compile(r'^\d{3,5}[A-Z]{1,3}$'),   # General D+L formats
]

_DIGIT_TO_LETTER = {'0': 'O', '1': 'I', '2': 'Z', '5': 'S', '6': 'G', '8': 'B'}
_LETTER_TO_DIGIT = {'O': '0', 'Q': '0', 'D': '0', 'I': '1', 'L': '1', 'Z': '2', 'S': '5', 'G': '6', 'B': '8'}

def is_valid_plate_format(text):
    """Check if text matches any known Philippine license plate format."""
    if not text or len(text) < 4 or len(text) > 8:
        return False
    has_letters = bool(re.search(r'[A-Z]', text))
    has_digits = bool(re.search(r'\d', text))
    if not (has_letters and has_digits):
        return False
    for pattern in PH_PLATE_PATTERNS:
        if pattern.match(text):
            return True
    return False

def generate_plate_variants(cleaned_text):
    """Generate positional OCR-disambiguated plate variants matching Philippine plate structures."""
    if not cleaned_text or len(cleaned_text) < 4 or len(cleaned_text) > 8:
        return []

    variants = []
    seen = set()

    def _add(v):
        if v and v not in seen and not is_ignored_osd_text(v) and is_valid_plate_format(v):
            seen.add(v)
            variants.append(v)

    _add(cleaned_text)

    # Positional splits: letters-then-digits (e.g., ABC1234, ABC123, AB1234, AB12345)
    for split in (3, 2):
        if split < len(cleaned_text) and 3 <= (len(cleaned_text) - split) <= 5:
            lp = ''.join(_DIGIT_TO_LETTER.get(ch, ch) for ch in cleaned_text[:split])
            dp = ''.join(_LETTER_TO_DIGIT.get(ch, ch) for ch in cleaned_text[split:])
            if lp.isalpha() and dp.isdigit():
                _add(lp + dp)

    # Positional splits: digits-then-letters (e.g., 6465SR, 123ABC)
    for split in (4, 3):
        if split < len(cleaned_text) and 2 <= (len(cleaned_text) - split) <= 3:
            dp = ''.join(_LETTER_TO_DIGIT.get(ch, ch) for ch in cleaned_text[:split])
            lp = ''.join(_DIGIT_TO_LETTER.get(ch, ch) for ch in cleaned_text[split:])
            if dp.isdigit() and lp.isalpha():
                _add(dp + lp)

    return variants

def merge_adjacent_ocr_boxes(results):
    """
    Keep individual OCR detections AND also merge horizontally adjacent or
    vertically stacked 2-line plate fragments (e.g. '6465' + 'SR' -> '6465SR').
    """
    merged = list(results)
    n = len(results)
    for i in range(n):
        bbox_a, text_a, prob_a = results[i]
        ax1 = min(pt[0] for pt in bbox_a)
        ay1 = min(pt[1] for pt in bbox_a)
        ax2 = max(pt[0] for pt in bbox_a)
        ay2 = max(pt[1] for pt in bbox_a)
        aw = max(1.0, ax2 - ax1)
        ah = max(1.0, ay2 - ay1)
        acy = (ay1 + ay2) / 2.0
        acx = (ax1 + ax2) / 2.0

        for j in range(n):
            if i == j:
                continue
            bbox_b, text_b, prob_b = results[j]
            bx1 = min(pt[0] for pt in bbox_b)
            by1 = min(pt[1] for pt in bbox_b)
            bx2 = max(pt[0] for pt in bbox_b)
            by2 = max(pt[1] for pt in bbox_b)
            bw = max(1.0, bx2 - bx1)
            bh = max(1.0, by2 - by1)
            bcy = (by1 + by2) / 2.0
            bcx = (bx1 + bx2) / 2.0

            # Horizontal merge: B is to the right of A on roughly the same line
            same_row = abs(acy - bcy) <= max(ah, bh) * 0.65
            horiz_gap = bx1 - ax2
            is_horiz_pair = same_row and (-aw * 0.25 <= horiz_gap <= max(ah, bh) * 2.5) and (0.4 <= (ah / bh) <= 2.5)

            # Vertical merge (2-line motorcycle / temporary plates): B is directly below A
            x_overlap = min(ax2, bx2) - max(ax1, bx1)
            vert_gap = by1 - ay2
            is_vert_pair = (x_overlap > 0 or abs(acx - bcx) <= max(aw, bw) * 0.6) and (-ah * 0.2 <= vert_gap <= max(ah, bh) * 1.4)

            if is_horiz_pair or is_vert_pair:
                cx1, cy1 = min(ax1, bx1), min(ay1, by1)
                cx2, cy2 = max(ax2, bx2), max(ay2, by2)
                combined_bbox = [[cx1, cy1], [cx2, cy1], [cx2, cy2], [cx1, cy2]]
                combined_text = f"{text_a} {text_b}"
                combined_prob = (prob_a + prob_b) / 2.0
                merged.append((combined_bbox, combined_text, combined_prob))
    return merged

def detect_full_frame_plate_regions(frame):
    """
    Locate rectangular license-plate candidate regions anywhere across the full frame
    using bilateral filtering, Sobel-X vertical edges, Otsu thresholding, and morphology.
    """
    if not LPR_AVAILABLE or frame is None:
        return []
    h, w = frame.shape[:2]
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    blur = cv2.bilateralFilter(gray, 9, 75, 75)
    grad_x = cv2.Sobel(blur, cv2.CV_16S, 1, 0, ksize=3)
    abs_grad_x = cv2.convertScaleAbs(grad_x)
    _, thresh = cv2.threshold(abs_grad_x, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    rect_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (17, 5))
    closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, rect_kernel)
    closed = cv2.erode(closed, None, iterations=1)
    closed = cv2.dilate(closed, None, iterations=2)

    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    candidates = []
    for cnt in sorted(contours, key=cv2.contourArea, reverse=True)[:20]:
        rx, ry, rw, rh = cv2.boundingRect(cnt)
        area = rw * rh
        if area < 600 or rw < 40 or rh < 14:
            continue
        aspect = rw / float(rh)
        if 1.3 <= aspect <= 7.5:
            # Pad region slightly for better OCR context
            pad_x = max(6, int(rw * 0.12))
            pad_y = max(4, int(rh * 0.2))
            x1 = max(0, rx - pad_x)
            y1 = max(0, ry - pad_y)
            x2 = min(w, rx + rw + pad_x)
            y2 = min(h, ry + rh + pad_y)
            candidates.append((x1, y1, x2, y2))
            if len(candidates) >= 5:
                break
    return candidates

# Multi-frame plate confirmation tracker
plate_candidates = {"IN": {}, "OUT": {}}
PLATE_CONFIRM_FRAMES = 2  # Require plate seen in N frames for unknown plates (registered plates confirm in 1 frame)
PLATE_CANDIDATE_TIMEOUT = 15.0  # Keep candidates for 15s so CPU OCR passes never expire prematurely


# ==========================================
# VEHICLE & LICENSE PLATE CAPTURE STORAGE
# ==========================================
CAPTURES_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "captured_images"))
WEB_CAPTURES_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "server", "public", "captured_images"))
ENTRANCE_CAPTURES_DIR = os.path.abspath(os.path.join(CAPTURES_DIR, "Entrance Capture"))
WEB_ENTRANCE_CAPTURES_DIR = os.path.abspath(os.path.join(WEB_CAPTURES_DIR, "Entrance Capture"))
EXIT_CAPTURES_DIR = os.path.abspath(os.path.join(CAPTURES_DIR, "Exit Capture"))
WEB_EXIT_CAPTURES_DIR = os.path.abspath(os.path.join(WEB_CAPTURES_DIR, "Exit Capture"))

def save_exit_registered_capture(frame, plate_box, plate_number):
    """
    FOR EXIT ONLY:
    Saves ONLY ONE SHOT containing:
    1. The full vehicle frame
    2. A rectangle shape drawn directly around the plate number
    Stored strictly for registered vehicles inside:
    'captured_images/Exit Capture/<TIMESTAMP>_<PLATE>_exit.jpg'
    """
    if frame is None:
        return None

    try:
        now = datetime.now()
        timestamp = now.strftime("%Y-%m-%d_%H-%M-%S")
        safe_plate = re.sub(r'[^A-Za-z0-9]', '', str(plate_number)).upper() or "UNKNOWN"

        os.makedirs(EXIT_CAPTURES_DIR, exist_ok=True)
        os.makedirs(WEB_EXIT_CAPTURES_DIR, exist_ok=True)

        exit_shot = frame.copy()
        h, w = exit_shot.shape[:2]

        if plate_box and len(plate_box) == 4:
            bx1, by1, bx2, by2 = plate_box
            bx1 = max(0, min(w - 1, int(bx1)))
            by1 = max(0, min(h - 1, int(by1)))
            bx2 = max(0, min(w - 1, int(bx2)))
            by2 = max(0, min(h - 1, int(by2)))

            # 1. Rectangle shape around plate number (Green for Registered)
            cv2.rectangle(exit_shot, (bx1, by1), (bx2, by2), (0, 255, 65), 3)

            # 2. Sleek tactical corner brackets on the rectangle
            b_len = max(8, min(24, int((bx2 - bx1) * 0.2)))
            t = 4
            cv2.line(exit_shot, (bx1, by1), (bx1 + b_len, by1), (0, 255, 65), t)
            cv2.line(exit_shot, (bx1, by1), (bx1, by1 + b_len), (0, 255, 65), t)
            cv2.line(exit_shot, (bx2, by1), (bx2 - b_len, by1), (0, 255, 65), t)
            cv2.line(exit_shot, (bx2, by1), (bx2, by1 + b_len), (0, 255, 65), t)
            cv2.line(exit_shot, (bx1, by2), (bx1 + b_len, by2), (0, 255, 65), t)
            cv2.line(exit_shot, (bx1, by2), (bx1, by2 - b_len), (0, 255, 65), t)
            cv2.line(exit_shot, (bx2, by2), (bx2 - b_len, by2), (0, 255, 65), t)
            cv2.line(exit_shot, (bx2, by2), (bx2, by2 - b_len), (0, 255, 65), t)

            # 3. Plate badge with plate number
            label = f"{safe_plate} [REGISTERED]"
            (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
            label_y = max(lh + 8, by1 - 8)
            cv2.rectangle(exit_shot, (bx1, label_y - lh - 6), (bx1 + lw + 12, label_y + 4), (12, 14, 18), -1)
            cv2.rectangle(exit_shot, (bx1, label_y - lh - 6), (bx1 + lw + 12, label_y + 4), (0, 255, 65), 1)
            cv2.putText(exit_shot, label, (bx1 + 6, label_y - 1),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 65), 2, cv2.LINE_AA)

        filename = f"{timestamp}_{safe_plate}_exit.jpg"
        exit_path = os.path.join(EXIT_CAPTURES_DIR, filename)

        cv2.imwrite(exit_path, exit_shot, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
        try:
            cv2.imwrite(os.path.join(WEB_EXIT_CAPTURES_DIR, filename), exit_shot, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
        except Exception:
            pass

        print(f"📸 [EXIT REGISTERED VEHICLE CAPTURED] One shot saved: captured_images/Exit Capture/{filename}")
        return exit_path
    except Exception as e:
        print(f"Error saving exit registered capture: {e}")
        return None

def save_vehicle_and_plate_capture(frame, plate_box, plate_number, direction="IN"):
    if direction.upper() in ("OUT", "EXIT"):
        # For EXIT, single shot is handled strictly in save_exit_registered_capture for registered vehicles only
        return None, None
    """
    Captures and saves:
    1. Full vehicle/car frame: <TIMESTAMP>_<PLATE>_<DIRECTION>_car.jpg
    2. Cropped plate image:   <TIMESTAMP>_<PLATE>_<DIRECTION>_plate.jpg
    Inside the dedicated 'captured_images/Entrance Capture' folder with timestamped filenames.
    """
    if frame is None:
        return None, None

    try:
        now = datetime.now()
        timestamp = now.strftime("%Y-%m-%d_%H-%M-%S")
        safe_plate = re.sub(r'[^A-Za-z0-9]', '', str(plate_number)).upper() or "UNKNOWN"

        os.makedirs(ENTRANCE_CAPTURES_DIR, exist_ok=True)
        os.makedirs(WEB_ENTRANCE_CAPTURES_DIR, exist_ok=True)

        car_filename = f"{timestamp}_{safe_plate}_{direction}_car.jpg"
        plate_filename = f"{timestamp}_{safe_plate}_{direction}_plate.jpg"

        car_path = os.path.join(ENTRANCE_CAPTURES_DIR, car_filename)
        plate_path = os.path.join(ENTRANCE_CAPTURES_DIR, plate_filename)

        # 1. Save full vehicle/car frame (high quality)
        cv2.imwrite(car_path, frame, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
        try:
            cv2.imwrite(os.path.join(WEB_ENTRANCE_CAPTURES_DIR, car_filename), frame, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
        except Exception:
            pass

        # 2. Crop and save license plate image
        h, w = frame.shape[:2]
        if plate_box and len(plate_box) == 4:
            bx1, by1, bx2, by2 = plate_box
            pad_x = max(6, int((bx2 - bx1) * 0.12))
            pad_y = max(6, int((by2 - by1) * 0.15))
            x1 = max(0, bx1 - pad_x)
            y1 = max(0, by1 - pad_y)
            x2 = min(w, bx2 + pad_x)
            y2 = min(h, by2 + pad_y)
            cropped_plate = frame[y1:y2, x1:x2]
        else:
            cropped_plate = frame[int(h * 0.35):int(h * 0.75), int(w * 0.25):int(w * 0.75)]

        if cropped_plate is not None and cropped_plate.size > 0:
            cv2.imwrite(plate_path, cropped_plate, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
            try:
                cv2.imwrite(os.path.join(WEB_ENTRANCE_CAPTURES_DIR, plate_filename), cropped_plate, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
            except Exception:
                pass

        print(f"📸 [IMAGE SAVED] Car:   captured_images/Entrance Capture/{car_filename}")
        print(f"🔍 [IMAGE SAVED] Plate: captured_images/Entrance Capture/{plate_filename}")
        return car_path, plate_path
    except Exception as e:
        print(f"Error saving vehicle captures: {e}")
        return None, None

_OCR_EQUIV_GROUPS = [
    set("0OQD"),
    set("1ILT"),
    set("5S"),
    set("8B"),
    set("2Z"),
    set("6G"),
]

def _is_ocr_equivalent_char(c1, c2):
    if c1 == c2:
        return True
    for grp in _OCR_EQUIV_GROUPS:
        if c1 in grp and c2 in grp:
            return True
    return False

def _match_in_local_whitelist(norm_key, candidates):
    """
    0ms in-memory lookup against authorized_whitelist.
    Checks exact match, OCR variant matches, and 1-char OCR-confusion fuzzy match.
    """
    with whitelist_lock:
        if not authorized_whitelist:
            return False, norm_key, None

        # 1. Exact match
        if norm_key in authorized_whitelist:
            return True, norm_key, authorized_whitelist[norm_key]

        # 2. OCR disambiguated variants match
        for cand in candidates:
            cand_key = clean_plate_text(cand)
            if cand_key in authorized_whitelist:
                return True, cand_key, authorized_whitelist[cand_key]

        # 3. 1-character OCR confusion match for plates >= 5 chars
        if len(norm_key) >= 5:
            for wl_plate, wl_info in authorized_whitelist.items():
                if len(wl_plate) != len(norm_key):
                    continue
                diffs = 0
                ocr_compat = True
                for a, b in zip(norm_key, wl_plate):
                    if a != b:
                        diffs += 1
                        if diffs > 1 or not _is_ocr_equivalent_char(a, b):
                            ocr_compat = False
                            break
                if diffs == 1 and ocr_compat:
                    return True, wl_plate, wl_info

    return False, norm_key, None

def sync_authorized_whitelist(initial=False):
    """
    Fetches all active authorized plates from Laravel (/api/gate/authorized-plates)
    and stores them in local RAM for 0ms database lookup.
    """
    global authorized_whitelist, whitelist_synced, API_BASE_URL
    candidate_bases = [API_BASE_URL]
    for alt in ["http://127.0.0.1:8080/api", "http://localhost:8080/api", "http://127.0.0.1:8000/api"]:
        if alt not in candidate_bases:
            candidate_bases.append(alt)

    for base in candidate_bases:
        url = f"{base}/gate/authorized-plates"
        try:
            response = http_session.get(url, headers=headers, timeout=3)
            if response.status_code == 200:
                payload = response.json()
                plates_map = payload.get("plates")
                if isinstance(plates_map, dict):
                    normalized_map = {}
                    for k, v in plates_map.items():
                        clean_k = clean_plate_text(k)
                        if clean_k:
                            normalized_map[clean_k] = v
                    prev_count = len(authorized_whitelist)
                    with whitelist_lock:
                        authorized_whitelist = normalized_map
                        whitelist_synced = True
                    API_BASE_URL = base
                    if initial or len(normalized_map) != prev_count:
                        print(f"[Whitelist Sync] Synced {len(normalized_map)} authorized plates into local memory (0ms lookup active).")
                    return True
        except Exception:
            pass
    return False

def whitelist_sync_thread():
    """Background thread that keeps the local plate whitelist synchronized every 10 seconds."""
    while running:
        time.sleep(WHITELIST_SYNC_INTERVAL)
        if not running:
            break
        sync_authorized_whitelist(initial=False)

def check_plate_in_database(plate_number, allow_network=True):
    """
    Checks whether a plate (or its OCR-disambiguated variants) is authorized.
    1. First checks the local in-memory whitelist (0ms lookup).
    2. Falls back to in-memory cache + HTTP check only if the whitelist has not synced yet.
    Returns (registered: bool, canonical_plate: str, db_data: dict | None).
    """
    if not plate_number:
        return False, plate_number, None

    norm_key = clean_plate_text(plate_number)
    if not norm_key:
        return False, plate_number, None

    candidates = generate_plate_variants(norm_key)
    if norm_key not in candidates:
        candidates.insert(0, norm_key)

    # Fast Path: 0ms Local Whitelist Lookup in RAM
    if whitelist_synced:
        matched, canonical_plate, wl_data = _match_in_local_whitelist(norm_key, candidates)
        if matched:
            return True, canonical_plate, wl_data
        return False, norm_key, None

    # Fallback if whitelist hasn't synced yet
    if not token:
        return False, plate_number, None

    now_ts = time.time()
    cached = db_plate_cache.get(norm_key)
    if cached and (now_ts - cached["ts"]) < 60.0:
        return cached["registered"], cached["canonical_plate"], cached["data"]

    if not allow_network:
        return False, plate_number, None

    check_url = f"{API_BASE_URL}/gate/check-plate"
    for cand in candidates:
        cand_key = clean_plate_text(cand)
        cand_cached = db_plate_cache.get(cand_key)
        if cand_cached and (now_ts - cand_cached["ts"]) < 60.0:
            if cand_cached["registered"]:
                return cand_cached["registered"], cand_cached["canonical_plate"], cand_cached["data"]
            continue
        try:
            response = http_session.get(
                check_url,
                params={"plate_number": cand},
                headers=headers,
                timeout=2.5,
            )
            if response.status_code == 200:
                res_data = response.json()
                if res_data.get("registered"):
                    db_plate = clean_plate_text(res_data.get("plate_number") or cand) or cand
                    entry = {
                        "registered": True,
                        "canonical_plate": db_plate,
                        "data": res_data,
                        "ts": now_ts,
                    }
                    db_plate_cache[norm_key] = entry
                    db_plate_cache[cand_key] = entry
                    db_plate_cache[db_plate] = entry
                    return True, db_plate, res_data
                else:
                    db_plate_cache[cand_key] = {
                        "registered": False,
                        "canonical_plate": cand,
                        "data": None,
                        "ts": now_ts,
                    }
        except Exception:
            pass

    db_plate_cache[norm_key] = {
        "registered": False,
        "canonical_plate": plate_number,
        "data": None,
        "ts": now_ts,
    }
    return False, plate_number, None

def verify_plate_with_laravel(plate_number, direction="IN", image_bytes=None):
    verify_url = f"{API_BASE_URL}/gate/verify"
    data = {
        "plate_number": plate_number,
        "direction": direction
    }
    files = {}
    if image_bytes:
        files = {
            "capture_image": ("capture.jpg", image_bytes, "image/jpeg")
        }
    print(f"Verifying plate '{plate_number}' with Laravel API...")
    try:
        req_headers = headers.copy()
        if "Content-Type" in req_headers:
            del req_headers["Content-Type"]
        if files:
            response = requests.post(verify_url, data=data, files=files, headers=req_headers, timeout=10)
        else:
            response = requests.post(verify_url, json=data, headers=headers, timeout=5)
            
        if response.status_code == 200:
            res_data = response.json()
            authorized = res_data.get("authorized", False)
            laravel_gate_status = res_data.get("gate_status", "closed")
            print(
                f"API Result: Authorized={authorized}, Gate Status={laravel_gate_status}, "
                f"Direction={res_data.get('direction')}, Command={res_data.get('gate_command')}"
            )
            return res_data
        else:
            print(f"Verification request failed (HTTP {response.status_code}): {response.text}")
            return None
    except Exception as e:
        print(f"Network error during plate verification: {e}")
        return None

def process_plate_verification(plate_number, frame=None, direction="IN", plate_box=None):
    image_bytes = None
    is_exit = (direction or "").upper() in ("OUT", "EXIT")
    resolved_dir = "OUT" if is_exit else "IN"
    gate_opened_from_whitelist = False

    # 1. Instant 0ms Local Whitelist Check -> Open Gate Immediately Before Network Upload!
    if whitelist_synced:
        is_local_auth, local_canonical, local_info = check_plate_in_database(plate_number, allow_network=False)
        if is_local_auth and local_info:
            plate_number = local_canonical or plate_number
            owner = local_info.get("resident_name") or "Authorized Resident"
            car_info = f"{local_info.get('car_model') or ''} {local_info.get('car_color') or ''}".strip()
            entry_ts = datetime.now().strftime("%Y-%m-%d %I:%M:%S %p")
            now_ts = time.time()

            with detection_lock:
                cache_entry = {
                    "authorized": True,
                    "resident": owner,
                    "car": car_info,
                    "car_model": local_info.get("car_model"),
                    "car_color": local_info.get("car_color"),
                    "logged_at": entry_ts,
                    "timestamp": now_ts,
                }
                verification_cache.setdefault(direction, {})[plate_number] = cache_entry
                det = active_detections.get(direction)
                if det:
                    det["plate"] = plate_number
                    det["authorized"] = True
                    det["resident"] = owner
                    det["car"] = car_info
                    det["logged_at"] = entry_ts

            gate_cmd = 'X' if resolved_dir == 'OUT' else 'O'
            action_label = "EXIT" if resolved_dir == "OUT" else "ENTRY"
            print(f"========================================================")
            print(f" [0ms WHITELIST MATCH - {action_label}] Plate: {plate_number} | Owner: {owner}")
            print(f" [TIMESTAMP] {entry_ts} | Gate: {resolved_dir} -> OPENING IMMEDIATELY ('{gate_cmd}')")
            print(f"========================================================")
            trigger_gate_access_cycle(gate_cmd, hold_seconds=GATE_AUTO_CLOSE_DELAY)
            gate_opened_from_whitelist = True

    if frame is not None and LPR_AVAILABLE:
        # Entrance only: save car and plate captures as usual
        if not is_exit:
            save_vehicle_and_plate_capture(frame, plate_box, plate_number, direction=direction)
        elif gate_opened_from_whitelist:
            save_exit_registered_capture(frame, plate_box, plate_number)

        try:
            # Lightweight upload (~35KB instead of 2.5MB) to prevent PHP timeout on verification
            up_frame = frame
            h, w = frame.shape[:2]
            if w > 800:
                up_frame = cv2.resize(frame, (800, int(h * (800.0 / w))), interpolation=cv2.INTER_AREA)
            success, encoded = cv2.imencode('.jpg', up_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
            if success:
                image_bytes = encoded.tobytes()
        except Exception as e:
            print(f"Error encoding frame for plate verification: {e}")

    result = verify_plate_with_laravel(plate_number, direction=direction, image_bytes=image_bytes)
    now_ts = time.time()
    if not result:
        if gate_opened_from_whitelist:
            return
        print(f"ACCESS DENIED for plate: {plate_number}")
        entry_ts = datetime.now().strftime("%Y-%m-%d %I:%M:%S %p")
        with detection_lock:
            verification_cache.setdefault(direction, {})[plate_number] = {
                "authorized": False,
                "resident": None,
                "car": None,
                "logged_at": entry_ts,
                "timestamp": now_ts,
            }
            if active_detections.get(direction) and active_detections[direction].get("plate") == plate_number:
                active_detections[direction]["authorized"] = False
                active_detections[direction]["logged_at"] = entry_ts
        return

    authorized = result.get("authorized", False) or gate_opened_from_whitelist
    canonical_plate = clean_plate_text(result.get("plate_number") or plate_number) or plate_number
    owner = result.get("resident_name") or result.get("owner_name") or "Unknown"
    car_info = f"{result.get('car_model', '')} {result.get('car_color', '')}".strip()
    entry_ts = result.get("entry_timestamp") or datetime.now().strftime("%Y-%m-%d %I:%M:%S %p")

    with detection_lock:
        cache_entry = {
            "authorized": authorized,
            "resident": owner if owner != "Unknown" else None,
            "car": car_info,
            "car_model": result.get("car_model"),
            "car_color": result.get("car_color"),
            "logged_at": entry_ts,
            "timestamp": now_ts,
        }
        verification_cache.setdefault(direction, {})[plate_number] = cache_entry
        verification_cache.setdefault(direction, {})[canonical_plate] = cache_entry

        det = active_detections.get(direction)
        if det and det.get("plate") in (plate_number, canonical_plate):
            det["plate"] = canonical_plate
            det["authorized"] = authorized
            det["resident"] = cache_entry["resident"]
            det["car"] = car_info
            det["logged_at"] = entry_ts

    if authorized and not gate_opened_from_whitelist:
        resolved_direction = (result.get("direction") or direction or "IN").upper()

        # FOR EXIT ONLY: Capture one shot with vehicle and rectangle shape plate for REGISTERED vehicle
        if is_exit and frame is not None:
            save_exit_registered_capture(frame, plate_box, canonical_plate)

        gate_command = result.get("gate_command") or ('O' if resolved_direction == 'IN' else 'X')
        action_label = "ENTRY" if resolved_direction == "IN" else "EXIT"
        print(f"========================================================")
        print(f" [{action_label} RECORDED] Plate: {canonical_plate} | Owner: {owner}")
        print(f" [TIMESTAMP] {entry_ts} | Gate: {resolved_direction} -> OPENING ('{gate_command}')")
        print(f"========================================================")
        trigger_gate_access_cycle(gate_command, hold_seconds=GATE_AUTO_CLOSE_DELAY)
    elif not authorized:
        print(f"ACCESS DENIED for plate: {plate_number} at {entry_ts}")

def draw_anpr_hud(frame, direction):
    """
    Renders real-time Computer Vision HUD onto video frame at 15 FPS:
    - Glowing bounding boxes around recognized license plates with corner brackets
    - Plate recognition HUD card with plate number, accuracy %, and authorization status
    - 15 FPS Live Status bar, scanning reticle, and real-time timestamp
    """
    if frame is None:
        return None

    display_frame = frame.copy()
    h, w = display_frame.shape[:2]
    now = time.time()

    # 1. Top HUD Bar - in-place blend on top 36 pixels only (saves 98% memory copy)
    top_bar_h = min(36, h)
    top_roi = display_frame[0:top_bar_h, 0:w]
    dark_bar = np.full_like(top_roi, (15, 17, 21))
    cv2.addWeighted(dark_bar, 0.85, top_roi, 0.15, 0, top_roi)

    # Blinking Live Dot
    dot_color = (0, 255, 65) if int(now * 2) % 2 == 0 else (0, 180, 50)
    cv2.circle(display_frame, (18, 18), 6, dot_color, -1)

    dir_label = "ENTRANCE (IN)" if direction.upper() == "IN" else "EXIT (OUT)"
    cv2.putText(display_frame, f"LIVE 15 FPS | {dir_label}", (32, 23),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)

    # Timestamp
    time_str = time.strftime("%Y-%m-%d %H:%M:%S")
    cv2.putText(display_frame, time_str, (max(10, w - 180), 23),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (200, 200, 200), 1, cv2.LINE_AA)

    # 2. Check Active Detection
    det = None
    with detection_lock:
        stored = active_detections.get(direction)
        if stored and (now - stored["timestamp"]) < 3.5:
            det = dict(stored)

    if det and det.get("box"):
        bx1, by1, bx2, by2 = det["box"]
        bx1 = max(0, min(w - 1, bx1))
        by1 = max(0, min(h - 1, by1))
        bx2 = max(0, min(w - 1, bx2))
        by2 = max(0, min(h - 1, by2))

        if det.get("authorized") is True:
            accent_color = (0, 255, 65)    # Neon Green
            status_text = "AUTHORIZED (GATE OPEN)"
        elif det.get("authorized") is False:
            accent_color = (50, 50, 255)   # Vibrant Red
            status_text = "ACCESS DENIED (UNAUTHORIZED)"
        else:
            accent_color = (0, 215, 255)   # Cyber Yellow
            status_text = "VERIFYING WITH DATABASE..."

        # Translucent plate fill on ROI only (avoids copying full 1080p frame)
        plate_roi = display_frame[by1:by2, bx1:bx2]
        if plate_roi.size > 0:
            plate_tint = np.full_like(plate_roi, accent_color)
            cv2.addWeighted(plate_tint, 0.22, plate_roi, 0.78, 0, plate_roi)

        # Border
        cv2.rectangle(display_frame, (bx1, by1), (bx2, by2), accent_color, 2)

        # Corner brackets
        b_len = max(8, min(22, int((bx2 - bx1) * 0.2)))
        t = 3
        cv2.line(display_frame, (bx1, by1), (bx1 + b_len, by1), accent_color, t)
        cv2.line(display_frame, (bx1, by1), (bx1, by1 + b_len), accent_color, t)
        cv2.line(display_frame, (bx2, by1), (bx2 - b_len, by1), accent_color, t)
        cv2.line(display_frame, (bx2, by1), (bx2, by1 + b_len), accent_color, t)
        cv2.line(display_frame, (bx1, by2), (bx1 + b_len, by2), accent_color, t)
        cv2.line(display_frame, (bx1, by2), (bx1, by2 - b_len), accent_color, t)
        cv2.line(display_frame, (bx2, by2), (bx2 - b_len, by2), accent_color, t)
        cv2.line(display_frame, (bx2, by2), (bx2, by2 - b_len), accent_color, t)

        # Floating HUD Badge
        has_logged_at = bool(det.get("logged_at"))
        card_w = max(280, bx2 - bx1 + 80)
        card_h = 74 if has_logged_at else 56
        card_x = max(10, min(w - card_w - 10, bx1 - 20))
        card_y = (by1 - card_h - 10) if (by1 - card_h - 10 > 40) else min(h - card_h - 30, by2 + 10)

        card_roi = display_frame[card_y:card_y + card_h, card_x:card_x + card_w]
        if card_roi.size > 0:
            card_bg = np.full_like(card_roi, (12, 14, 18))
            cv2.addWeighted(card_bg, 0.88, card_roi, 0.12, 0, card_roi)
        cv2.rectangle(display_frame, (card_x, card_y), (card_x + card_w, card_y + card_h), accent_color, 1)

        plate_str = det.get("plate", "SCANNING")
        conf_pct = int(det.get("confidence", 0.0) * 100)
        cv2.putText(display_frame, f"PLATE: {plate_str}", (card_x + 10, card_y + 22),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2, cv2.LINE_AA)
        cv2.putText(display_frame, f"{conf_pct}% AI CONF", (card_x + card_w - 95, card_y + 22),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.42, accent_color, 1, cv2.LINE_AA)

        info_sub = status_text
        if det.get("resident") or det.get("car"):
            resident_part = det.get("resident") or ""
            car_part = det.get("car") or ""
            info_sub = f"{resident_part} | {car_part}".strip(" |")

        cv2.putText(display_frame, info_sub, (card_x + 10, card_y + 43),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.44, accent_color, 1, cv2.LINE_AA)

        if has_logged_at:
            cv2.putText(display_frame, f"LOGGED: {det.get('logged_at')}", (card_x + 10, card_y + 62),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.40, (200, 220, 200), 1, cv2.LINE_AA)

    else:
        # Idle: Clean full screen view without scanning reticle overlay
        pass

    bot_y = h - 12
    cv2.putText(display_frame, f"GATE STATE: {gate_state.upper()} | ANPR: FULL SCREEN SCAN", (15, bot_y),
                cv2.FONT_HERSHEY_SIMPLEX, 0.42, (200, 200, 200), 1, cv2.LINE_AA)

    return display_frame

lpr_busy = {"IN": False, "OUT": False}

def _evaluate_ocr_detections(results, ocr_scale, frame_w, frame_h, direction):
    """
    Evaluate raw and adjacently-merged EasyOCR detections from a full frame,
    filtering out HUD zones, OSD words, and invalid formats, and returning the
    best valid candidate (plate, variants, conf, [bx1, by1, bx2, by2], raw_text).
    """
    best_plate = None
    best_variants = []
    best_conf = 0.0
    best_box = None
    best_raw = None

    inv_scale = 1.0 / ocr_scale
    merged_results = merge_adjacent_ocr_boxes(results)

    for (bbox, text, prob) in merged_results:
        bx1 = int(min(pt[0] for pt in bbox) * inv_scale)
        by1 = int(min(pt[1] for pt in bbox) * inv_scale)
        bx2 = int(max(pt[0] for pt in bbox) * inv_scale)
        by2 = int(max(pt[1] for pt in bbox) * inv_scale)

        # Ignore top/bottom HUD bar zones
        if by1 < 36 or by2 > max(40, frame_h - 24):
            continue

        raw_text = text
        cleaned_plate = clean_plate_text(text)

        if is_ignored_osd_text(text) or is_ignored_osd_text(cleaned_plate):
            continue

        if len(cleaned_plate) < 4 or len(cleaned_plate) > 8:
            continue

        # Check 0ms local whitelist first so registered plates are never rejected or outranked by noise
        is_wl_match, wl_canon, _ = check_plate_in_database(cleaned_plate, allow_network=False)
        min_conf = 0.30 if is_wl_match else CONFIDENCE_THRESHOLD

        if prob < min_conf:
            print(f"[{direction} LPR Scan] Raw: '{raw_text}' -> Normalized: '{cleaned_plate}' | Conf: {prob:.2f} | Rejected (Low confidence)")
            continue

        variants = generate_plate_variants(cleaned_plate)
        if is_wl_match and wl_canon and wl_canon not in variants:
            variants.insert(0, wl_canon)
        if not variants:
            print(f"[{direction} LPR Scan] Raw: '{raw_text}' -> Normalized: '{cleaned_plate}' | Conf: {prob:.2f} | Rejected (Invalid PH plate format)")
            continue

        chosen_plate = wl_canon if (is_wl_match and wl_canon) else variants[0]
        effective_score = (prob + 1.0) if is_wl_match else prob
        if effective_score > best_conf:
            best_plate = chosen_plate
            best_variants = variants
            best_conf = effective_score
            best_box = [max(0, bx1), max(0, by1), min(frame_w - 1, bx2), min(frame_h - 1, by2)]
            best_raw = raw_text

    if best_conf > 1.0:
        best_conf -= 1.0
    return best_plate, best_variants, best_conf, best_box, best_raw


def process_ocr_thread(frame, reader, direction):
    global last_scanned_plates, lpr_busy, last_plate_seen_time, last_ocr_time
    dir_lock = lpr_locks.get(direction, lpr_lock)
    try:
        h, w = frame.shape[:2]
        # Scale full frame to max width 1280 to preserve distant plate detail across the whole CCTV view
        ocr_scale = 1.0
        if w > 1280:
            ocr_scale = 1280.0 / w
            ocr_w = 1280
            ocr_h = int(h * ocr_scale)
            ocr_frame = cv2.resize(frame, (ocr_w, ocr_h), interpolation=cv2.INTER_AREA)
        else:
            ocr_frame = frame

        # CLAHE contrast enhancement for full-frame recognition across varying lighting
        gray_full = cv2.cvtColor(ocr_frame, cv2.COLOR_BGR2GRAY)
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        enhanced_full = clahe.apply(gray_full)

        with dir_lock:
            results = reader.readtext(enhanced_full, allowlist='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- ')

        best_plate, best_variants, best_conf, best_box, best_raw = _evaluate_ocr_detections(
            results, ocr_scale, w, h, direction
        )

        # Skip fallback crops if full-frame already matched a registered plate in the local whitelist
        already_whitelisted = bool(best_plate and check_plate_in_database(best_plate, allow_network=False)[0])

        # Fallback: inspect top 2 cropped plate candidate regions if full frame didn't find a high-confidence or whitelisted plate
        if not already_whitelisted and (best_plate is None or best_conf < 0.65):
            regions = detect_full_frame_plate_regions(frame)[:2]
            contour_crop, contour_box = preprocess_plate_contour(frame)
            if contour_box is not None:
                cbx1, cby1, cbx2, cby2 = contour_box
                if cbx2 > cbx1 and cby2 > cby1:
                    regions.insert(0, (cbx1, cby1, cbx2, cby2))
                    regions = regions[:2]

            for (rx1, ry1, rx2, ry2) in regions:
                if ry1 < 36 or ry2 > max(40, h - 24):
                    continue
                crop = frame[ry1:ry2, rx1:rx2]
                if crop is None or crop.size == 0:
                    continue
                crop_gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
                crop_up = cv2.resize(crop_gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
                crop_enh = clahe.apply(crop_up)

                with dir_lock:
                    crop_results = reader.readtext(crop_enh, allowlist='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- ')

                for (cbbox, ctext, cprob) in merge_adjacent_ocr_boxes(crop_results):
                    cclean = clean_plate_text(ctext)
                    if is_ignored_osd_text(ctext) or is_ignored_osd_text(cclean):
                        continue
                    if len(cclean) < 4 or len(cclean) > 8 or cprob < CONFIDENCE_THRESHOLD:
                        continue
                    cvariants = generate_plate_variants(cclean)
                    if not cvariants:
                        continue
                    if cprob > best_conf:
                        best_plate = cvariants[0]
                        best_variants = cvariants
                        best_conf = cprob
                        best_box = [rx1, ry1, rx2, ry2]
                        best_raw = ctext

        if best_plate is None or best_box is None:
            return

        current_time = time.time()
        last_plate_seen_time = current_time

        # Resolve against local whitelist / database immediately (0ms via whitelist, or HTTP fallback)
        is_db_reg, canonical_db_plate, db_info = check_plate_in_database(
            best_plate, allow_network=True
        )
        if is_db_reg and canonical_db_plate:
            best_plate = canonical_db_plate

        # Multi-frame tracking
        candidates = plate_candidates[direction]
        stale_keys = [k for k, v in candidates.items() if (current_time - v["last_seen"]) > PLATE_CANDIDATE_TIMEOUT]
        for k in stale_keys:
            del candidates[k]

        if best_plate in candidates:
            candidates[best_plate]["count"] += 1
            candidates[best_plate]["last_seen"] = current_time
        else:
            candidates[best_plate] = {"count": 1, "last_seen": current_time}

        confirmed_count = candidates[best_plate]["count"]

        # Check verification cache so HUD keeps verified green state instead of resetting to yellow
        cached_ver = None
        with detection_lock:
            dir_cache = verification_cache.get(direction, {})
            for key_cand in [best_plate] + best_variants:
                entry = dir_cache.get(key_cand)
                if entry and (current_time - entry["timestamp"]) <= COOLDOWN_PERIOD:
                    cached_ver = entry
                    break

            active_detections[direction] = {
                "plate": best_plate,
                "raw_text": best_raw,
                "confidence": best_conf,
                "box": best_box,
                "timestamp": current_time,
                "authorized": cached_ver["authorized"] if cached_ver else (True if is_db_reg else None),
                "resident": (cached_ver["resident"] if cached_ver else (db_info.get("resident_name") if db_info else None)),
                "car": (cached_ver["car"] if cached_ver else (f"{db_info.get('car_model', '')} {db_info.get('car_color', '')}".strip() if db_info else None)),
                "logged_at": cached_ver["logged_at"] if cached_ver else None,
            }

        # Registered plates in the database/whitelist open the gate immediately on the 1st frame!
        # Only unknown/unregistered plates require PLATE_CONFIRM_FRAMES (2 frames) before logging ACCESS DENIED.
        if not is_db_reg and confirmed_count < PLATE_CONFIRM_FRAMES:
            print(f"[{direction} Multi-Frame] Unregistered candidate '{best_plate}' seen {confirmed_count}/{PLATE_CONFIRM_FRAMES} frames. Awaiting confirmation...")
            return

        print(f"\n[{direction} LPR CONFIRMED] Plate: {best_plate} | Conf: {best_conf:.2f} | Registered: {is_db_reg}")

        if is_gate_cycling:
            return

        cache_key = f"{best_plate}_{direction}"
        if (cache_key not in last_scanned_plates or
                (current_time - last_scanned_plates[cache_key]) > COOLDOWN_PERIOD):
            last_scanned_plates[cache_key] = current_time
            candidates[best_plate]["count"] = 0

            print(f"\n[LPR Detected] Plate: {best_plate} | Gate: {direction} (Confidence: {best_conf:.2f})")

            frame_copy = frame.copy()
            verify_thread = threading.Thread(
                target=process_plate_verification,
                args=(best_plate, frame_copy, direction, best_box)
            )
            verify_thread.daemon = True
            verify_thread.start()
    except Exception as e:
        print(f"LPR frame processing error ({direction} gate): {e}")
    finally:
        lpr_busy[direction] = False

def process_lpr_frame(frame, reader, direction):
    global last_scanned_plates, lpr_busy, last_frame_save_time, last_disk_save_time, last_ocr_time
    if frame is None:
        return

    current_time = time.time()

    # 1. Render and encode live stream frame at target 15 FPS
    if (current_time - last_frame_save_time.get(direction, 0.0)) >= FRAME_INTERVAL:
        last_frame_save_time[direction] = current_time
        try:
            annotated = draw_anpr_hud(frame, direction)
            if annotated is not None:
                # Downscale stream to max 1024px for ultra-low browser CPU decode and low network bandwidth
                h, w = annotated.shape[:2]
                if w > 1024:
                    new_w = 1024
                    new_h = int(h * (1024.0 / w))
                    save_frame = cv2.resize(annotated, (new_w, new_h), interpolation=cv2.INTER_AREA)
                else:
                    save_frame = annotated

                # Encode with 70 quality (lightweight ~35-45KB per frame, reduces browser decode CPU by 50%)
                success, enc = cv2.imencode('.jpg', save_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
                if success:
                    jpeg_bytes = enc.tobytes()
                    with stream_frame_lock:
                        latest_stream_jpeg[direction] = jpeg_bytes

                    # Write to disk only once every 1.0 second (eliminates 93% of disk writes and AV locks)
                    if (current_time - last_disk_save_time.get(direction, 0.0)) >= DISK_SAVE_INTERVAL:
                        last_disk_save_time[direction] = current_time
                        filename = "camera_entrance.jpg" if direction.upper() == "IN" else "camera_exit.jpg"
                        script_dir = os.path.dirname(os.path.abspath(__file__))
                        storage_path = os.path.abspath(os.path.join(script_dir, "../server/public", filename))
                        os.makedirs(os.path.dirname(storage_path), exist_ok=True)
                        tmp_path = storage_path + ".tmp"
                        try:
                            with open(tmp_path, 'wb') as f:
                                f.write(enc)
                            os.replace(tmp_path, storage_path)
                        except Exception:
                            pass
        except Exception:
            pass

    # 2. Run OCR in background with smart motion-gating & throttling
    if not lpr_busy.get(direction, False) and reader is not None and LPR_AVAILABLE:
        time_since_ocr = current_time - last_ocr_time.get(direction, 0.0)
        if time_since_ocr >= OCR_MIN_INTERVAL:
            motion_active = detect_motion(frame, direction)
            # Run OCR if there's motion/vehicle activity, or periodically every 2.0s to confirm standing cars
            if motion_active or time_since_ocr >= 2.0:
                last_ocr_time[direction] = current_time
                lpr_busy[direction] = True
                t = threading.Thread(target=process_ocr_thread, args=(frame.copy(), reader, direction))
                t.daemon = True
                t.start()


# ==========================================
# NATIVE MJPEG LIVE STREAMING HTTP SERVER
# ==========================================
stream_frame_lock = threading.Lock()
latest_stream_jpeg = {"IN": None, "OUT": None}

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def handle_error(self, request, client_address):
        """Silently ignore disconnected socket / aborted connection errors from clients closing stream."""
        exc_type, exc_val = sys.exc_info()[:2]
        if exc_type in (ConnectionResetError, ConnectionAbortedError, BrokenPipeError, ConnectionError):
            return
        if isinstance(exc_val, (socket.error, OSError)):
            # WinError 10053 (WSAECONNABORTED), 10054 (WSAECONNRESET), 10038 (WSAENOTSOCK)
            # errno 32 (EPIPE), 104 (ECONNRESET), 103 (ECONNABORTED)
            if getattr(exc_val, 'winerror', None) in (10053, 10054, 10038) or getattr(exc_val, 'errno', None) in (32, 104, 103):
                return
        super().handle_error(request, client_address)

class MJPEGStreamHandler(BaseHTTPRequestHandler):
    """
    Ultra-low-latency MJPEG live stream server.
    Serves /stream directly to web browsers for genuine live camera streaming.
    """
    def handle_one_request(self):
        try:
            return super().handle_one_request()
        except (ConnectionError, BrokenPipeError, ConnectionResetError, ConnectionAbortedError, socket.error, OSError):
            self.close_connection = True
        except Exception:
            self.close_connection = True

    def finish(self):
        try:
            if hasattr(self, 'wfile') and self.wfile and not self.wfile.closed:
                self.wfile.flush()
        except Exception:
            pass
        try:
            super().finish()
        except Exception:
            pass

    def do_GET(self):
        try:
            self._handle_get()
        except (ConnectionError, BrokenPipeError, ConnectionResetError, ConnectionAbortedError, socket.error, OSError):
            pass
        except Exception:
            pass

    def _handle_get(self):
        p = self.path.split('?')[0].rstrip('/')
        if p in ('/stream', '/stream/entrance', '/live', ''):
            self.send_response(200)
            self.send_header('Content-Type', 'multipart/x-mixed-replace; boundary=frame')
            self.send_header('Cache-Control', 'no-cache, private, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            while running:
                with stream_frame_lock:
                    frame_bytes = latest_stream_jpeg.get("IN")
                if frame_bytes:
                    try:
                        self.wfile.write(b'--frame\r\n')
                        self.wfile.write(b'Content-Type: image/jpeg\r\n')
                        self.wfile.write(f'Content-Length: {len(frame_bytes)}\r\n\r\n'.encode('ascii'))
                        self.wfile.write(frame_bytes)
                        self.wfile.write(b'\r\n')
                    except (ConnectionError, BrokenPipeError, ConnectionResetError, ConnectionAbortedError, socket.error, OSError):
                        break
                time.sleep(0.066)
        elif p in ('/snapshot', '/camera_entrance.jpg'):
            with stream_frame_lock:
                frame_bytes = latest_stream_jpeg.get("IN")
            if frame_bytes:
                self.send_response(200)
                self.send_header('Content-Type', 'image/jpeg')
                self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(frame_bytes)
            else:
                self.send_response(503)
                self.end_headers()
        elif p in ('/stream/exit', '/stream/out'):
            self.send_response(200)
            self.send_header('Content-Type', 'multipart/x-mixed-replace; boundary=frame')
            self.send_header('Cache-Control', 'no-cache, private, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            while running:
                with stream_frame_lock:
                    frame_bytes = latest_stream_jpeg.get("OUT")
                if frame_bytes:
                    try:
                        self.wfile.write(b'--frame\r\n')
                        self.wfile.write(b'Content-Type: image/jpeg\r\n')
                        self.wfile.write(f'Content-Length: {len(frame_bytes)}\r\n\r\n'.encode('ascii'))
                        self.wfile.write(frame_bytes)
                        self.wfile.write(b'\r\n')
                    except (ConnectionError, BrokenPipeError, ConnectionResetError, ConnectionAbortedError, socket.error, OSError):
                        break
                time.sleep(0.066)
        elif p in ('/snapshot/exit', '/camera_exit.jpg'):
            with stream_frame_lock:
                frame_bytes = latest_stream_jpeg.get("OUT")
            if frame_bytes:
                self.send_response(200)
                self.send_header('Content-Type', 'image/jpeg')
                self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(frame_bytes)
            else:
                self.send_response(503)
                self.end_headers()
        elif p == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b'{"status":"online","fps":15,"camera":"entrance_and_exit"}')
        elif p in ('/detections', '/status'):
            now = time.time()
            payload = {"gate_state": gate_state, "IN": None, "OUT": None}
            with detection_lock:
                for gate_dir in ("IN", "OUT"):
                    stored = active_detections.get(gate_dir)
                    if stored and stored.get("plate") and (now - stored.get("timestamp", 0.0)) < 5.0:
                        payload[gate_dir] = dict(stored)
            with whitelist_lock:
                payload["whitelist_count"] = len(authorized_whitelist)
                payload["whitelist_synced"] = whitelist_synced
            body = json.dumps(payload).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        # Silence console log spam for frame transmissions
        pass

def start_mjpeg_server(host="0.0.0.0", port=5000):
    try:
        server = ThreadedHTTPServer((host, port), MJPEGStreamHandler)
        print(f"[MJPEG Live Server] Native real-time camera stream active at http://localhost:{port}/stream")
        server.serve_forever()
    except Exception as e:
        print(f"[MJPEG Server Notice] Port {port}: {e}")


class RealtimeRTSPCapture:
    """
    Threaded RTSP / Video capture that constantly drains the RTSP buffer
    so that read() ALWAYS returns the freshest, zero-latency real-time frame.
    Prevents accumulated buffer lag where the stream falls minutes behind.
    """
    def __init__(self, source):
        # Configure FFmpeg for ultra-low latency RTSP streaming with packet loss resilience
        os.environ["OPENCV_FFMPEG_LOGLEVEL"] = "-8"  # Silence benign H.264 macroblock packet loss warnings
        os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|buffer_size;1024000|max_delay;500000|fflags;nobuffer"
        self.source = source
        self.cap = cv2.VideoCapture(source, cv2.CAP_FFMPEG)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        self.lock = threading.Lock()
        self.running = True
        self.latest_frame = None
        self.ret = False
        self.opened = self.cap.isOpened()
        if self.opened:
            self.thread = threading.Thread(target=self._drain_loop, daemon=True)
            self.thread.start()

    def _drain_loop(self):
        while self.running:
            if not self.cap.isOpened():
                time.sleep(0.05)
                continue
            ret, frame = self.cap.read()
            if not ret or frame is None:
                with self.lock:
                    self.ret = False
                time.sleep(0.01)
                continue
            with self.lock:
                self.latest_frame = frame
                self.ret = True
            time.sleep(0.003)  # Yield CPU core between frames

    def isOpened(self):
        return self.opened and self.cap.isOpened()

    def read(self):
        with self.lock:
            if not self.ret or self.latest_frame is None:
                return False, None
            return True, self.latest_frame.copy()

    def release(self):
        self.running = False
        try:
            self.cap.release()
        except Exception:
            pass


def lpr_main(camera_source, direction):
    global last_scanned_plates, running
    if not LPR_AVAILABLE:
        print(f"Camera/LPR dependencies unavailable. LPR loop for {direction} gate disabled.")
        while running:
            time.sleep(1)
        return

    reader = None
    cap = None

    while running:
        try:
            if reader is None:
                print(f"\nInitializing EasyOCR Reader for {direction} gate...")
                try:
                    reader = easyocr.Reader(['en'], gpu=True)
                except Exception:
                    print(f"GPU unavailable for EasyOCR ({direction} gate). Falling back to CPU mode.")
                    reader = easyocr.Reader(['en'], gpu=False)
                print(f"EasyOCR for {direction} gate loaded successfully!")

            # Check if source is a web-based MJPEG stream
            use_custom_mjpeg = isinstance(camera_source, str) and (
                camera_source.startswith("http://") or camera_source.startswith("https://")
            )

            if use_custom_mjpeg:
                print(f"Connecting to {direction} MJPEG source via custom HTTP reader: {camera_source}...")
                try:
                    response = requests.get(camera_source, stream=True, timeout=5)
                    if response.status_code != 200:
                        print(f"[ERROR] {direction} Camera at {camera_source} is NOT CONNECTED (HTTP {response.status_code})! Retrying in 5 seconds...")
                        time.sleep(5)
                        continue
                except Exception as e:
                    print(f"[ERROR] {direction} Camera at {camera_source} is OFFLINE / UNREACHABLE! Retrying in 5 seconds...")
                    time.sleep(5)
                    continue

                print(f"[SUCCESS] {direction} Camera at {camera_source} is CONNECTED and active!")
                print(f"\nNextgen Operations LPR Gate Controller (Custom HTTP MJPEG Reader) for {direction} gate is running!")
                bytes_data = bytes()

                # Process MJPEG multipart boundary stream chunk by chunk
                for chunk in response.iter_content(chunk_size=4096):
                    if not running:
                        break
                    bytes_data += chunk
                    
                    # Locate boundaries of JPEG frames (\xff\xd8 and \xff\xd9)
                    while True:
                        a = bytes_data.find(b'\xff\xd8')
                        b = bytes_data.find(b'\xff\xd9')
                        if a != -1 and b != -1 and a < b:
                            jpg_bytes = bytes_data[a:b+2]
                            bytes_data = bytes_data[b+2:]
                            
                            # Decode byte stream into OpenCV frame image
                            try:
                                frame = cv2.imdecode(np.frombuffer(jpg_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
                                if frame is not None:
                                    process_lpr_frame(frame, reader, direction)
                            except Exception:
                                pass
                        else:
                            # Clear older buffered data if it's invalid/corrupt
                            if len(bytes_data) > 65536:
                                bytes_data = bytes_data[-1024:]
                            break
                    time.sleep(0.001)

            else:
                print(f"Connecting to {direction} video source (Zero-Latency RTSP): {camera_source}...")
                cap = RealtimeRTSPCapture(camera_source)
                if not cap.isOpened():
                    print(f"[ERROR] {direction} Video source {camera_source} is OFFLINE / UNREACHABLE! Retrying in 5 seconds...")
                    cap.release()
                    cap = None
                    time.sleep(5)
                    continue

                print(f"[SUCCESS] {direction} Video source {camera_source} is CONNECTED and active!")
                print(f"\nNextgen Operations LPR Gate Controller (Real-time 15 FPS Zero-Latency Stream) for {direction} gate is running!")
                last_save_time = 0
                while running:
                    ret, frame = cap.read()
                    if not ret or frame is None:
                        time.sleep(0.01)
                        continue

                    current_time = time.time()
                    # Limit processing to target 15 FPS
                    if current_time - last_save_time >= FRAME_INTERVAL:
                        process_lpr_frame(frame, reader, direction)
                        last_save_time = current_time
                    else:
                        time.sleep(0.005)

                if cap is not None:
                    cap.release()
                    cap = None

            if running:
                print(f"Camera feed disconnected/stream ended for {direction} gate. Retrying in 5 seconds...")
                time.sleep(5)

        except KeyboardInterrupt:
            print("\nShutdown signal received.")
            running = False
            break
        except Exception as e:
            print(f"Unexpected camera/LPR error: {e}. Retrying in 5 seconds...")
            if cap is not None:
                try:
                    cap.release()
                except Exception:
                    pass
                cap = None
            reader = None
            time.sleep(5)

    try:
        cv2.destroyAllWindows()
    except Exception:
        pass

# ==========================================
# SERIAL READER & SYNC THREADS
# ==========================================
def serial_reader_thread():
    """Background thread that listens for signals sent by the Arduino (e.g. vehicle passed, blocked)."""
    global running, gate_state, entrance_gate_state, exit_gate_state, arduino
    print("Serial reader background thread started.")
    _last_serial_err_time = 0
    _serial_err_count = 0
    
    while running:
        if arduino and arduino.is_open:
            try:
                if arduino.in_waiting > 0:
                    line = arduino.readline().decode('utf-8', errors='ignore').strip()
                    if not line:
                        continue
                    _serial_err_count = 0  # Reset on successful read
                    
                    print(f"[Arduino -> Serial] {line}")
                    
                    if "Gate Open!" in line:
                        gate_opened_event.set()
                        entrance_gate_state = "open"
                        gate_state = "open"
                        sync_gate_status_with_laravel("open")
                    elif "Gate Closed!" in line:
                        gate_closed_event.set()
                        entrance_gate_state = "closed"
                        exit_gate_state = "closed"
                        gate_state = "closed"
                        sync_gate_status_with_laravel("closed")
                    elif line == "PASSED":
                        print("Vehicle successfully passed entrance. Updating gate status to closed...")
                        entrance_gate_state = "closed"
                        gate_state = "closed" if exit_gate_state == "closed" else "open"
                        sync_gate_status_with_laravel("closed")
                    elif line == "EXIT_PASSED":
                        print("Vehicle successfully passed exit. Updating gate status to closed...")
                        exit_gate_state = "closed"
                        gate_state = "closed" if entrance_gate_state == "closed" else "open"
                        sync_gate_status_with_laravel("closed")
                    elif line == "BLOCKED":
                        print("WARNING: Gate close attempt blocked! Vehicle still under the gate.")
                        sync_gate_status_with_laravel("open")
                    elif line.startswith("STATUS:"):
                        status = line.split(":")[1].lower()
                        if status in ["open", "closed"]:
                            gate_state = status
            except Exception as e:
                _serial_err_count += 1
                now = time.time()
                # Rate-limit: only print every 10 seconds or first 3 occurrences
                if _serial_err_count <= 3 or (now - _last_serial_err_time) >= 10:
                    print(f"Serial read error (#{_serial_err_count}): {e}")
                    _last_serial_err_time = now
                # Auto-reconnect after too many consecutive errors
                if _serial_err_count >= 20:
                    print("[Serial] Too many consecutive errors. Attempting reconnect...")
                    try:
                        arduino.close()
                    except Exception:
                        pass
                    arduino = None
                    _serial_err_count = 0
                    time.sleep(3)
                    init_serial()
                else:
                    time.sleep(0.5)
        else:
            time.sleep(0.5)

def dashboard_sync_thread():
    """Background thread to poll Laravel gate status."""
    global running, gate_state
    print("Dashboard status synchronization thread started.")
    status_url = f"{API_BASE_URL}/gate/status"
    
    while running:
        if token:
            try:
                response = http_session.get(status_url, headers=headers, timeout=3)
                if response.status_code == 200:
                    data = response.json()
                    backend_gate_status = data.get("gate_status", "closed")
                    
                    if not is_gate_cycling and backend_gate_status != gate_state:
                        print(f"Dashboard state mismatch! Backend: {backend_gate_status.upper()}, Local: {gate_state.upper()}")
                        if backend_gate_status == "open":
                            send_arduino_command('O')
                        else:
                            send_arduino_command('C')
                            send_arduino_command('Z')
            except Exception:
                pass
        time.sleep(3)

# ==========================================
# MAIN ENTRYPOINT
# ==========================================
if __name__ == "__main__":
    print("==================================================")
    print("  Nextgen Operations - Gate LPR Bridge Service  ")
    print("==================================================")
    
    # 1. Initialize Serial Communication with Arduino
    init_serial()
    
    # Optional Gate Startup Test: If --test-gate argument or TEST_GATE_ON_STARTUP=1 is provided
    if "--test-gate" in sys.argv or os.environ.get("TEST_GATE_ON_STARTUP", "0").lower() in ["1", "true", "yes"]:
        print("\n[STARTUP] Running initial test: Testing OPEN and CLOSE of barrier gate...")
        send_arduino_command('O')
        time.sleep(4)
        send_arduino_command('C')
        time.sleep(4)
        print("[STARTUP] Gate test cycle complete. Gate is safely CLOSED.\n")
    else:
        # Always ensure gate is in CLOSED state when service starts
        print("[Startup] Ensuring barrier gate is in CLOSED position...")
        send_arduino_command('C')

    # 2. Login to Laravel Backend & Sync Local Whitelist
    login_to_laravel()
    sync_authorized_whitelist(initial=True)
    sync_gate_status_with_laravel("closed")
    
    # 3. Start Background Threads
    reader_t = threading.Thread(target=serial_reader_thread)
    reader_t.daemon = True
    reader_t.start()
    
    sync_t = threading.Thread(target=dashboard_sync_thread)
    sync_t.daemon = True
    sync_t.start()

    wl_t = threading.Thread(target=whitelist_sync_thread)
    wl_t.daemon = True
    wl_t.start()

    # Clean up stale camera_exit.jpg
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        exit_jpg = os.path.abspath(os.path.join(script_dir, "../server/public/camera_exit.jpg"))
        if os.path.exists(exit_jpg):
            os.remove(exit_jpg)
    except Exception:
        pass

    # Start native MJPEG live camera stream server (port 5000)
    mjpeg_t = threading.Thread(target=start_mjpeg_server, daemon=True)
    mjpeg_t.start()

    if LPR_AVAILABLE:
        # Spawn LPR monitoring thread for Entrance camera
        entrance_lpr_t = threading.Thread(target=lpr_main, args=(ENTRANCE_CAMERA_SOURCE, "IN"))
        entrance_lpr_t.daemon = True
        entrance_lpr_t.start()

        # Spawn monitoring thread for Exit camera
        if EXIT_CAMERA_SOURCE:
            exit_lpr_t = threading.Thread(target=lpr_main, args=(EXIT_CAMERA_SOURCE, "OUT"))
            exit_lpr_t.daemon = True
            exit_lpr_t.start()
            print("\nDual Entrance & Exit Camera/LPR threads started at 15 FPS. Serial controller is active.")
        else:
            print("\nEntrance Camera/LPR thread started at 15 FPS. Serial controller is active.")
    else:
        print("\n=============================================")
        print("  Camera/LPR not available.")
        print("  Press Ctrl+C to stop.")
        print("=============================================\n")

    # 4. Keep service alive until interrupted
    try:
        while running:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutdown signal received.")
    finally:
        running = False
        print("[Shutdown] Ensuring barrier gate is ALWAYS CLOSED before exiting...")
        try:
            send_arduino_command('C')
            send_arduino_command('Z')
            sync_gate_status_with_laravel("closed")
            time.sleep(1)
        except Exception:
            pass
        if arduino and arduino.is_open:
            arduino.close()
            print("Serial port closed.")
        print("Service stopped. Goodbye!")
