/**
 * AxleWatch Transmitter - LoRa Temperature Monitoring System
 *
 * Monitors up to 10 DS18B20 sensors:
 * - Sensor 1: Ambient (always first)
 * - Sensors 2-10: Additional measurement positions
 *
 * Features:
 * - Interactive sensor identification via button and touch-to-identify
 * - 5-second button press to save sensor configuration
 * - EEPROM storage of sensor assignments
 * - LoRa transmission at 433 MHz
 * - LED and buzzer feedback
 * - WiFi web interface for configuration and monitoring
 * - User-configurable transmitter ID (0-65535)
 * - Power-efficient operation with deep sleep
 * - Transmission format: TX<ID>:<temp1>,<temp2>,...,<ambient>
 */

#include <Arduino.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <SPI.h>
#include <LoRa.h>
#include <EEPROM.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>

// Pin definitions (from README)
#define ONE_WIRE_PIN   32
#define BUTTON_PIN     25
#define LED_RED_PIN    26
#define LED_GREEN_PIN  27
#define BUZZER_PIN     33

#define LORA_CS_PIN    5
#define LORA_RST_PIN   14
#define LORA_DIO0_PIN  2
#define LORA_SCK_PIN   18
#define LORA_MISO_PIN  19
#define LORA_MOSI_PIN  23

// Configuration - ALIGNED WITH RX
#define LORA_FREQUENCY 433E6        // 433 MHz
#define LORA_TX_POWER  20           // 20 dBm
#define LORA_BANDWIDTH 125E3        // 125 kHz
#define LORA_SPREADING_FACTOR 7     // SF7 - MUST MATCH RX!

#define MAX_SENSOR_COUNT 10
#define TEMP_PRECISION 12           // 12-bit resolution (0.0625°C)
#define EEPROM_SIZE 512
#define EEPROM_MAGIC 0xABCD         // Magic number to verify EEPROM is initialized
#define EEPROM_MAGIC_ADDR 0
#define EEPROM_SENSOR_ADDR 4        // Start address for sensor data
#define EEPROM_SENSOR_COUNT_ADDR 84 // Address for active sensor count (after 4 + 8*10)
#define EEPROM_NAME_ADDR 88         // Start address for device name
#define EEPROM_TRANSMITTER_ID_ADDR 120  // Address for transmitter ID (uint16_t)
#define EEPROM_POWER_MODE_ADDR 122  // Address for power save mode flag

#define BUTTON_SAVE_PRESS_MS 5000   // 5 seconds to save sensor setup
#define BUTTON_SETUP_PRESS_MS 3000  // 3 seconds to enter setup mode
#define TRANSMIT_INTERVAL_MS 30000  // 30 seconds between transmissions (power efficient)
#define DEEP_SLEEP_DURATION_US 30000000  // 30 seconds in microseconds
#define TEMP_CHANGE_THRESHOLD 1.5   // °C change to detect sensor touch

// WiFi Configuration (Access Point Mode)
#define WIFI_AP_SSID "AxleWatch-TX"
#define WIFI_AP_PASSWORD "axlewatch123"
#define MAX_DEVICE_NAME_LENGTH 32
#define SERIAL_BUFFER_SIZE 100      // Number of serial log entries to keep

// OneWire and Dallas Temperature
OneWire oneWire(ONE_WIRE_PIN);
DallasTemperature sensors(&oneWire);

// Sensor addresses (8 bytes each)
// sensor[0] is always Ambient, sensors[1-9] are additional positions
struct SensorConfig {
  uint8_t sensors[MAX_SENSOR_COUNT][8];
};

SensorConfig sensorConfig;
bool sensorsConfigured = false;
unsigned long lastTransmitTime = 0;
uint8_t activeSensorCount = 1;  // Number of sensors actually configured (minimum 1 for ambient)
uint16_t transmitterID = 1;     // User-configurable transmitter ID (0-65535)
bool powerSaveMode = false;     // Enable deep sleep for power efficiency

// WiFi and Web Server
WebServer server(80);
char deviceName[MAX_DEVICE_NAME_LENGTH] = "AxleWatch-TX";

// Serial monitor circular buffer
struct SerialLogEntry {
  unsigned long timestamp;
  String message;
};
SerialLogEntry serialBuffer[SERIAL_BUFFER_SIZE];
int serialBufferIndex = 0;
int serialBufferCount = 0;

// Latest sensor data (for web display)
struct SensorData {
  float temps[MAX_SENSOR_COUNT];  // temps[0] is ambient, temps[1-9] are additional sensors
  unsigned long timestamp;
  bool valid;
} latestData = {{0}, 0, false};

// LoRa statistics
struct LoRaStats {
  unsigned long totalPackets;
  unsigned long lastPacketTime;
  int rssi;
  float snr;
} loraStats = {0, 0, 0, 0};

// Forward declarations
void enterSetupMode();
void scanAndIdentifySensors();
void saveSensorConfig();
void loadSensorConfig();
bool checkButtonPress(unsigned long duration);
void playTone(int frequency, int duration);
void blinkLED(int pin, int times, int delayMs);
void readAndTransmitData();
void printSensorAddress(uint8_t* addr);
int findSensorByTouch(DeviceAddress* allSensors, float* baselines, int count);
bool isDuplicateSensor(uint8_t* newAddr, int excludeIndex);
bool validateUniqueConfig();
void setupWiFi();
void setupWebServer();
void saveDeviceName();
void loadDeviceName();
void saveTransmitterConfig();
void loadTransmitterConfig();
void logToSerial(const String& message);
String getSerialLogs();
void enterDeepSleep();

