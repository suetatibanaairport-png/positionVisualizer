// ==========================
// ESP8266(NodeMCU) + Pot(50k) + TM1637 + RGB LED + Web + WiFiManager
//  - キャリブ(最小～最大→0..100)をEEPROMに保存/読み込み
//  - RGB LED(PWM)をHTTP APIで設定、色・明るさ(0..255)をEEPROM保存/読み込み
//  - WiFiManagerでSSID/PASS設定
// ==========================

#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <TM1637Display.h>
#include <WiFiManager.h>
#include <WiFiUdp.h>
#include <EEPROM.h>

// --------- ピン定義 ----------
#define CALIB_BUTTON_PIN D3    // 押すとLOW（内部プルアップ）
#define TM1637_CLK_PIN   D1
#define TM1637_DIO_PIN   D2

// RGB LED（共通カソード想定：GND, R, G, B）
#define PIN_LED_R D5
#define PIN_LED_G D6
#define PIN_LED_B D7

// 共通アノードLEDの場合は true にして出力を反転
const bool LED_COMMON_ANODE = true;

#define A0_MOV_AVG_WINDOW   32       // 16〜256 推奨
#define A0_SAMPLE_INTERVAL  8        // ms: 5〜10ms程度
#include <CircularBuffer.h>

// --------- オブジェクト ----------
ESP8266WebServer server(80);
TM1637Display display(TM1637_CLK_PIN, TM1637_DIO_PIN);

WiFiUDP udp;
const uint16_t DISCOVERY_PORT = 4210;
String deviceId;

// --------- 状態・パラメータ ----------
bool calibHolding = false;
bool calibrated   = false;
int  calibMin     = 0;
int  calibMax     = 1023;   // NodeMCUの多くは0..1023スケール

uint8_t rgbR = 0, rgbG = 128, rgbB = 255; // 初期色
uint8_t brightness = 255;                  // 0..255（全体スケール）
uint32_t lastDispMs = 0;

// --------- EEPROM 設定 ---------
#define EEPROM_SIZE 128
#define CFG_MAGIC   0xA5
#define CFG_VERSION 0x01

struct Config {
  uint8_t magic;
  uint8_t version;
  // キャリブ
  uint8_t calibrated;  // 0/1
  int16_t calibMin;    // 0..1023想定
  int16_t calibMax;    // 0..1023想定
  // LED
  uint8_t rgbR;
  uint8_t rgbG;
  uint8_t rgbB;
  uint8_t brightness;  // 0..255
  // 予備
  uint8_t reserved[16];
  // チェックサム
  uint8_t checksum;
};

Config g_cfg;

uint8_t calcChecksum(const Config &c) {
  const uint8_t *p = (const uint8_t*)&c;
  size_t n = sizeof(Config)-1; // checksum自身を除く
  uint8_t s = 0;
  for (size_t i=0;i<n;i++) s += p[i];
  return s;
}

void loadConfig() {
  EEPROM.begin(EEPROM_SIZE);
  EEPROM.get(0, g_cfg);
  if (g_cfg.magic != CFG_MAGIC || g_cfg.version != CFG_VERSION ||
      g_cfg.checksum != calcChecksum(g_cfg)) {
    // 初期化
    memset(&g_cfg, 0, sizeof(g_cfg));
    g_cfg.magic = CFG_MAGIC;
    g_cfg.version = CFG_VERSION;
    g_cfg.calibrated = 0;
    g_cfg.calibMin = 0;
    g_cfg.calibMax = 1023;
    g_cfg.rgbR = rgbR;
    g_cfg.rgbG = rgbG;
    g_cfg.rgbB = rgbB;
    g_cfg.brightness = brightness;
    g_cfg.checksum = calcChecksum(g_cfg);
    EEPROM.put(0, g_cfg);
    EEPROM.commit();
  }

  // 反映
  calibrated = g_cfg.calibrated != 0;
  calibMin = g_cfg.calibMin;
  calibMax = g_cfg.calibMax;
  rgbR = g_cfg.rgbR;
  rgbG = g_cfg.rgbG;
  rgbB = g_cfg.rgbB;
  brightness = g_cfg.brightness;
}

