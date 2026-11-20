/*
 * =====================================================================
 *  OakWood Subdivision - Standalone BTS7960 Motor Driver Tester
 *  (Pure Motor Testing - NO IR Sensor Included)
 * =====================================================================
 * 
 * Hardware Wiring:
 *   BTS7960 RPWM  -> Arduino Digital Pin 6  (Forward PWM - Open Gate)
 *   BTS7960 LPWM  -> Arduino Digital Pin 5  (Reverse PWM - Close Gate)
 *   BTS7960 R_EN  -> Arduino 5V
 *   BTS7960 L_EN  -> Arduino 5V
 *   BTS7960 VCC   -> Arduino 5V
 *   BTS7960 GND   -> Arduino GND
 *   BTS7960 B+ / M+ -> Motor Power Supply (12V/24V)
 *   BTS7960 B- / M- -> Motor Connections
 *   
 *   Green LED     -> Arduino Analog Pin A0 (Gate Open indicator)
 *   Red LED       -> Arduino Analog Pin A1 (Gate Closed indicator)
 *   
 *   Manual Buttons:
 *     Pin 7 to GND -> Manual Open
 *     Pin 8 to GND -> Manual Close
 *   
 * Serial Commands (9600 Baud):
 *   'O' -> Open Gate (Drive Pin 6 for 3 seconds)
 *   'C' or 'F' -> Close Gate (Drive Pin 5 for 3 seconds)
 *   'S' -> Emergency Stop Motor
 *   'J' -> Jog / Pulse Open (1 second forward)
 *   'K' -> Jog / Pulse Close (1 second reverse)
 * =====================================================================
 */

const int RPWM_PIN = 6;       // Open Gate Pin (Pin 6)
const int LPWM_PIN = 5;       // Close Gate Pin (Pin 5)
const int MOTOR_SPEED = 150;  // Motor PWM power (0-255)
const unsigned long OPEN_RUN_TIME_MS  = 1000; // 3 seconds
const unsigned long CLOSE_RUN_TIME_MS = 1000; // 3 seconds
const unsigned long JOG_TIME_MS       = 1000; // 1 second jog

const int GREEN_LED = A0;     // Gate Open indicator
const int RED_LED   = A1;     // Gate Closed indicator

const int OPEN_BUTTON_PIN  = 7; // Pin 7 -> GND = Open
const int CLOSE_BUTTON_PIN = 8; // Pin 8 -> GND = Close

void setup() {
  Serial.begin(9600);

  pinMode(RPWM_PIN, OUTPUT);
  pinMode(LPWM_PIN, OUTPUT);
  pinMode(GREEN_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);

  pinMode(OPEN_BUTTON_PIN, INPUT_PULLUP);
  pinMode(CLOSE_BUTTON_PIN, INPUT_PULLUP);

  stopMotor();
  digitalWrite(RED_LED, HIGH);
  digitalWrite(GREEN_LED, LOW);

  Serial.println(F("=================================================="));
  Serial.println(F("  OakWood BTS7960 Standalone Motor Tester Ready  "));
  Serial.println(F("  (Pure Motor Test - NO IR Sensor Dependency)   "));
  Serial.println(F("=================================================="));
  Serial.println(F("RPWM (Pin 6) = Open | LPWM (Pin 5) = Close"));
  Serial.println(F("Commands: 'O'=Open, 'C'=Close, 'S'=Stop, 'J'=Jog Open, 'K'=Jog Close"));
  Serial.println(F("Buttons: Pin 7 to GND = Open | Pin 8 to GND = Close\n"));
}

void loop() {
  // 1. Serial Commands
  if (Serial.available() > 0) {
    char cmd = Serial.read();
    if (cmd == 'O' || cmd == 'o' || cmd == 'X' || cmd == 'x') {
      openGate();
    } else if (cmd == 'C' || cmd == 'c' || cmd == 'Z' || cmd == 'z' || cmd == 'F' || cmd == 'f') {
      closeGate();
    } else if (cmd == 'S' || cmd == 's') {
      stopMotor();
      Serial.println(F(">> Motor Stopped!"));
    } else if (cmd == 'J' || cmd == 'j') {
      jogOpen();
    } else if (cmd == 'K' || cmd == 'k') {
      jogClose();
    }
  }

  // 2. Physical Button Overrides
  if (digitalRead(OPEN_BUTTON_PIN) == LOW) {
    delay(50);
    if (digitalRead(OPEN_BUTTON_PIN) == LOW) {
      Serial.println(F(">> BUTTON: Pin 7 (Open) Pressed!"));
      openGate();
      while (digitalRead(OPEN_BUTTON_PIN) == LOW);
    }
  }

  if (digitalRead(CLOSE_BUTTON_PIN) == LOW) {
    delay(50);
    if (digitalRead(CLOSE_BUTTON_PIN) == LOW) {
      Serial.println(F(">> BUTTON: Pin 8 (Close) Pressed!"));
      closeGate();
      while (digitalRead(CLOSE_BUTTON_PIN) == LOW);
    }
  }
}

void openGate() {
  Serial.println(F(">> Opening Gate (RPWM Pin 6 active)..."));
  digitalWrite(RED_LED, LOW);
  digitalWrite(GREEN_LED, HIGH);

  digitalWrite(LPWM_PIN, LOW);
  analogWrite(LPWM_PIN, 0);
  digitalWrite(RPWM_PIN, HIGH);
  analogWrite(RPWM_PIN, MOTOR_SPEED);
  delay(OPEN_RUN_TIME_MS);

  stopMotor();
  Serial.println(F(">> Gate Open!"));
}

void closeGate() {
  Serial.println(F(">> Closing Gate (LPWM Pin 5 active)..."));
  digitalWrite(GREEN_LED, LOW);
  digitalWrite(RED_LED, HIGH);

  digitalWrite(RPWM_PIN, LOW);
  analogWrite(RPWM_PIN, 0);
  digitalWrite(LPWM_PIN, HIGH);
  analogWrite(LPWM_PIN, MOTOR_SPEED);
  delay(CLOSE_RUN_TIME_MS);

  stopMotor();
  Serial.println(F(">> Gate Closed!"));
}

void jogOpen() {
  Serial.println(F(">> Jog OPEN (1 second)..."));
  digitalWrite(LPWM_PIN, LOW);
  analogWrite(LPWM_PIN, 0);
  digitalWrite(RPWM_PIN, HIGH);
  analogWrite(RPWM_PIN, MOTOR_SPEED);
  delay(JOG_TIME_MS);
  stopMotor();
  Serial.println(F(">> Jog Complete."));
}

void jogClose() {
  Serial.println(F(">> Jog CLOSE (1 second)..."));
  digitalWrite(RPWM_PIN, LOW);
  analogWrite(RPWM_PIN, 0);
  digitalWrite(LPWM_PIN, HIGH);
  analogWrite(LPWM_PIN, MOTOR_SPEED);
  delay(JOG_TIME_MS);
  stopMotor();
  Serial.println(F(">> Jog Complete."));
}

void stopMotor() {
  digitalWrite(RPWM_PIN, LOW);
  analogWrite(RPWM_PIN, 0);
  digitalWrite(LPWM_PIN, LOW);
  analogWrite(LPWM_PIN, 0);
}