// Web server handlers
void handleRoot();
void handleApiConfigGet();
void handleApiConfigPost();
void handleApiData();
void handleApiLora();
void handleApiSerial();

void setup() {
  Serial.begin(115200);
  Serial.println("\n=== AxleWatch Transmitter ===");

  // Initialize pins
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_RED_PIN, OUTPUT);
  pinMode(LED_GREEN_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  digitalWrite(LED_RED_PIN, LOW);
  digitalWrite(LED_GREEN_PIN, LOW);

  // Initialize EEPROM
  EEPROM.begin(EEPROM_SIZE);

  // Initialize OneWire sensors
  sensors.begin();
  sensors.setResolution(TEMP_PRECISION);
  Serial.printf("Found %d OneWire devices\n", sensors.getDeviceCount());

  // Initialize LoRa
  Serial.println("Initializing LoRa...");
  SPI.begin(LORA_SCK_PIN, LORA_MISO_PIN, LORA_MOSI_PIN, LORA_CS_PIN);
  LoRa.setPins(LORA_CS_PIN, LORA_RST_PIN, LORA_DIO0_PIN);

  if (!LoRa.begin(LORA_FREQUENCY)) {
    Serial.println("LoRa init failed!");
    while (1) {
      blinkLED(LED_RED_PIN, 3, 200);
      delay(1000);
    }
  }

  LoRa.setTxPower(LORA_TX_POWER);
  LoRa.setSignalBandwidth(LORA_BANDWIDTH);
  LoRa.setSpreadingFactor(LORA_SPREADING_FACTOR);
  LoRa.disableCrc(); // Explicitly disable CRC to match RX configuration
  Serial.println("LoRa initialized successfully");
  Serial.printf("LoRa Config: 433MHz, SF%d, BW125kHz\n", LORA_SPREADING_FACTOR);

  // Load sensor configuration from EEPROM
  loadSensorConfig();

  // Load device name from EEPROM
  loadDeviceName();

  // Load transmitter configuration (ID and power mode) from EEPROM
  loadTransmitterConfig();

  // Setup WiFi and Web Server
  setupWiFi();
  setupWebServer();

  // Startup feedback
  playTone(1000, 100);
  delay(50);
  playTone(1500, 100);
  blinkLED(LED_GREEN_PIN, 2, 200);

  // Check if button is held during startup for setup mode
  if (digitalRead(BUTTON_PIN) == LOW) {
    delay(100);
    if (digitalRead(BUTTON_PIN) == LOW) {
      Serial.println("Button held - entering setup mode");
      enterSetupMode();
    }
  }

  if (!sensorsConfigured) {
    Serial.println("WARNING: Sensors not configured!");
    blinkLED(LED_RED_PIN, 5, 200);
  } else {
    Serial.println("System ready - starting normal operation");
    Serial.printf("Transmitter ID: %d, Active sensors: %d, Power save: %s\n",
                  transmitterID, activeSensorCount, powerSaveMode ? "ON" : "OFF");
    digitalWrite(LED_GREEN_PIN, HIGH);
    delay(500);
    digitalWrite(LED_GREEN_PIN, LOW);
  }
}

void loop() {
  // Handle web server requests
  server.handleClient();

  // Check for button press to enter setup mode (3 seconds)
  if (checkButtonPress(BUTTON_SETUP_PRESS_MS)) {
    enterSetupMode();
  }

  // Transmit data at regular intervals
  if (sensorsConfigured && (millis() - lastTransmitTime >= TRANSMIT_INTERVAL_MS)) {
    readAndTransmitData();
    lastTransmitTime = millis();

    // If power save mode is enabled, enter deep sleep after transmission
    if (powerSaveMode) {
      Serial.println("Entering deep sleep for power efficiency...");
      delay(100); // Let serial finish
      enterDeepSleep();
    }
  }

  // Blink green LED to show alive (only if not in power save mode)
  if (sensorsConfigured && !powerSaveMode) {
    static unsigned long lastBlink = 0;
    if (millis() - lastBlink > 5000) { // Reduced blink frequency for power efficiency
      digitalWrite(LED_GREEN_PIN, HIGH);
      delay(50);
      digitalWrite(LED_GREEN_PIN, LOW);
      lastBlink = millis();
    }
  }

  delay(10); // Small delay for web server responsiveness
}

/**
 * Check if button is pressed for specified duration
 */
bool checkButtonPress(unsigned long duration) {
  if (digitalRead(BUTTON_PIN) == LOW) {
    unsigned long pressStart = millis();
    bool ledState = false;

    while (digitalRead(BUTTON_PIN) == LOW) {
      // Blink red LED during long press
      if (millis() - pressStart > 500) {
        ledState = !ledState;
        digitalWrite(LED_RED_PIN, ledState);
        delay(100);
      }

      if (millis() - pressStart > duration) {
        digitalWrite(LED_RED_PIN, LOW);
        return true;
      }
    }
    digitalWrite(LED_RED_PIN, LOW);
  }
  return false;
}

/**
 * Enter setup mode - identify and assign sensors
 */