void saveConfig(bool saveCalib, bool saveLED) {
  // 現状態を g_cfg に反映
  if (saveCalib) {
    g_cfg.calibrated = calibrated ? 1 : 0;
    g_cfg.calibMin = calibMin;
    g_cfg.calibMax = calibMax;
  }
  if (saveLED) {
    g_cfg.rgbR = rgbR;
    g_cfg.rgbG = rgbG;
    g_cfg.rgbB = rgbB;
    g_cfg.brightness = brightness;
  }
  g_cfg.magic = CFG_MAGIC;
  g_cfg.version = CFG_VERSION;
  g_cfg.checksum = calcChecksum(g_cfg);
  EEPROM.put(0, g_cfg);
  EEPROM.commit();
}

// ========= A0 平滑化モジュール =========
namespace A0Smooth {
  static CircularBuffer<uint16_t, A0_MOV_AVG_WINDOW> buf;
  static uint32_t sum = 0;
  static bool inited = false;
  static uint16_t lastRaw = 0;

  void begin(uint16_t seed=0){
    buf.clear(); sum=0;
    for(int i=0;i<A0_MOV_AVG_WINDOW;i++){ buf.push(seed); sum += seed; }
    lastRaw = seed; inited=true;
  }
  void push(uint16_t v){
    lastRaw = v;
    if(!inited) begin(v);
    if(buf.isFull()){ uint16_t old = buf.shift(); sum -= old; }
    buf.push(v); sum += v;
  }
  inline int read(){ int n=buf.size(); return n? (int)((sum + n/2)/n) : 0; }
  inline int lastRawSample(){ return (int)lastRaw; }
}


int mapTo0_100(long raw, long mn, long mx) {
  if (mx == mn) return 0;
  long num = (raw - mn) * 100L;
  long den = (mx - mn);
  long val = (num >= 0) ? (num + den/2) / den : (num - den/2) / den;
  if (val < 0) val = 0;
  if (val > 100) val = 100;
  return (int)val;
}

// --------- RGB LED 出力 ----------
void applyLed() {
  // 輝度スケーリング（0..255）
  auto scale = [](uint8_t c, uint8_t bri)->uint8_t {
    return (uint16_t)c * (uint16_t)bri / 255;
  };
  uint8_t r = scale(rgbR, brightness);
  uint8_t g = scale(rgbG, brightness);
  uint8_t b = scale(rgbB, brightness);

  if (LED_COMMON_ANODE) {
    r = 255 - r; g = 255 - g; b = 255 - b;
  }
  analogWrite(PIN_LED_R, r);
  analogWrite(PIN_LED_G, g);
  analogWrite(PIN_LED_B, b);
}

