/*
 * =====================================================================
 *  Automated Gate Infrared Photocell Sensor (12V-24V AC/DC) with Arduino UNO
 * =====================================================================
 *  Hardware Connections:
 *  ---------------------------------------------------------------------
 *  1. Photocell Power:
 *     - Sensor TX & RX Power (+) -> External 12V - 24V DC power supply (+)
 *     - Sensor TX & RX Power (-) -> External 12V - 24V DC power supply (-)
 *
 *  2. Relay Output (Receiver):
 *     - The sensor output is a voltage-free dry contact relay (COM, NO, NC).
 *     - COM (Common)           -> Arduino GND
 *     - NO (or NC)             -> Arduino Digital Pin D3
 *
 *  * CAUTION:
 *    Never connect the 12V/24V power wire directly to Arduino pins!
 *    The relay terminals (COM, NO, NC) are isolated dry contacts.
 * =====================================================================
 */

const int SENSOR_PIN = 3;       // Photocell relay output connected to D3
const int LED_PIN    = 13;      // Built-in Arduino LED for quick status indication

// Variables for state tracking & debouncing
int lastSensorState = -1;
unsigned long lastDebounceTime = 0;
const unsigned long debounceDelay = 50; // 50ms debounce time

void setup() {
  Serial.begin(9600);
  while (!Serial) {
    ; // Wait for serial port to connect (needed for native USB)
  }

  // Use internal pull-up resistor:
  // - Open relay contact  -> Reads HIGH (pulled up to 5V)
  // - Closed relay contact (COM connected to GND) -> Reads LOW (pulled to GND)
  pinMode(SENSOR_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);

  Serial.println(F("========================================"));
  Serial.println(F("  Gate Infrared Photocell Sensor Monitor"));
  Serial.println(F("========================================"));
  Serial.println(F("System initialized. Monitoring beam state..."));
}

void loop() {
  int currentReading = digitalRead(SENSOR_PIN);

  // Check if state changed (with simple debounce)
  if (currentReading != lastSensorState) {
    if ((millis() - lastDebounceTime) > debounceDelay) {
      lastSensorState = currentReading;
      lastDebounceTime = millis();

      /*
       * Standard Gate Photocell Logic with COM to GND & NO to D3:
       * - When beam is INTACT / CLEAR: Relay is energized or de-energized
       *   depending on NO / NC jumper.
       * 
       * If connected between COM & NO:
       * - LOW  = Contact closed (Object detected / Beam interrupted)
       * - HIGH = Contact open (Beam clear)
       * 
       * (If you used NC, simply swap the condition below)
       */
      if (currentReading == LOW) {
        digitalWrite(LED_PIN, HIGH);
        Serial.println(F("[!] BEAM BROKEN / OBSTACLE DETECTED! (Relay Closed: LOW)"));
      } else {
        digitalWrite(LED_PIN, LOW);
        Serial.println(F("[OK] Beam Intact / Path Clear (Relay Open: HIGH)"));
      }
    }
  }
}