void enterSetupMode() {
  Serial.println("\n========================================");
  Serial.println("    SETUP MODE - SENSOR IDENTIFICATION");
  Serial.println("========================================");
  Serial.println("First sensor will be AMBIENT (required)");
  Serial.println("Then assign up to 9 more sensors");
  Serial.println("Press button for 5 seconds to SAVE");

  // Alert the user
  playTone(2000, 200);
  delay(100);
  playTone(2000, 200);
  delay(100);
  playTone(2000, 200);

  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_RED_PIN, HIGH);
    digitalWrite(LED_GREEN_PIN, HIGH);
    delay(200);
    digitalWrite(LED_RED_PIN, LOW);
    digitalWrite(LED_GREEN_PIN, LOW);
    delay(200);
  }

  scanAndIdentifySensors();

  Serial.println("========================================\n");
}

/**
 * Scan for sensors and identify them through touch
 */
void scanAndIdentifySensors() {
  DeviceAddress allSensors[16];
  int deviceCount = sensors.getDeviceCount();

  Serial.printf("\nScanning for sensors... Found %d device(s)\n", deviceCount);

  if (deviceCount < 1) {
    Serial.println("ERROR: No sensors found!");
    playTone(200, 1000);
    blinkLED(LED_RED_PIN, 10, 200);
    return;
  }

  // Get all sensor addresses
  for (int i = 0; i < deviceCount && i < 16; i++) {
    sensors.getAddress(allSensors[i], i);
    Serial.printf("  Device %d: ", i);
    printSensorAddress(allSensors[i]);
    Serial.println();
  }

  // Get baseline temperatures
  Serial.println("\nReading baseline temperatures...");
  sensors.requestTemperatures();
  delay(1000);

  float baselines[16];
  for (int i = 0; i < deviceCount && i < 16; i++) {
    baselines[i] = sensors.getTempC(allSensors[i]);
    Serial.printf("  Device %d baseline: %.2f°C\n", i, baselines[i]);
  }

  // Reset sensor count
  activeSensorCount = 0;

  // Identify AMBIENT sensor first (position 0)
  Serial.println("\n========================================");
  Serial.println("--- Identifying AMBIENT Sensor (Required) ---");
  Serial.println("Touch/heat the AMBIENT sensor now...");
  Serial.println("========================================");

  // Single beep for ambient
  playTone(1500, 150);
  delay(500);

  // Blink red LED while waiting
  digitalWrite(LED_RED_PIN, HIGH);

  int identifiedSensor = findSensorByTouch(allSensors, baselines, deviceCount);

  digitalWrite(LED_RED_PIN, LOW);

  if (identifiedSensor >= 0) {
    memcpy(sensorConfig.sensors[0], allSensors[identifiedSensor], 8);
    Serial.print("✓ AMBIENT sensor identified: ");
    printSensorAddress(sensorConfig.sensors[0]);
    Serial.println();
    activeSensorCount = 1;

    // Success feedback
    playTone(2000, 200);
    blinkLED(LED_GREEN_PIN, 3, 100);
    delay(1000);
  } else {
    Serial.println("✗ ERROR: AMBIENT sensor is required!");
    playTone(200, 1000);
    blinkLED(LED_RED_PIN, 10, 200);
    return;
  }

  // Now identify additional sensors (positions 1-9)
  Serial.println("\n========================================");
  Serial.println("--- Assigning Additional Sensors ---");
  Serial.println("Touch each sensor to assign it");
  Serial.println("OR press button for 5 seconds to SAVE");
  Serial.println("========================================");

  for (int pos = 1; pos < MAX_SENSOR_COUNT; pos++) {
    Serial.printf("\n--- Position %d (optional) ---\n", pos);
    Serial.println("Touch sensor to assign, or hold button 5s to save...");

    // Beep pattern to indicate position number
    for (int i = 0; i < pos; i++) {
      playTone(1500, 100);
      delay(100);
    }
    delay(500);

    // Wait for either sensor touch or button press
    unsigned long waitStart = millis();
    unsigned long timeout = 60000; // 60 second timeout
    bool sensorFound = false;
    bool buttonPressed = false;

    digitalWrite(LED_RED_PIN, HIGH);

    while (millis() - waitStart < timeout) {
      // Check for button press (5 seconds to save)
      if (digitalRead(BUTTON_PIN) == LOW) {
        unsigned long pressStart = millis();
        bool ledState = false;

        while (digitalRead(BUTTON_PIN) == LOW && millis() - pressStart < BUTTON_SAVE_PRESS_MS + 500) {
          // Blink both LEDs during save press
          if ((millis() - pressStart) % 200 < 100) {
            digitalWrite(LED_RED_PIN, HIGH);
            digitalWrite(LED_GREEN_PIN, HIGH);
          } else {
            digitalWrite(LED_RED_PIN, LOW);
            digitalWrite(LED_GREEN_PIN, LOW);
          }

          if (millis() - pressStart > BUTTON_SAVE_PRESS_MS) {
            buttonPressed = true;
            break;
          }
          delay(10);
        }

        if (buttonPressed) {
          break;
        }
      }

      // Check for sensor touch
      sensors.requestTemperatures();
      for (int i = 0; i < deviceCount && i < 16; i++) {
        float currentTemp = sensors.getTempC(allSensors[i]);
        float change = abs(currentTemp - baselines[i]);

        if (change > TEMP_CHANGE_THRESHOLD) {
          // Check if this sensor is already assigned
          if (isDuplicateSensor(allSensors[i], pos)) {
            Serial.println("✗ ERROR: This sensor is already assigned!");
            Serial.print("   Detected sensor: ");
            printSensorAddress(allSensors[i]);
            Serial.println();
            Serial.println("   Please touch a DIFFERENT sensor");

            // Error feedback
            playTone(400, 300);
            delay(100);
            playTone(400, 300);
            blinkLED(LED_RED_PIN, 5, 150);

            // Update baseline and continue waiting
            baselines[i] = currentTemp;
            delay(2000);
            waitStart = millis(); // Reset timeout
            continue;
          }

          // Valid sensor found
          memcpy(sensorConfig.sensors[pos], allSensors[i], 8);
          Serial.printf("✓ Position %d identified: ", pos);
          printSensorAddress(sensorConfig.sensors[pos]);
          Serial.println();

          // Update baseline
          baselines[i] = currentTemp;
          activeSensorCount++;
          sensorFound = true;

          // Success feedback
          digitalWrite(LED_RED_PIN, LOW);
          playTone(2000, 200);
          blinkLED(LED_GREEN_PIN, 3, 100);
          delay(1000);
          break;
        }
      }

      if (sensorFound || buttonPressed) {
        break;
      }

      delay(500);
    }

    digitalWrite(LED_RED_PIN, LOW);
    digitalWrite(LED_GREEN_PIN, LOW);

    // If button was pressed to save, exit setup
    if (buttonPressed) {
      Serial.println("\n*** SAVE button pressed - finalizing setup ***");
      break;
    }

    // If timeout without finding sensor, ask to continue
    if (!sensorFound) {
      Serial.println("✗ Timeout - no sensor detected for this position");
      Serial.printf("Current sensor count: %d (including ambient)\n", activeSensorCount);
      break;
    }
  }

  // Final validation
  Serial.println("\nValidating configuration...");
  if (!validateUniqueConfig()) {
    Serial.println("✗ CRITICAL ERROR: Duplicate sensors detected!");
    playTone(300, 1000);
    blinkLED(LED_RED_PIN, 10, 200);
    return;
  }
  Serial.println("✓ All sensors are unique");

  // Save configuration
  saveSensorConfig();

  // Success feedback
  Serial.printf("\nSetup complete! %d sensors configured\n", activeSensorCount);
  playTone(1000, 100);
  delay(50);
  playTone(1500, 100);
  delay(50);
  playTone(2000, 300);
  blinkLED(LED_GREEN_PIN, 5, 200);

  sensorsConfigured = true;
}

