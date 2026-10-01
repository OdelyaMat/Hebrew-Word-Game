/*
 * Hebrew RFID Game - Single Reader (turn-based, both players share one reader)
 *
 * Players take turns on a single RFID reader. The server tracks whose turn it
 * is, so this sketch just reports each scan; it does not identify the player.
 *
 * Hardware:
 *   - Arduino Uno/Leonardo
 *   - 1x MFRC522 RFID reader
 *   - ESP8266 WiFi module via SoftwareSerial
 *
 * Wiring:
 *   Reader shares SPI: SCK=13, MOSI=11, MISO=12
 *   Reader:            SDA=10, RST=9
 *   WiFi ESP8266:      RX=2,   TX=3
 *   LED Green=6, LED Red=7
 */

#include <SPI.h>
#include <MFRC522.h>
#include <WiFiEsp.h>
#include <SoftwareSerial.h>

// ===== CONFIGURATION =====
#define SERVER_IP   "192.168.1.100"   // Your PC's local IP (run ipconfig)
#define SERVER_PORT 3000
#define WIFI_SSID   "YourNetworkName"
#define WIFI_PASS   "YourNetworkPassword"

// ===== PINS =====
#define SS_PIN      10    // Reader SS
#define RST_PIN     9     // Reader RST

#define LED_GREEN   6
#define LED_RED     7

#define WIFI_RX     2     // ESP8266 TX -> Arduino pin 2
#define WIFI_TX     3     // ESP8266 RX -> Arduino pin 3

// ===== DEBOUNCE =====
#define DEBOUNCE_MS  2000

// How often to check the WiFi link and reconnect if it dropped.
#define WIFI_CHECK_MS 5000

MFRC522 reader1(SS1_PIN, RST1_PIN);
MFRC522 reader2(SS2_PIN, RST2_PIN);

SoftwareSerial espSerial(WIFI_RX, WIFI_TX);
WiFiEspClient client;

String lastUid1 = "";
String lastUid2 = "";
unsigned long lastScanTime1 = 0;
unsigned long lastScanTime2 = 0;
unsigned long lastWifiCheck = 0;

void setup() {
  Serial.begin(115200);
  espSerial.begin(9600);

  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_RED,   OUTPUT);

  WiFi.init(&espSerial);

  if (connectWifi()) {
    blinkBoth(LED_GREEN_P1, LED_GREEN_P2, 3);
  } else {
    blinkBoth(LED_RED_P1, LED_RED_P2, 5);
  }

  SPI.begin();
  reader.PCD_Init();
  Serial.println("RFID reader ready.");
}

void loop() {
  // Periodically make sure WiFi is still up; reconnect if it dropped mid-game.
  if (millis() - lastWifiCheck > WIFI_CHECK_MS) {
    lastWifiCheck = millis();
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi link down, attempting reconnect...");
      connectWifi();
    }
  }

  checkReader(reader1, 1, lastUid1, lastScanTime1, LED_GREEN_P1, LED_RED_P1);
  checkReader(reader2, 2, lastUid2, lastScanTime2, LED_GREEN_P2, LED_RED_P2);
}

// Attempt to (re)connect to WiFi. Returns true on success.
bool connectWifi() {
  Serial.print("Connecting to WiFi...");
  int status = WiFi.begin(WIFI_SSID, WIFI_PASS);
  if (status == WL_CONNECTED) {
    Serial.print(" Connected! IP: ");
    Serial.println(WiFi.localIP());
    return true;
  }
  Serial.println(" Failed!");
  return false;
}

void checkReader(MFRC522 &reader, int readerId,
                 String &lastUid, unsigned long &lastScanTime,
                 int ledGreen, int ledRed) {
  if (!reader.PICC_IsNewCardPresent() || !reader.PICC_ReadCardSerial()) {
    return;
  }

  String uid = getUidString(reader);
  unsigned long now = millis();

  if (uid == lastUid && (now - lastScanTime) < DEBOUNCE_MS) {
    reader.PICC_HaltA();
    reader.PCD_StopCrypto1();
    return;
  }

  lastUid = uid;
  lastScanTime = now;

  Serial.print("Scanned: ");
  Serial.println(uid);

  String body = sendScan(readerId, uid);

  if (body.indexOf("\"correct\"") >= 0) {
    Serial.println("CORRECT!");
    blinkLed(ledGreen, 2);
  } else if (body.indexOf("\"wrong\"") >= 0) {
    Serial.println("Wrong answer");
    blinkLed(ledRed, 1);
  }

  reader.PICC_HaltA();
  reader.PCD_StopCrypto1();
}

// Extract the value of the JSON "status" field from the HTTP response body
// (the part after the blank line that separates headers from body). This is
// robust to header contents and to other fields being present.
String parseStatus(String response) {
  int bodyStart = response.indexOf("\r\n\r\n");
  String body = bodyStart >= 0 ? response.substring(bodyStart + 4) : response;

  int key = body.indexOf("\"status\"");
  if (key < 0) return "";
  int firstQuote = body.indexOf("\"", body.indexOf(":", key));
  if (firstQuote < 0) return "";
  int secondQuote = body.indexOf("\"", firstQuote + 1);
  if (secondQuote < 0) return "";
  return body.substring(firstQuote + 1, secondQuote);
}

String getUidString(MFRC522 &reader) {
  String uid = "";
  for (byte i = 0; i < reader.uid.size; i++) {
    if (i > 0) uid += " ";
    if (reader.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(reader.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

// Returns just the JSON response body (headers stripped), or "" on failure.
String sendScan(int readerId, String uid) {
  String payload = "{\"reader\":" + String(readerId) + ",\"uid\":\"" + uid + "\"}";

  // If the connection fails, try to recover the WiFi link and connect once more.
  bool connected = client.connect(SERVER_IP, SERVER_PORT);
  if (!connected) {
    Serial.println("Connection failed, checking WiFi...");
    if (WiFi.status() != WL_CONNECTED) connectWifi();
    connected = client.connect(SERVER_IP, SERVER_PORT);
  }

  if (!connected) {
    Serial.println("Connection failed");
    blinkBoth(LED_RED_P1, LED_RED_P2, 2);
    return "";
  }

  client.println("POST /api/scan HTTP/1.1");
  client.print("Host: ");
  client.print(SERVER_IP);
  client.print(":");
  client.println(SERVER_PORT);
  client.println("Content-Type: application/json");
  client.print("Content-Length: ");
  client.println(payload.length());
  client.println("Connection: close");
  client.println();
  client.println(payload);

  String response = "";
  unsigned long timeout = millis() + 5000;
  while (client.connected() && millis() < timeout) {
    while (client.available()) {
      char c = client.read();
      response += c;
    }
  }
  client.stop();

  // Return only the body (everything after the blank line) so header text can't
  // be mistaken for the result and changes to headers don't affect parsing.
  int split = response.indexOf("\r\n\r\n");
  if (split >= 0) {
    return response.substring(split + 4);
  }
  return response;
}

void blinkLed(int pin, int times) {
  for (int i = 0; i < times; i++) {
    digitalWrite(pin, HIGH);
    delay(150);
    digitalWrite(pin, LOW);
    delay(150);
  }
}
