/*
  Kiteline temperature probe → POST /api/ingest
  Hardware: ESP32 + DS18B20 waterproof probe (1-Wire on GPIO 4)
  WiFi: set below. Server: your PC IP or kiteline.uk when deployed.

  Libraries (Arduino IDE): WiFi, HTTPClient, OneWire, DallasTemperature
*/
#include <WiFi.h>
#include <HTTPClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>

const char* WIFI_SSID = "YOUR_WIFI";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";
const char* INGEST_URL = "http://192.168.1.50:4001/api/ingest";
const char* API_KEY = "kiteline-demo-key";
const char* SENSOR_ID = "s1";

#define ONE_WIRE_BUS 4
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

void setup() {
  Serial.begin(115200);
  sensors.begin();
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\nWiFi OK");
}

void loop() {
  sensors.requestTemperatures();
  float tempC = sensors.getTempCByIndex(0);
  if (tempC == DEVICE_DISCONNECTED_C) {
    Serial.println("Probe error");
    delay(60000);
    return;
  }

  HTTPClient http;
  http.begin(INGEST_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", API_KEY);
  String body = "{\"sensorId\":\"" + String(SENSOR_ID) + "\",\"temp\":" + String(tempC, 1) + ",\"battery\":100}";
  int code = http.POST(body);
  Serial.printf("POST %d temp=%.1f\n", code, tempC);
  http.end();
  delay(60000);
}