/**
 * Find sensor by detecting temperature change (touch)
 */
int findSensorByTouch(DeviceAddress* allSensors, float* baselines, int count) {
  unsigned long startTime = millis();
  unsigned long timeout = 30000; // 30 second timeout

  while (millis() - startTime < timeout) {
    sensors.requestTemperatures();

    for (int i = 0; i < count; i++) {
      float currentTemp = sensors.getTempC(allSensors[i]);
      float change = abs(currentTemp - baselines[i]);

      if (change > TEMP_CHANGE_THRESHOLD) {
        Serial.printf("Temperature change detected on sensor %d: %.2f°C -> %.2f°C (Δ%.2f°C)\n",
                     i, baselines[i], currentTemp, change);

        // Update baseline for next identification
        baselines[i] = currentTemp;
        return i;
      }
    }

    delay(500);
  }

  return -1; // Timeout
}

/**
 * Check if a sensor address is already assigned to a previous position
 */
bool isDuplicateSensor(uint8_t* newAddr, int excludeIndex) {
  for (int i = 0; i < excludeIndex && i < activeSensorCount; i++) {
    if (memcmp(newAddr, sensorConfig.sensors[i], 8) == 0) {
      return true; // Duplicate found
    }
  }
  return false; // No duplicate
}

/**
 * Validate that all configured sensors have unique addresses
 */
bool validateUniqueConfig() {
  for (int i = 0; i < activeSensorCount; i++) {
    for (int j = i + 1; j < activeSensorCount; j++) {
      if (memcmp(sensorConfig.sensors[i], sensorConfig.sensors[j], 8) == 0) {
        Serial.printf("ERROR: Duplicate sensor detected between positions %d and %d!\n", i, j);
        return false;
      }
    }
  }
  return true;
}

/**
 * Save sensor configuration to EEPROM
 */
void saveSensorConfig() {
  Serial.println("Saving configuration to EEPROM...");

  // Write magic number
  uint16_t magic = EEPROM_MAGIC;
  EEPROM.put(EEPROM_MAGIC_ADDR, magic);

  // Write sensor configuration
  EEPROM.put(EEPROM_SENSOR_ADDR, sensorConfig);

  // Write active sensor count
  EEPROM.put(EEPROM_SENSOR_COUNT_ADDR, activeSensorCount);

  EEPROM.commit();
  Serial.printf("Configuration saved: %d sensors\n", activeSensorCount);
}

/**
 * Load sensor configuration from EEPROM
 */
