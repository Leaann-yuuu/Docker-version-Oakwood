/*
 * =====================================================================
 *  OakWood Subdivision - Automated Gate Photocell Sensor Monitor
 *  (Inspired by Industrial 12V-24V Dry Contact Gate Sensor)
 * =====================================================================
 *  Hardware Connections:
 *  ---------------------------------------------------------------------
 *  1. Photocell Power:
 *     - Sensor TX & RX Power (+) -> External 12V - 24V DC power supply (+)
 *     - Sensor TX & RX Power (-) -> External 12V - 24V DC power supply (-)
 *
 *  2. Relay Output (Receiver to Arduino):
 *     - COM (Common)           -> Arduino GND
 *     - NO (or OUT)            -> Arduino Digital Pin D3
 *
 *  * CAUTION:
 *    Never connect the 12V/24V power wire directly to Arduino pins!
 *    The relay terminals (COM and NO/OUT) are isolated dry contacts.
 * =====================================================================
 */

const int SENSOR_PIN = 3;       // Photocell relay output connected to Pin D3
const int LED_PIN    = 13;      // Built-in Arduino LED for visual confirmation

// Debouncing variables to prevent mechanical relay contact chatter
int lastSensorState = -1;
int lastStableState = -1;
unsigned long lastDebounceTime = 0;
const unsigned long debounceDelay = 50; // 50ms debounce filter

void setup() {
  Serial.begin(9600);
  while (!Serial && millis() < 3000); // Wait for serial port

  // Internal pull-up:
  // - Open contact (Clear)   -> Reads HIGH (5V)
  // - Closed contact (Blocked) -> Reads LOW (GND)
  pinMode(SENSOR_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);

  Serial.println(F("=================================================="));
  Serial.println(F("  OakWood Subdivision - Photocell Sensor Monitor  "));
  Serial.println(F("=================================================="));
  Serial.println(F("Wiring Check: COM -> GND | NO/OUT -> Pin D3"));
  Serial.println(F("Terminal Format: 1 = BLOCKED | 0 = CLEAR"));
  Serial.println(F("System Ready! Monitoring infrared beam...\n"));
}

void loop() {
  int currentReading = digitalRead(SENSOR_PIN);

  // If reading changed due to noise or relay click, reset the debounce timer
  if (currentReading != lastSensorState) {
    lastDebounceTime = millis();
    lastSensorState = currentReading;
  }

  // Only accept the reading if it has stayed stable for debounceDelay (50ms)
  if ((millis() - lastDebounceTime) > debounceDelay) {
    if (currentReading != lastStableState) {
      lastStableState = currentReading;

      /*
       * With COM to GND and NO/OUT to Pin D3:
       * - When BEAM IS BROKEN (Blocked): Relay closes -> Pin goes LOW
       * - When BEAM IS INTACT (Clear):  Relay opens  -> Pin goes HIGH
       */
      if (currentReading == LOW) {
        // 1 = BLOCKED
        digitalWrite(LED_PIN, HIGH);ZX
        Serial.println(F("1  (BLOCKED - Obstacle detected)"));
      } else {
        // 0 = CLEAR
        digitalWrite(LED_PIN, LOW);
        Serial.println(F("0  (NOT BLOCKED - Clear)"));
      }
    }
  }
}
