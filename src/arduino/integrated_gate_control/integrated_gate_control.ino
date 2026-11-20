/*
 * =====================================================================
 *  OakWood Subdivision - Integrated BTS7960 Motor & IR Photocell Controller
 * =====================================================================
 * 
 * Hardware Wiring:
 *   BTS7960 RPWM  -> Arduino Digital Pin 6  (Forward PWM - Open Gate)
 *   BTS7960 LPWM  -> Arduino Digital Pin 5  (Reverse PWM - Close Gate)
 *   BTS7960 R_EN  -> Arduino 5V
 *   BTS7960 L_EN  -> Arduino 5V
 *   BTS7960 VCC   -> Arduino 5V
 *   BTS7960 GND   -> Arduino GND
 *   
 *   Photocell IR Sensor (Dry Contact):
 *     - Sensor TX & RX (+ and -) -> External 12V-24V Power Supply
 *     - Receiver COM             -> Arduino GND
 *     - Receiver NO (or OUT)     -> Arduino Digital Pin 3 (D3)
 *   
 *   Green LED     -> Arduino Analog Pin A0 (Gate Open indicator)
 *   Red LED       -> Arduino Analog Pin A1 (Gate Closed indicator)
 *   
 *   Manual Buttons: Pin 7 to GND (Open), Pin 8 to GND (Close)
 *   
 * Serial Commands (9600 Baud):
 *   'O' or 'X' -> Lifts Gate Arm (Open)
 *   'C' or 'Z' -> Lowers Gate Arm (Close with IR Safety)
 *   'F'        -> Force Close (Motor Test - Bypasses IR Sensor)
 *   'S'        -> Stop Motor Immediately
 *   
 * Telemetry Output:
 *   "1  (BLOCKED - Obstacle detected)" when beam is broken
 *   "0  (NOT BLOCKED - Clear)"        when beam is clear
 *   ">> Gate Open!" / ">> Gate Closed!" for Python automation
 * =====================================================================
 */

// BTS7960 Gate Control Pins
const int RPWM_PIN = 6;       // Open Gate Pin (Pin 6)
const int LPWM_PIN = 5;       // Close Gate Pin (Pin 5)
const int MOTOR_SPEED = 150;  // 100% full motor power
const unsigned long OPEN_RUN_TIME_MS  = 3000; // 2 seconds for opening
const unsigned long CLOSE_RUN_TIME_MS = 3000; // 2 seconds for closing

// Indicator LEDs
const int GREEN_LED = A0;     // Gate Open indicator
const int RED_LED   = A1;     // Gate Closed indicator

// Manual Buttons (Active LOW with internal pull-up)
const int OPEN_BUTTON_PIN  = 7; // Pin 7 -> GND = Manual Open
const int CLOSE_BUTTON_PIN = 8; // Pin 8 -> GND = Manual Close

// =====================================================================
// SENSOR CONFIGURATION:
// Set to false to exclude IR sensor (operates on pure motor timer)
// Set to true when IR sensor hardware is wired & connected
// =====================================================================
const bool ENABLE_IR_SENSOR = true;

// Photocell IR Sensor Pin (Active LOW when beam is broken)
const int IR_SENSOR_PIN    = 3; // Pin D3 -> Photocell Receiver NO / OUT
int lastIrReading          = -1;
int lastStableIrState      = -1;
unsigned long lastIrDebounce = 0;
const unsigned long IR_DEBOUNCE_MS = 50; // 50ms debounce for relay contacts

void setup() {
  Serial.begin(9600);

  // Motor Driver Pins
  pinMode(RPWM_PIN, OUTPUT);
  pinMode(LPWM_PIN, OUTPUT);
  pinMode(GREEN_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);

  // Manual Buttons
  pinMode(OPEN_BUTTON_PIN, INPUT_PULLUP);
  pinMode(CLOSE_BUTTON_PIN, INPUT_PULLUP);

  // Photocell IR Sensor (only initialized if enabled)
  if (ENABLE_IR_SENSOR) {
    pinMode(IR_SENSOR_PIN, INPUT_PULLUP);
  }

  stopMotor();
  digitalWrite(RED_LED, HIGH);
  digitalWrite(GREEN_LED, LOW);

  Serial.println(F("BTS7960 Motor Controller Ready (Open on Pin 6, Close on Pin 5)."));
  if (ENABLE_IR_SENSOR) {
    Serial.println(F("IR Photocell Sensor: ENABLED on Pin D3."));
  } else {
    Serial.println(F("IR Sensor: DISABLED (Pure Motor / Timer Mode)."));
  }
  Serial.println(F("- Serial: Send 'O' to Open, 'C' to Close."));
  Serial.println(F("- Hardware: Ground Pin 7 to Open, Ground Pin 8 to Close."));
}