void loadSensorConfig() {
  Serial.println("Loading configuration from EEPROM...");

  uint16_t magic;
  EEPROM.get(EEPROM_MAGIC_ADDR, magic);

  if (magic == EEPROM_MAGIC) {
    EEPROM.get(EEPROM_SENSOR_ADDR, sensorConfig);
    EEPROM.get(EEPROM_SENSOR_COUNT_ADDR, activeSensorCount);

    // Validate sensor count
    if (activeSensorCount < 1 || activeSensorCount > MAX_SENSOR_COUNT) {
      Serial.printf("✗ Invalid sensor count (%d), resetting to 1\n", activeSensorCount);
      activeSensorCount = 1;
      sensorsConfigured = false;
      return;
    }

    Serial.printf("Configuration loaded: %d sensors\n", activeSensorCount);

    Serial.println("Configured sensors:");
    Serial.print("  Ambient: "); printSensorAddress(sensorConfig.sensors[0]); Serial.println();
    for (int i = 1; i < activeSensorCount; i++) {
      Serial.printf("  Pos%d: ", i);
      printSensorAddress(sensorConfig.sensors[i]);
      Serial.println();
    }

    // Validate loaded configuration for duplicates
    if (!validateUniqueConfig()) {
      Serial.println("✗ WARNING: Loaded configuration contains duplicate sensors!");
      Serial.println("   Setup required to fix configuration.");
      sensorsConfigured = false;
      blinkLED(LED_RED_PIN, 5, 200);
    } else {
      Serial.println("✓ Configuration validated - all sensors unique");
      sensorsConfigured = true;
    }
  } else {
    Serial.println("No valid configuration found - setup required");
    sensorsConfigured = false;
  }
}

/**
 * Read all sensors and transmit via LoRa
 * FORMAT: "TX<ID>:<pos1>,<pos2>,...,<pos9>,<ambient>"
 * Sends actual sensor values, fills remaining positions with 0.0
 */
void readAndTransmitData() {
  logToSerial("--- Reading Sensors ---");

  sensors.requestTemperatures();

  // Read all configured sensors
  // sensors[0] is ambient, sensors[1-9] are additional positions
  for (int i = 0; i < activeSensorCount; i++) {
    latestData.temps[i] = sensors.getTempC(sensorConfig.sensors[i]);
  }

  // Get timestamp (milliseconds since boot)
  unsigned long timestamp = millis() / 1000; // Convert to seconds
  latestData.timestamp = timestamp;
  latestData.valid = true;

  // Format data packet with transmitter ID
  // Format: TX<ID>:<pos1>,<pos2>,...,<pos9>,<ambient>
  char packet[256];
  int offset = snprintf(packet, sizeof(packet), "TX%d:", transmitterID);

  // Add sensor values (positions 1-9, then ambient)
  // Format: pos1, pos2, ..., pos9, ambient
  for (int i = 1; i < activeSensorCount; i++) {
    offset += snprintf(packet + offset, sizeof(packet) - offset, "%.1f,", latestData.temps[i]);
  }

  // Fill remaining positions with 0.0
  for (int i = activeSensorCount; i < MAX_SENSOR_COUNT; i++) {
    offset += snprintf(packet + offset, sizeof(packet) - offset, "0.0,");
  }

  // Add ambient (last value, no comma)
  snprintf(packet + offset, sizeof(packet) - offset, "%.1f", latestData.temps[0]);

  // Build log message
  String dataLog = "Data: TX" + String(transmitterID) + " Ambient=" + String(latestData.temps[0], 2) + "°C";
  for (int i = 1; i < activeSensorCount; i++) {
    dataLog += " Pos" + String(i) + "=" + String(latestData.temps[i], 2) + "°C";
  }
  logToSerial(dataLog);

  // Transmit via LoRa
  logToSerial("Transmitting: " + String(packet));

  digitalWrite(LED_GREEN_PIN, HIGH);

  LoRa.beginPacket();
  LoRa.print(packet);
  LoRa.endPacket();

  digitalWrite(LED_GREEN_PIN, LOW);

  // Update LoRa statistics
  loraStats.totalPackets++;
  loraStats.lastPacketTime = millis();

  logToSerial("Transmission complete");
}

/**
 * Print sensor address in hex format
 */
void printSensorAddress(uint8_t* addr) {
  for (int i = 0; i < 8; i++) {
    if (addr[i] < 16) Serial.print("0");
    Serial.print(addr[i], HEX);
    if (i < 7) Serial.print(":");
  }
}

/**
 * Play a tone on the buzzer
 */
void playTone(int frequency, int duration) {
  int period = 1000000 / frequency;
  int halfPeriod = period / 2;
  long cycles = (long)frequency * duration / 1000;

  for (long i = 0; i < cycles; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delayMicroseconds(halfPeriod);
    digitalWrite(BUZZER_PIN, LOW);
    delayMicroseconds(halfPeriod);
  }
}

/**
 * Blink an LED
 */
void blinkLED(int pin, int times, int delayMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(pin, HIGH);
    delay(delayMs);
    digitalWrite(pin, LOW);
    delay(delayMs);
  }
}

/**
 * Save device name to EEPROM
 */
void saveDeviceName() {
  EEPROM.put(EEPROM_NAME_ADDR, deviceName);
  EEPROM.commit();
  Serial.println("Device name saved to EEPROM");
}

/**
 * Load device name from EEPROM
 */
