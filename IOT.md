# Going Live with Real IoT Sensors

By default Kiteline **simulates** temperatures in the browser. To use **real sensors**,
devices push readings to the backend, and the app then shows that live data
automatically (no more simulation when a backend is running).

## How it works

```
 Sensor  ──▶  Network/Gateway  ──▶  POST /api/ingest  ──▶  db.json (state.sensors)
(fridge)      (WiFi / LoRaWAN)        x-api-key header         │
                                                              ▼
                                   App polls /api/state every 5s ──▶ live UI + alerts
```

- Devices authenticate with the **`x-api-key`** header (not a user login).
- A reading out of a sensor's safe range **auto-creates a critical alert**.
- The app refreshes the Dashboard / Temperatures / Alerts views live.

## 1. Set your ingest key

The default demo key is `kiteline-demo-key`. Set your own before going live:

```bash
# Windows PowerShell
$env:INGEST_KEY="your-secret-key"; npm start

# macOS/Linux
INGEST_KEY=your-secret-key npm start
```

## 2. The endpoint

`POST http://<host>:4000/api/ingest`
Header: `x-api-key: <your key>`  ·  Body: JSON

Single reading:
```json
{ "sensorId": "s1", "temp": 3.4, "battery": 92, "signal": 88 }
```

Batch (many sensors at once):
```json
{ "readings": [
  { "sensorId": "s1", "temp": 3.4 },
  { "sensorId": "s7", "temp": 6.1 }
] }
```

Sensor IDs are the ones in the app (`s1`–`s8` in the demo; see the Temperatures page,
or add your own with **Add sensor**).

### Test it now (PowerShell)
```powershell
Invoke-WebRequest -Method POST -Uri http://localhost:4000/api/ingest `
  -Headers @{ "x-api-key" = "kiteline-demo-key" } `
  -ContentType "application/json" `
  -Body '{"sensorId":"s1","temp":3.2,"battery":95}'
```

### Test it now (curl)
```bash
curl -X POST http://localhost:4000/api/ingest \
  -H "x-api-key: kiteline-demo-key" \
  -H "Content-Type: application/json" \
  -d '{"sensorId":"s1","temp":3.2}'
```

Watch the Temperatures page update within ~5 seconds.

## 3. Real hardware options

### A) WiFi sensor (ESP32 + DS18B20) — easiest
Flash an ESP32 to read a probe and POST every minute:

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
// ... connect WiFi, read tempC from DS18B20 ...
HTTPClient http;
http.begin("http://192.168.1.50:4000/api/ingest");   // your server IP
http.addHeader("Content-Type", "application/json");
http.addHeader("x-api-key", "your-secret-key");
String body = "{\"sensorId\":\"s1\",\"temp\":" + String(tempC, 1) + "}";
http.POST(body);
http.end();
```

### B) LoRaWAN sensor (e.g. Dragino LHT65) via The Things Stack
1. Add the device in **The Things Stack (TTN)**.
2. TTN console → **Integrations → Webhooks → Custom webhook**.
3. Base URL: `http://<your-host>:4000`  ·  Uplink path: `/api/ingest`.
4. Add header `x-api-key: your-secret-key`.
5. Map the decoded payload to `{ sensorId, temp }` (use a TTN payload formatter or a
   tiny relay script if your decoder field names differ).

### C) Commercial sensor clouds (SensorPush, Mobile Alerts, etc.)
Run a small cron/script that reads their API and forwards each reading to
`/api/ingest` in the format above.

## 4. Going to production (notes)
- Put the server behind HTTPS (a reverse proxy like Caddy/Nginx) so device keys aren't
  sent in clear text.
- Use a strong `INGEST_KEY` (or per-device keys if you extend the endpoint).
- For many sensors/high frequency, swap the JSON file for a database and add
  WebSocket/SSE push instead of 5-second polling.