void loop() {
  // 1. Process and report IR Sensor beam changes (only if enabled)
  if (ENABLE_IR_SENSOR) {
    checkPhotocellSensor();
  }

  // 2. Serial Commands from Python / Serial Monitor
  if (Serial.available() > 0) {
    char cmd = Serial.read();
    if (cmd == 'O' || cmd == 'o' || cmd == 'X' || cmd == 'x') {
      openGate();
    } else if (cmd == 'C' || cmd == 'c' || cmd == 'Z' || cmd == 'z') {
      closeGate();
    } else if (cmd == 'F' || cmd == 'f') {
      // Force close (standalone motor test - bypasses IR sensor)
      forceCloseGate();
    } else if (cmd == 'S' || cmd == 's') {
      stopMotor();
      Serial.println(F(">> Motor Stopped!"));
    }
  }

  // 3. Physical Button / Jumper Wire Manual Overrides
  if (digitalRead(OPEN_BUTTON_PIN) == LOW) {
    delay(50); // Debounce
    if (digitalRead(OPEN_BUTTON_PIN) == LOW) {
      Serial.println(F(">> MANUAL OVERRIDE: Pin 7 (Open) Triggered!"));
      openGate();
      while (digitalRead(OPEN_BUTTON_PIN) == LOW); // Wait for release
    }
  }

  if (digitalRead(CLOSE_BUTTON_PIN) == LOW) {
    delay(50); // Debounce
    if (digitalRead(CLOSE_BUTTON_PIN) == LOW) {
      Serial.println(F(">> MANUAL OVERRIDE: Pin 8 (Close) Triggered!"));
      closeGate();
      while (digitalRead(CLOSE_BUTTON_PIN) == LOW); // Wait for release
    }
  }
}

// Check Photocell IR Sensor and print state changes
void checkPhotocellSensor() {
  int reading = digitalRead(IR_SENSOR_PIN);

  if (reading != lastIrReading) {
    lastIrDebounce = millis();
    lastIrReading = reading;
  }

  if ((millis() - lastIrDebounce) > IR_DEBOUNCE_MS) {
    if (reading != lastStableIrState) {
      lastStableIrState = reading;
      if (reading == LOW) {
        // LOW = Relay Closed = Beam Broken
        Serial.println(F("1  (BLOCKED - Obstacle detected)"));
      } else {
        // HIGH = Relay Open = Beam Intact
        Serial.println(F("0  (NOT BLOCKED - Clear)"));
      }
    }
  }
}

// Check if obstacle currently blocks the beam (returns true if blocked)
bool isObstaclePresent() {
  return (digitalRead(IR_SENSOR_PIN) == LOW);
}

void openGate() {
  Serial.println(F(">> Opening Gate..."));
  digitalWrite(RED_LED, LOW);
  digitalWrite(GREEN_LED, HIGH);

  // Drive Open (Pin 6 driven at MOTOR_SPEED)
  digitalWrite(LPWM_PIN, LOW);
  analogWrite(LPWM_PIN, 0);
  digitalWrite(RPWM_PIN, HIGH);
  analogWrite(RPWM_PIN, MOTOR_SPEED);

  unsigned long startOpen = millis();
  while (millis() - startOpen < OPEN_RUN_TIME_MS) {
    if (Serial.available() > 0) {
      char c = Serial.peek();
      if (c == 'S' || c == 's') {
        Serial.read();
        stopMotor();
        Serial.println(F(">> Motor Stopped!"));
        return;
      }
    }
    delay(20);
  }

  stopMotor();
  Serial.println(F(">> Gate Open!"));
}

void closeGate() {
  // Safety Check 1: Refuse to close if IR sensor enabled and obstacle detected
  if (ENABLE_IR_SENSOR && isObstaclePresent()) {
    stopMotor();
    Serial.println(F("1  (BLOCKED - Obstacle detected)"));
    Serial.println(F(">> SAFETY LOCK: Obstruction detected! Motor stopped."));
    return;
  }

  Serial.println(F(">> Closing Gate..."));
  digitalWrite(GREEN_LED, LOW);
  digitalWrite(RED_LED, HIGH);

  // Drive Close (Pin 5 driven at MOTOR_SPEED)
  digitalWrite(RPWM_PIN, LOW);
  analogWrite(RPWM_PIN, 0);
  digitalWrite(LPWM_PIN, HIGH);
  analogWrite(LPWM_PIN, MOTOR_SPEED);

  if (ENABLE_IR_SENSOR) {
    // Safety Check 2: Monitor IR beam continuously while gate arm is lowering
    unsigned long startClose = millis();
    while (millis() - startClose < CLOSE_RUN_TIME_MS) {
      if (Serial.available() > 0) {
        char c = Serial.peek();
        if (c == 'S' || c == 's') {
          Serial.read();
          stopMotor();
          Serial.println(F(">> Motor Stopped!"));
          return;
        }
      }
      if (isObstaclePresent()) {
        stopMotor();
        Serial.println(F("1  (BLOCKED - Obstacle detected)"));
        Serial.println(F(">> EMERGENCY SAFETY: Obstruction detected while closing! Motor stopped."));
        return;
      }
      delay(20);
    }
  } else {
    delay(CLOSE_RUN_TIME_MS);
  }

  stopMotor();
  Serial.println(F(">> Gate Closed!"));
}

// Force close without IR sensor checking (for motor testing)
void forceCloseGate() {
  Serial.println(F(">> [MOTOR TEST] Closing Gate (IR sensor check bypassed)..."));
  digitalWrite(GREEN_LED, LOW);
  digitalWrite(RED_LED, HIGH);

  // Drive Close (Pin 5)
  digitalWrite(RPWM_PIN, LOW);
  analogWrite(RPWM_PIN, 0);
  digitalWrite(LPWM_PIN, HIGH);
  analogWrite(LPWM_PIN, MOTOR_SPEED);
  delay(CLOSE_RUN_TIME_MS);

  stopMotor();
  Serial.println(F(">> Gate Closed!"));
}

void stopMotor() {
  digitalWrite(RPWM_PIN, LOW);
  analogWrite(RPWM_PIN, 0);
  digitalWrite(LPWM_PIN, LOW);
  analogWrite(LPWM_PIN, 0);
}