void loadDeviceName() {
  char tempName[MAX_DEVICE_NAME_LENGTH];
  EEPROM.get(EEPROM_NAME_ADDR, tempName);

  // Check if name is valid (printable characters)
  bool valid = true;
  if (tempName[0] == 0 || tempName[0] == 0xFF) {
    valid = false;
  } else {
    for (int i = 0; i < MAX_DEVICE_NAME_LENGTH && tempName[i] != 0; i++) {
      if (tempName[i] < 32 || tempName[i] > 126) {
        valid = false;
        break;
      }
    }
  }

  if (valid) {
    strncpy(deviceName, tempName, MAX_DEVICE_NAME_LENGTH - 1);
    deviceName[MAX_DEVICE_NAME_LENGTH - 1] = 0;
    Serial.printf("Loaded device name: %s\n", deviceName);
  } else {
    Serial.println("No valid device name in EEPROM, using default");
  }
}

/**
 * Save transmitter configuration (ID and power mode) to EEPROM
 */
void saveTransmitterConfig() {
  EEPROM.put(EEPROM_TRANSMITTER_ID_ADDR, transmitterID);
  EEPROM.put(EEPROM_POWER_MODE_ADDR, powerSaveMode);
  EEPROM.commit();

  Serial.printf("Transmitter ID %d saved to EEPROM (Power save: %s)\n",
                transmitterID, powerSaveMode ? "ON" : "OFF");
}

/**
 * Load transmitter configuration (ID and power mode) from EEPROM
 */
void loadTransmitterConfig() {
  uint16_t savedID;
  bool savedPowerMode;

  EEPROM.get(EEPROM_TRANSMITTER_ID_ADDR, savedID);
  EEPROM.get(EEPROM_POWER_MODE_ADDR, savedPowerMode);

  // Validate transmitter ID (0-65535, but 0xFFFF likely means uninitialized)
  if (savedID != 0xFFFF) {
    transmitterID = savedID;
  } else {
    Serial.println("No transmitter ID in EEPROM, using default (1)");
    transmitterID = 1;
  }

  // Load power save mode (validate it's a boolean value)
  if (savedPowerMode == 0 || savedPowerMode == 1) {
    powerSaveMode = savedPowerMode;
  } else {
    Serial.println("Invalid power mode in EEPROM, using default (OFF)");
    powerSaveMode = false;
  }

  Serial.printf("Loaded transmitter config: ID %d, Power save: %s\n",
                transmitterID, powerSaveMode ? "ON" : "OFF");
}

/**
 * Enter deep sleep for power efficiency
 * ESP32 will wake up after DEEP_SLEEP_DURATION_US microseconds
 */
void enterDeepSleep() {
  // Turn off LEDs
  digitalWrite(LED_RED_PIN, LOW);
  digitalWrite(LED_GREEN_PIN, LOW);

  // Disable WiFi to save power
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);

  // Configure wake-up timer
  esp_sleep_enable_timer_wakeup(DEEP_SLEEP_DURATION_US);

  Serial.println("Going to sleep now...");
  Serial.flush();

  // Enter deep sleep
  esp_deep_sleep_start();
}

/**
 * Log message to serial buffer (circular buffer)
 */
void logToSerial(const String& message) {
  Serial.println(message);

  serialBuffer[serialBufferIndex].timestamp = millis();
  serialBuffer[serialBufferIndex].message = message;

  serialBufferIndex = (serialBufferIndex + 1) % SERIAL_BUFFER_SIZE;
  if (serialBufferCount < SERIAL_BUFFER_SIZE) {
    serialBufferCount++;
  }
}

/**
 * Get serial logs as JSON array
 */
String getSerialLogs() {
  StaticJsonDocument<8192> doc;
  JsonArray logs = doc.createNestedArray("logs");

  int start = (serialBufferIndex - serialBufferCount + SERIAL_BUFFER_SIZE) % SERIAL_BUFFER_SIZE;
  for (int i = 0; i < serialBufferCount; i++) {
    int idx = (start + i) % SERIAL_BUFFER_SIZE;
    JsonObject log = logs.createNestedObject();
    log["timestamp"] = serialBuffer[idx].timestamp;
    log["message"] = serialBuffer[idx].message;
  }

  String output;
  serializeJson(doc, output);
  return output;
}

/**
 * Setup WiFi Access Point
 */
void setupWiFi() {
  Serial.println("\n--- Setting up WiFi Access Point ---");

  WiFi.mode(WIFI_AP);
  WiFi.softAP(WIFI_AP_SSID, WIFI_AP_PASSWORD);

  IPAddress IP = WiFi.softAPIP();
  Serial.print("AP IP address: ");
  Serial.println(IP);
  Serial.printf("SSID: %s\n", WIFI_AP_SSID);
  Serial.printf("Password: %s\n", WIFI_AP_PASSWORD);
  Serial.println("WiFi Access Point started");
}

/**
 * Handle root page request
 */
