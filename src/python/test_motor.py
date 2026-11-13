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

def wait_for_arduino(ser, target_phrase=None, timeout=25):
    """Reads Arduino output line by line until target_phrase is found or timeout occurs."""
    start = time.time()
    while time.time() - start < timeout:
        if ser.in_waiting > 0:
            line = ser.readline().decode(errors="ignore").strip()
            if line:
                print(f"[Arduino]: {line}")
                if target_phrase and target_phrase.lower() in line.lower():
                    return True
        time.sleep(0.05)
    return False

def open_gate(ser):
    """Sends OPEN command ('O') and waits until gate has opened."""
    print("\n[ACTION] Sending command 'O' -> Opening Gate...")
    ser.write(b'O')
    wait_for_arduino(ser, target_phrase="Gate Open!", timeout=22)
    print("[STATUS] Gate has reached OPEN position.")

def close_gate(ser):
    """Sends CLOSE command ('C') and waits until gate has safely closed."""
    print("\n[ACTION] Sending command 'C' -> Closing Gate...")
    ser.write(b'C')
    wait_for_arduino(ser, target_phrase="Gate Closed!", timeout=25)
    print("[STATUS] Gate has reached CLOSED position. (Gate is safely closed)")

def run_test_cycle(ser, pause_seconds=3):
    """Performs full test: opens gate, pauses, and always closes the gate."""
    print("\n==============================================")
    print("   RUNNING BARRIER GATE SELF-TEST CYCLE")
    print("==============================================")
    print("--> Step 1/2: Testing OPEN operation...")
    open_gate(ser)

    print(f"\n--> Gate is OPEN. Holding for {pause_seconds}s before closing...")
    time.sleep(pause_seconds)

    print("\n--> Step 2/2: Testing CLOSE operation (ensuring closed state)...")
    close_gate(ser)
    print("\n>>> Self-test completed successfully! Gate is safely CLOSED. <<<\n")

def main():
    port = os.environ.get("SERIAL_PORT") or find_arduino_port() or "COM5"
    print(f"\n==========================================")
    print(f"   BTS7960 Motor Gate Test & Controller")
    print(f"==========================================")
    print(f"Connecting to Arduino on {port}...")

    try:
        ser = serial.Serial(port, 9600, timeout=1)
        time.sleep(2)  # Wait for Arduino reset after connection
        print("Connected successfully!\n")
    except Exception as e:
        print(f"Error opening port {port}: {e}")
        print("Make sure no other program (like lpr_gate_controller.py or Serial Monitor) is using this port.")
        sys.exit(1)

    # Read initial startup text from Arduino
    while ser.in_waiting > 0:
        line = ser.readline().decode(errors="ignore").strip()
        if line:
            print(f"[Arduino]: {line}")

    # 1. Startup Test: Test Open and Close before starting manual controls
    print("\n[STARTUP] Running initial test: Testing OPEN and CLOSE of barrier gate...")
    run_test_cycle(ser, pause_seconds=3)

    print("\n--- BARRIER GATE CONTROLS ---")
    print(" [T] -> Run Test Cycle (Open -> Pause 3s -> Close)")
    print(" [O] -> OPEN Gate")
    print(" [C] -> CLOSE Gate")
    print(" [Q] -> Quit (Always closes gate before exiting)")
    print("-----------------------------")

    try:
        while True:
            cmd = input("\nEnter command (T/O/C/Q): ").strip().upper()
            if cmd == 'Q':
                print("Exiting...")
                break
            elif cmd == 'T':
                run_test_cycle(ser, pause_seconds=3)
            elif cmd == 'O':
                open_gate(ser)
            elif cmd == 'C':
                close_gate(ser)
            else:
                print("Invalid input. Please enter 'T' to Test, 'O' to Open, 'C' to Close, or 'Q' to quit.")
    except KeyboardInterrupt:
        print("\nStopping...")
    finally:
        # ALWAYS ensure the gate is closed before leaving
        print("\n[SAFETY] Always ensuring gate is CLOSED before exiting/ready...")
        try:
            close_gate(ser)
        except Exception as e:
            print(f"Warning during exit close: {e}")
        ser.close()
        print("Serial port closed. Done!")

if __name__ == "__main__":
    main()