// ---- シンプルWeb UI（色を反映するUIに簡易変更）----
const char* INDEX_HTML = R"HTML(
<!doctype html>
<html>
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ESP8266 Pot + RGB</title>
<style>
body{font-family:sans-serif;margin:2rem;}h1{margin:.2rem 0 1rem}
.card{border:1px solid #ddd;border-radius:8px;padding:1rem;max-width:520px}
.row{display:flex;justify-content:space-between;margin:.3rem 0}
.mono{font-family:ui-monospace,Menlo,Consolas,monospace}
.btn{display:inline-block;padding:.4rem .7rem;border:1px solid #333;border-radius:6px;text-decoration:none;color:#333}
.btn:hover{background:#f2f2f2}.small{color:#666;font-size:.9rem}
input[type=range]{width:220px}
.swatch{width:28px;height:28px;border-radius:4px;border:1px solid #aaa;display:inline-block;vertical-align:middle}
</style>
</head>
<body>
<h1>Pot + RGB Monitor</h1>
<div class="card">
  <div class="row"><div>Raw (A0)</div><div id="raw" class="mono">-</div></div>
  <div class="row"><div>Mapped (0–100)</div><div id="val" class="mono">-</div></div>
  <div class="row small"><div>Range</div><div class="mono"><span id="mn">-</span> .. <span id="mx">-</span></div></div>
  <hr/>
  <div class="row"><div>R</div><div><input id="r" type="range" min="0" max="255"><span class="mono" id="rv">-</span></div></div>
  <div class="row"><div>G</div><div><input id="g" type="range" min="0" max="255"><span class="mono" id="gv">-</span></div></div>
  <div class="row"><div>B</div><div><input id="b" type="range" min="0" max="255"><span class="mono" id="bv">-</span></div></div>
  <div class="row"><div>Brightness</div><div><input id="br" type="range" min="0" max="255"><span class="mono" id="brv">-</span></div></div>
  <div class="row"><div>Preview</div><div class="swatch" id="sw"></div></div>
  <div style="margin-top:1rem">
    <a class="btn" href="/reset">Reset calibration</a>
    <a class="btn" href="/api">JSON</a>
    <a class="btn" href="/saveled">Save LED</a>
  </div>
</div>
<script>
async function fetchApi(){
  const r = await fetch('/api'); const j = await r.json();
  raw.textContent=j.raw; val.textContent=j.calibrated_value;
  mn.textContent=j.calib_min; mx.textContent=j.calib_max;
  r_.value=j.led_r; g_.value=j.led_g; b_.value=j.led_b; br_.value=j.led_brightness;
  rv.textContent=j.led_r; gv.textContent=j.led_g; bv.textContent=j.led_b; brv.textContent=j.led_brightness;
  sw.style.background='rgb('+j.led_r+','+j.led_g+','+j.led_b+')';
}
async function setColor(){
  const u='/setcolor?r='+r_.value+'&g='+g_.value+'&b='+b_.value+'&save=0';
  await fetch(u); rv.textContent=r_.value; gv.textContent=g_.value; bv.textContent=b_.value;
  sw.style.background='rgb('+r_.value+','+g_.value+','+b_.value+')';
}
async function setBr(){
  const u='/setbrightness?v='+br_.value+'&save=0';
  await fetch(u); brv.textContent=br_.value;
}
async function saveLed(){ await fetch('/saveled'); }
const r_=document.getElementById('r'),g_=document.getElementById('g'),b_=document.getElementById('b'),br_=document.getElementById('br');
const rv=document.getElementById('rv'),gv=document.getElementById('gv'),bv=document.getElementById('bv'),brv=document.getElementById('brv'),sw=document.getElementById('sw');
r_.addEventListener('input', setColor); g_.addEventListener('input', setColor); b_.addEventListener('input', setColor);
br_.addEventListener('input', setBr);
setInterval(fetchApi, 500); fetchApi();
</script>
</body>
</html>
)HTML";

// ---- HTTPハンドラ ----
void sendJSON() {
  int raw = A0Smooth::read();
  int mapped = calibrated ? mapTo0_100(raw, calibMin, calibMax) : 0;
  String json = "{";
  json += "\"raw\":" + String(raw) + ",";
  json += "\"calibrated_value\":" + String(mapped) + ",";
  json += "\"calibrated\":" + String(calibrated ? "true" : "false") + ",";
  json += "\"calib_min\":" + String(calibMin) + ",";
  json += "\"calib_max\":" + String(calibMax) + ",";
  json += "\"led_r\":" + String(rgbR) + ",";
  json += "\"led_g\":" + String(rgbG) + ",";
  json += "\"led_b\":" + String(rgbB) + ",";
  json += "\"led_brightness\":" + String(brightness);
  json += "}";
  server.send(200, "application/json; charset=utf-8", json);
}

void handleRoot(){ server.send(200, "text/html; charset=utf-8", INDEX_HTML); }

void handleReset(){
  calibrated = false;
  calibMin = 0;
  calibMax = 1023;
  server.sendHeader("Location", "/");
  server.send(302, "text/plain", "Reset");
}

void handleSetColor(){
  if (server.hasArg("r")) rgbR = constrain(server.arg("r").toInt(), 0, 255);
  if (server.hasArg("g")) rgbG = constrain(server.arg("g").toInt(), 0, 255);
  if (server.hasArg("b")) rgbB = constrain(server.arg("b").toInt(), 0, 255);
  applyLed();
  bool doSave = server.hasArg("save") && server.arg("save") == "1";
  if (doSave) saveConfig(false, true);
  sendJSON();
}

void handleSetBrightness(){
  if (server.hasArg("v")) brightness = constrain(server.arg("v").toInt(), 0, 255);
  applyLed();
  bool doSave = server.hasArg("save") && server.arg("save") == "1";
  if (doSave) saveConfig(false, true);
  sendJSON();
}

void handleSaveLED(){
  saveConfig(false, true);
  server.send(200, "text/plain; charset=utf-8", "LED saved");
}

bool waitLongPressAtBoot(uint8_t pin, uint16_t ms){
  uint32_t t0 = millis();
  while(millis() - t0 < ms){
    if(digitalRead(pin) != LOW) return false;
    delay(10);
  }
  return true;
}

void setup() {
  Serial.begin(115200);
  delay(50);

  pinMode(CALIB_BUTTON_PIN, INPUT_PULLUP);
  pinMode(PIN_LED_R, OUTPUT);
  pinMode(PIN_LED_G, OUTPUT);
  pinMode(PIN_LED_B, OUTPUT);

  display.setBrightness(7, true);
  display.showNumberDec(0, false);

  // PWMレンジ/周波数（必要に応じて調整）
  analogWriteRange(255);
  analogWriteFreq(1000);

  // ---- 設定読み込み ----
  loadConfig();
  applyLed();

  // ---- WiFiManager ----
  WiFiManager wm;
  wm.setHostname("ESP8266-Pot-RGB");
  wm.setConnectRetries(3);
  wm.setConfigPortalTimeout(180);

  if (digitalRead(CALIB_BUTTON_PIN) == LOW && waitLongPressAtBoot(CALIB_BUTTON_PIN, 3000)){
    Serial.println("WiFi settings reset requested.");
    wm.resetSettings();
    wm.startConfigPortal("PotConfigAP");
  } else {
    bool ok = wm.autoConnect("PotConfigAP");
    if(!ok) {
      Serial.println("WiFi autoConnect failed");
    }
  }
  Serial.print("IP: "); Serial.println(WiFi.localIP());

  // ---- Webサーバ ----
  server.on("/", handleRoot);
  server.on("/api", sendJSON);
  server.on("/reset", handleReset);
  server.on("/setcolor", handleSetColor);
  server.on("/setbrightness", handleSetBrightness);
  server.on("/saveled", handleSaveLED);
  server.begin();
  Serial.println("HTTP server started");
  
  // UDP
  deviceId = String(ESP.getChipId(), HEX);
  udp.begin(DISCOVERY_PORT);

  // 最初は適当な初期値で満たす（0でもOK）
  A0Smooth::begin(0);
}

void loop() {
  static uint32_t nextSampleMs = 0;
  uint32_t now = millis();
  if((int32_t)(now - nextSampleMs) >= 0){
    nextSampleMs = now + A0_SAMPLE_INTERVAL;

    // ここだけでA0を読む（毎ループではなく、所定間隔）
    uint16_t v = analogRead(A0);
    A0Smooth::push(v);
  }

  server.handleClient();
  
  // ---- キャリブ：押下中 min/max 学習、離したら確定 ----
  bool btn = (digitalRead(CALIB_BUTTON_PIN) == LOW);
  static bool prevBtn = false;

  if (btn && !prevBtn) {
    calibHolding = true; calibrated = false;
    int cur = A0Smooth::read();
    calibMin = cur; calibMax = cur;
  }
  if (btn && calibHolding) {
    int cur = A0Smooth::read();
    if (cur < calibMin) calibMin = cur;
    if (cur > calibMax) calibMax = cur;
  }
  if (!btn && prevBtn) {
    calibHolding = false; calibrated = true;
    // 保存（キャリブ完了時点で即保存したい場合は true に）
    saveConfig(true, false);
  }
  prevBtn = btn;

  // ---- 表示更新（50ms毎）----
  if (now - lastDispMs >= 50) {
    lastDispMs = now;
    int raw = A0Smooth::read();
    if (calibrated) {
      int v = mapTo0_100(raw, calibMin, calibMax); // 0..100
      display.showNumberDec(v, false, 3, 1);       // 右3桁に表示
    } else {
      int show = raw; if (show > 9999) show = 9999;
      display.showNumberDec(show, true);
    }
  }

  int len = udp.parsePacket();
  if (len > 0) {
    char buf[64]; int n = udp.read(buf, sizeof(buf)-1); buf[n] = 0;
    if (String(buf) == "DISCOVER_ENCODER") {
      String resp = "{\"type\":\"encoder\",\"id\":\"" + deviceId +
                    "\",\"ip\":\"" + WiFi.localIP().toString() + "\"}";
      udp.beginPacket(udp.remoteIP(), udp.remotePort());
      udp.write(resp.c_str());
      udp.endPacket();
    }
  }
}