void handleRoot() {
  String html = R"rawliteral(
<!doctype html><html><head>
<meta charset='utf-8'>
<meta name='viewport' content='width=device-width,initial-scale=1'/>
<title>AxleWatch TX Config</title>
<style>
body{font-family:sans-serif;margin:16px;background:#0b1220;color:#e8eefc}
h1{font-size:20px;margin:0 0 16px}
.muted{opacity:.7;font-size:14px}
.card{background:#141b2d;border:1px solid #334;border-radius:10px;padding:20px;margin:16px 0}
.card h2{color:#4cc9f0;margin:0 0 16px;border-bottom:2px solid #4cc9f0;padding-bottom:8px;font-size:18px}
fieldset{border:1px solid #334;padding:12px;margin:12px 0;border-radius:8px}
legend{color:#4cc9f0;font-weight:600;padding:0 8px}
label{display:block;margin:12px 0 4px;font-weight:500}
input,select{width:100%;padding:10px;border-radius:6px;border:1px solid #334;background:#0b1220;color:#e8eefc;font-size:14px;box-sizing:border-box}
input:focus,select:focus{outline:none;border-color:#4cc9f0}
button{padding:12px 20px;border:0;border-radius:8px;background:#4cc9f0;color:#0b1220;font-weight:700;margin-top:12px;width:100%;cursor:pointer;font-size:15px}
button:hover{background:#3ab8df}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:16px 0}
.sensor-box{background:#1a2332;border:2px solid #445;border-radius:8px;padding:16px;text-align:center}
.sensor-box h3{font-size:14px;margin:0 0 8px;opacity:.9;color:#4cc9f0}
.sensor-box .temp{font-size:32px;font-weight:bold;color:#7bd88f}
.status-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #334}
.status-row:last-child{border-bottom:none}
.status-label{color:#888;font-size:14px}
.status-value{color:#4cc9f0;font-weight:600;font-size:14px}
#serialLog{background:#000;color:#0f0;padding:12px;border-radius:8px;height:300px;overflow-y:auto;font-family:'Courier New',monospace;font-size:12px;line-height:1.4;border:1px solid #334}
.log-entry{margin-bottom:4px}
.timestamp{color:#666;margin-right:8px}
.success-msg{background:#1a3d2a;border:1px solid #7bd88f;color:#7bd88f;padding:12px;border-radius:8px;margin-top:12px;display:none}
a{color:#4cc9f0;text-decoration:none}
a:hover{text-decoration:underline}
</style>
</head><body>
<h1>AxleWatch Transmitter - Configuration</h1>
<p class='muted'>AP: )rawliteral" + WiFi.softAPIP().toString() + R"rawliteral( | SSID: AxleWatch-TX</p>

<div class='card'>
<h2>Device Configuration</h2>
<fieldset><legend>Device Settings</legend>
<label>Device Name</label>
<input type='text' id='deviceName' maxlength='31'>
<label>Transmitter ID (0-65535)</label>
<input type='number' id='transmitterID' min='0' max='65535' value='1'>
<label style='display:flex;align-items:center;cursor:pointer;margin-top:16px'>
<input type='checkbox' id='powerSaveMode' style='width:auto;margin-right:8px'>
Enable Power Save Mode (Deep Sleep)
</label>
<p style='font-size:12px;color:#888;margin:8px 0 0'>Power save mode disables WiFi and uses deep sleep between transmissions for maximum battery life. WiFi will only work during initial setup.</p>
</fieldset>
<button onclick='saveConfig()'>Save Configuration</button>
<div class='success-msg' id='configSuccess'>Configuration saved successfully!</div>
</div>

<div class='card'>
<h2>Sensor Readings</h2>
<div class='sensor-box' style='margin-bottom:16px;background:#1a3d2a;border-color:#7bd88f'>
<h3>Ambient</h3>
<div class='temp' id='temp0'>--</div>
</div>
<div class='grid' id='sensorGrid'>
<!-- Additional sensors will be dynamically added here -->
</div>
<div class='status-row'>
<span class='status-label'>Active Sensors:</span>
<span class='status-value' id='sensorCount'>0</span>
</div>
<div class='status-row'>
<span class='status-label'>Last Update:</span>
<span class='status-value' id='lastUpdate'>Never</span>
</div>
</div>

<div class='card'>
<h2>LoRa Status</h2>
<div class='status-row'>
<span class='status-label'>Frequency:</span>
<span class='status-value'>433 MHz (SF7, BW125)</span>
</div>
<div class='status-row'>
<span class='status-label'>TX Power:</span>
<span class='status-value'>20 dBm</span>
</div>
<div class='status-row'>
<span class='status-label'>Total Packets:</span>
<span class='status-value' id='totalPackets'>0</span>
</div>
<div class='status-row'>
<span class='status-label'>Last Transmission:</span>
<span class='status-value' id='lastTx'>Never</span>
</div>
</div>

<div class='card'>
<h2>Serial Monitor</h2>
<div id='serialLog'></div>
</div>

<script>
// Load configuration
fetch('/api/config')
  .then(r=>r.json())
  .then(data=>{
    document.getElementById('deviceName').value=data.name;
    document.getElementById('transmitterID').value=data.transmitterID;
    document.getElementById('powerSaveMode').checked=data.powerSaveMode;
  });

// Save configuration
function saveConfig(){
  const name=document.getElementById('deviceName').value;
  const transmitterID=parseInt(document.getElementById('transmitterID').value);
  const powerSaveMode=document.getElementById('powerSaveMode').checked;
  fetch('/api/config',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({name:name,transmitterID:transmitterID,powerSaveMode:powerSaveMode})
  })
  .then(r=>r.json())
  .then(data=>{
    const msg=document.getElementById('configSuccess');
    msg.style.display='block';
    setTimeout(()=>{msg.style.display='none';},3000);
  });
}

// Update data
function updateData(){
  fetch('/api/data')
    .then(r=>r.json())
    .then(data=>{
      if(data.valid){
        document.getElementById('sensorCount').textContent=data.count;
        document.getElementById('temp0').textContent=data.temps[0].toFixed(1)+'C';

        const grid=document.getElementById('sensorGrid');
        grid.innerHTML='';
        for(let i=1;i<data.count;i++){
          const box=document.createElement('div');
          box.className='sensor-box';
          box.innerHTML='<h3>Position '+i+'</h3><div class="temp">'+data.temps[i].toFixed(1)+'C</div>';
          grid.appendChild(box);
        }

        const date=new Date(data.timestamp*1000);
        document.getElementById('lastUpdate').textContent=date.toLocaleTimeString();
      }
    });
}

// Update LoRa
function updateLoRa(){
  fetch('/api/lora')
    .then(r=>r.json())
    .then(data=>{
      document.getElementById('totalPackets').textContent=data.totalPackets;
      if(data.lastPacketTime>0){
        const elapsed=Math.floor((Date.now()-data.lastPacketTime)/1000);
        document.getElementById('lastTx').textContent=elapsed+'s ago';
      }
    });
}

// Update serial
function updateSerial(){
  fetch('/api/serial')
    .then(r=>r.json())
    .then(data=>{
      const logDiv=document.getElementById('serialLog');
      logDiv.innerHTML='';
      data.logs.forEach(entry=>{
        const div=document.createElement('div');
        div.className='log-entry';
        const ts=Math.floor(entry.timestamp/1000);
        div.innerHTML='<span class="timestamp">['+ts+'s]</span>'+entry.message;
        logDiv.appendChild(div);
      });
      logDiv.scrollTop=logDiv.scrollHeight;
    });
}

// Refresh all
function refreshAll(){
  updateData();
  updateLoRa();
  updateSerial();
}

setInterval(refreshAll,2000);
refreshAll();
</script>
</body></html>
)rawliteral";
  server.send(200, "text/html", html);
}

/**
 * Handle GET /api/config
 */
void handleApiConfigGet() {
  StaticJsonDocument<128> doc;
  doc["name"] = deviceName;
  doc["transmitterID"] = transmitterID;
  doc["powerSaveMode"] = powerSaveMode;
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

/**
 * Handle POST /api/config
 */
void handleApiConfigPost() {
  if (server.hasArg("plain")) {
    String body = server.arg("plain");
    StaticJsonDocument<128> doc;
    DeserializationError error = deserializeJson(doc, body);

    if (!error) {
      if (doc.containsKey("name")) {
        const char* newName = doc["name"];
        strncpy(deviceName, newName, MAX_DEVICE_NAME_LENGTH - 1);
        deviceName[MAX_DEVICE_NAME_LENGTH - 1] = 0;
        saveDeviceName();
      }

      if (doc.containsKey("transmitterID")) {
        uint16_t newID = doc["transmitterID"];
        transmitterID = newID;
      }

      if (doc.containsKey("powerSaveMode")) {
        bool newPowerMode = doc["powerSaveMode"];
        powerSaveMode = newPowerMode;
      }

      // Save transmitter config
      saveTransmitterConfig();

      StaticJsonDocument<128> response;
      response["success"] = true;
      response["name"] = deviceName;
      response["transmitterID"] = transmitterID;
      response["powerSaveMode"] = powerSaveMode;
      String output;
      serializeJson(response, output);
      server.send(200, "application/json", output);
    } else {
      server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
    }
  } else {
    server.send(400, "application/json", "{\"error\":\"No body\"}");
  }
}

/**
 * Handle GET /api/data
 */
void handleApiData() {
  StaticJsonDocument<512> doc;
  doc["valid"] = latestData.valid;
  doc["count"] = activeSensorCount;
  doc["timestamp"] = latestData.timestamp;

  JsonArray temps = doc.createNestedArray("temps");
  for (int i = 0; i < activeSensorCount; i++) {
    temps.add(latestData.temps[i]);
  }

  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

/**
 * Handle GET /api/lora
 */
void handleApiLora() {
  StaticJsonDocument<256> doc;
  doc["totalPackets"] = loraStats.totalPackets;
  doc["lastPacketTime"] = loraStats.lastPacketTime;
  doc["frequency"] = "433 MHz";
  doc["txPower"] = "20 dBm";
  doc["spreadingFactor"] = "SF7";
  doc["bandwidth"] = "125 kHz";
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

/**
 * Handle GET /api/serial
 */
void handleApiSerial() {
  String logs = getSerialLogs();
  server.send(200, "application/json", logs);
}

/**
 * Setup Web Server with all endpoints
 * UI STYLE MATCHES RX WEBSERVER (dark theme #0b1220)
 */
void setupWebServer() {
  Serial.println("Setting up web server...");

  // Route handlers
  server.on("/", HTTP_GET, handleRoot);
  server.on("/api/config", HTTP_GET, handleApiConfigGet);
  server.on("/api/config", HTTP_POST, handleApiConfigPost);
  server.on("/api/data", HTTP_GET, handleApiData);
  server.on("/api/lora", HTTP_GET, handleApiLora);
  server.on("/api/serial", HTTP_GET, handleApiSerial);

  server.begin();
  Serial.println("Web server started on http://" + WiFi.softAPIP().toString());
}
