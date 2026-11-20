#!/usr/bin/env python
import os
import sys
import time

try:
    import serial
    import serial.tools.list_ports
except ImportError:
    print("Error: 'pyserial' is not installed. Run: pip install pyserial")
    sys.exit(1)


def find_arduino_port():
    ports = list(serial.tools.list_ports.comports())
    if not ports:
        return None
    for p in ports:
        desc = p.description.lower()
        if any(kw in desc for kw in ["arduino", "ch340", "usb serial", "ftdi", "cp210", "usb-to-uart", "uart", "ser"]):
            return p.device
    return ports[0].device


def parse_ir_line(line):
    lower = line.strip().lower()
    if not lower:
        return None
    if (
        lower == "0"
        or lower.startswith("0 ")
        or lower.startswith("0\t")
        or "not blocked" in lower
        or "beam intact" in lower
        or "path clear" in lower
        or "relay open" in lower
    ):
        return False
    if (
        lower == "1"
        or lower.startswith("1 ")
        or lower.startswith("1\t")
        or "(blocked" in lower
        or lower == "blocked"
        or "beam broken" in lower
        or "obstacle detected" in lower
        or "relay closed" in lower
    ):
        return True
    return None


def poll_serial(ser, ir_state):
    lines = []
    while ser.in_waiting > 0:
        line = ser.readline().decode(errors="ignore").strip()
        if not line:
            continue
        lines.append(line)
        ir_val = parse_ir_line(line)
        if ir_val is not None:
            ir_state["blocked"] = ir_val
        print(f"[Arduino]: {line}")
    return lines


def stop_motor(ser):
    ser.write(b"S")
    ser.flush()
    print("[SAFETY] Obstruction detected -> Motor STOPPED ('S')!")


def wait_for_reply(ser, ir_state, target_phrase, timeout=6, stop_on_obstruction=True):
    start = time.time()
    while time.time() - start < timeout:
        for line in poll_serial(ser, ir_state):
            lower = line.lower()
            if "motor stopped!" in lower or "safety lock" in lower or "emergency safety" in lower:
                return False
            if target_phrase.lower() in lower:
                return True
        if stop_on_obstruction and ir_state["blocked"]:
            stop_motor(ser)
            return False
        time.sleep(0.05)
    return False


def run_ir_sensor_test(ser, ir_state):
    print("\n--- IR SENSOR + MOTOR TEST ---")
    print(" Obstruction (1) -> STOP MOTOR immediately ('S')")
    print(" Clear (0)       -> CLOSE ('C')")
    print(" Press Ctrl+C to return to menu.\n")

    was_blocked = None

    poll_serial(ser, ir_state)
    print(f"[IR STATUS]: {'BLOCKED (1)' if ir_state['blocked'] else 'CLEAR (0)'}")

    try:
        while True:
            poll_serial(ser, ir_state)

            if ir_state["blocked"]:
                if was_blocked is not True:
                    stop_motor(ser)
                    was_blocked = True
            else:
                if was_blocked is True:
                    print("[IR -> MOTOR] Path clear (0)! Sending 'C' -> CLOSE...")
                    ser.write(b"C")
                    ser.flush()
                    wait_for_reply(ser, ir_state, "Gate Closed!", stop_on_obstruction=True)
                    was_blocked = False
                elif was_blocked is None:
                    print("[IR STATUS]: CLEAR (0) - Path is clear.")
                    was_blocked = False

            time.sleep(0.05)
    except KeyboardInterrupt:
        print("\nStopped IR Sensor Test. Returning to menu...")


def main():
    port = os.environ.get("SERIAL_PORT") or find_arduino_port() or "COM5"
    print(f"Connecting to Arduino on {port}...")

    try:
        ser = serial.Serial(port, 9600, timeout=1)
        time.sleep(2)
        print("Connected!\n")
    except Exception as e:
        print(f"Error opening port {port}: {e}")
        sys.exit(1)

    ir_state = {"blocked": False}
    poll_serial(ser, ir_state)

    print("--- MOTOR & IR TEST ---")
    print(" [O] - OPEN")
    print(" [C] - CLOSE")
    print(" [S] - STOP MOTOR")
    print(" [I] - IR SENSOR TEST (Obstruction -> Stop Motor, Clear -> Close)")
    print(" [Q] - QUIT")
    print("-----------------------")

    try:
        while True:
            cmd = input("\nEnter command (O/C/S/I/Q): ").strip().upper()
            if cmd == "O":
                print("Sending 'O' -> OPEN...")
                ser.write(b"O")
                ser.flush()
                wait_for_reply(ser, ir_state, "Gate Open!", stop_on_obstruction=True)
            elif cmd == "C":
                print("Sending 'C' -> CLOSE...")
                ser.write(b"C")
                ser.flush()
                wait_for_reply(ser, ir_state, "Gate Closed!", stop_on_obstruction=True)
            elif cmd == "S":
                ser.write(b"S")
                ser.flush()
                print("Sent 'S' -> STOP MOTOR.")
            elif cmd == "I":
                run_ir_sensor_test(ser, ir_state)
            elif cmd == "Q":
                break
            else:
                print("Invalid input. Press 'O' (OPEN), 'C' (CLOSE), 'S' (STOP), 'I' (IR TEST), or 'Q' (QUIT).")
    except KeyboardInterrupt:
        print("\nExiting...")
    finally:
        ser.close()
        print("Serial port closed.")


if __name__ == "__main__":
    main()
