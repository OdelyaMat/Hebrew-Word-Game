# Hebrew Word Game 🎮

A two-player, turn-based Hebrew vocabulary game using RFID cards. Players share **one** RFID reader and take turns: the screen shows a Hebrew word and highlights whose turn it is — that player scans the matching picture card to score. Most points after all rounds wins!

---

## How It Works

1. Each physical card has a picture on it (dog, cat, apple, etc.)
2. The screen shows a Hebrew word and whose turn it is
3. The active player searches their cards for the matching picture
4. They scan the correct card on the shared reader to score the round
5. Turns alternate between the two players each round
6. Most points after all rounds wins!

---

## Requirements

### Software
- [Node.js](https://nodejs.org) (v16 or later)

### Hardware (optional — game works without it for testing)
- Arduino Uno or Leonardo
- 1× MFRC522 RFID reader module (shared by both players)
- ESP8266 WiFi module
- 4–8 RFID cards or key fobs (13.56 MHz / MIFARE)
- 2 LEDs (green + red) + 220Ω resistors (optional, for scan feedback)

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open the game
http://localhost:3000

# 4. Open the admin page to register cards
http://localhost:3000/admin
```

---

## Word List

The game includes 8 words across four categories:

| Hebrew | Nikkud | English | Category |
|--------|--------|---------|----------|
| כלב | כֶּלֶב | Dog | Animal |
| חתול | חָתוּל | Cat | Animal |
| דג | דָּג | Fish | Animal |
| אדום | אָדֹם | Red | Color |
| כחול | כָּחֹל | Blue | Color |
| תפוח | תַּפּוּחַ | Apple | Food |
| בננה | בָּנָנָה | Banana | Food |
| פרח | פֶּרַח | Flower | Nature |

---

## Playing Without Hardware

You can test the full game using `curl` to simulate card scans.

**1. Register some cards (use any made-up UIDs):**
```bash
curl -X POST http://localhost:3000/api/words/dog/card \
  -H "Content-Type: application/json" \
  -d "{\"uid\": \"AA BB CC 01\"}"

curl -X POST http://localhost:3000/api/words/cat/card \
  -H "Content-Type: application/json" \
  -d "{\"uid\": \"AA BB CC 02\"}"
```

**2. Start the game:**
```bash
curl -X POST http://localhost:3000/api/game/start
```

**3. Simulate a scan.** With a single shared reader, the server attributes the
scan to whoever's turn it is — the `reader` field is accepted but ignored:
```bash
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d "{\"reader\": 1, \"uid\": \"AA BB CC 01\"}"
```

**4. Skip a round:**
```bash
curl -X POST http://localhost:3000/api/game/skip
```

---

## Arduino Setup

### Wiring (single shared reader)

```
Arduino Uno
───────────────────────────────────────────────
Pin 13 ───── SCK  (Reader)
Pin 12 ───── MISO (Reader)
Pin 11 ───── MOSI (Reader)
Pin 10 ───── SDA  (Reader)
Pin  9 ───── RST  (Reader)
3.3V   ───── VCC  (Reader) ⚠️ NOT 5V!
GND    ───── GND  (Reader)

Pin  2 ───── ESP8266 TX (WiFi module)
Pin  3 ───── ESP8266 RX (WiFi module, use voltage divider)

Pin  6 ───── Green LED (correct scan) + 220Ω to GND
Pin  7 ───── Red LED   (wrong scan)   + 220Ω to GND
```

### Arduino Libraries

Install these via **Arduino IDE → Sketch → Include Library → Manage Libraries**:
- `MFRC522` by GithubCommunity
- `WiFiEsp` by bportaluri

### Configure the sketch

Open `arduino/rfid_reader.ino` and update these lines at the top:

```cpp
#define SERVER_IP   "192.168.1.100"   // Your PC's local IP address
#define SERVER_PORT 3000
#define WIFI_SSID   "YourNetworkName"
#define WIFI_PASS   "YourNetworkPassword"
```

To find your PC's local IP on Windows:
```
ipconfig
```
Look for the IPv4 address under your WiFi adapter.

### Upload

Upload the sketch to the Arduino. The LEDs will blink green 3 times when WiFi connects successfully.

---

## Registering Cards

1. Start the server (`npm start`)
2. Open `http://localhost:3000/admin`
3. Power on the Arduino — it will connect to WiFi
4. Scan any card near a reader
5. The "Last Scanned Card UID" updates on the admin page
6. Click **Use Last Scan** next to the word you want to assign that card to
7. Repeat for all cards

> **Tip:** You can assign the same card to multiple words if you have fewer cards than words. During gameplay, a card is only correct when it matches the word currently shown on screen.

---

## Game Options

### Nikkud toggle
The Nikkud toggle (vowel marks) on the welcome screen and during gameplay shows/hides the small dots and dashes that indicate how to pronounce Hebrew words. Turn it off to make the game harder.

### Card sharing
You can map fewer cards to more words (e.g. 4 cards for 8 words). Each card can be assigned to 2 different words. Scan the card, assign it to the first word, scan it again, assign it to the second word.

---

## File Structure

```
├── server.js          # Game server (Express + WebSocket)
├── package.json
├── data/
│   └── words.json     # Word list and card UID mappings (auto-updated)
├── public/
│   ├── index.html     # Game UI
│   ├── style.css      # Styling
│   ├── game.js        # Frontend game logic
│   ├── admin.html     # Card registration page
│   └── admin.js       # Admin logic
└── arduino/
    └── rfid_reader.ino  # Arduino sketch
```

---

## Troubleshooting

**Port 3000 already in use**
```powershell
# Windows — find and kill the process
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

**Arduino can't connect to WiFi**
- Red LEDs blink 5 times on startup if WiFi fails
- Double-check `WIFI_SSID` and `WIFI_PASS` in the sketch
- Make sure the server PC and Arduino are on the same network

**Card not recognized**
- Check the UID shown on the admin page matches what's registered
- Make sure the card is held still and flat against the reader

**Game won't start**
- At least one card must be registered in the admin page before starting
- If you click Start with no cards registered, the welcome screen now shows a "Register cards first" message

---

## Configuration

A few behaviors can be tuned with environment variables when starting the server:

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | HTTP/WebSocket port |
| `MAX_ROUNDS` | number of words in `words.json` | Caps how many rounds a game runs |

```bash
# Example: run on port 8080 with at most 5 rounds
PORT=8080 MAX_ROUNDS=5 npm start
```

---

## License

Licensed under the [Apache License 2.0](LICENSE).
