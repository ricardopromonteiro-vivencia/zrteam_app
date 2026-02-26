/*
 * ZR Team - NFC Check-in System (ESP32)
 * ------------------------------------
 * Este código permite que um ESP32 com leitor NFC (MFRC522) envie o UID do
 * cartão para uma Edge Function do Supabase para realizar o check-in
 * automático.
 */

#include <HTTPClient.h>
#include <MFRC522.h>
#include <SPI.h>
#include <WiFi.h>


// --- CONFIGURAÇÃO ---
const char *ssid = "NOME_DA_TUA_REDE_WIFI";
const char *password = "PASSWORD_DO_WIFI";

// URL da tua Edge Function no Supabase
// Ex: https://xxxxxxxxxxxx.supabase.co/functions/v1/nfc-checkin
const char *supabase_url =
    "https://cbbxlhdscqckqwuxbbuz.supabase.co/functions/v1/nfc-checkin";
const char *supabase_key =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiYnhsaGRzY3Fja3F3dXhiYnV6Iiwicm9sZSI6Im"
    "Fub24iLCJpYXQiOjE3NzIwNjQyMzYsImV4cCI6MjA4NzY0MDIzNn0."
    "ngDFRZPQvQqwOqdeLBDD0CjA1gDo6flwWu7GBgfdU-0"; // VITE_SUPABASE_ANON_KEY

// Pinos para o MFRC522 (Padrão ESP32)
#define SS_PIN 5
#define RST_PIN 22
MFRC522 mfrc522(SS_PIN, RST_PIN);

void setup() {
  Serial.begin(115200);
  SPI.begin();
  mfrc522.PCD_Init();

  Serial.print("A ligar ao WiFi...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi ligado!");
  Serial.println("Aguardando cartão NFC...");
}

void loop() {
  // Se não houver novo cartão, retorna
  if (!mfrc522.PICC_IsNewCardPresent() || !mfrc522.PICC_ReadCardSerial()) {
    return;
  }

  // Obter UID do cartão como String
  String uid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    uid += String(mfrc522.uid.uidByte[i] < 0x10 ? "0" : "");
    uid += String(mfrc522.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();

  Serial.print("Cartão detectado UID: ");
  Serial.println(uid);

  // Enviar para o Supabase
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(supabase_url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer " + String(supabase_key));

    // JSON com o UID e o ID da aula (o ID da aula pode ser lido de um QR Code
    // ou fixo para o dia) Para simplificar, enviamos apenas o UID e deixamos o
    // server encontrar a aula ativa.
    String jsonPayload = "{\"nfc_uid\":\"" + uid + "\"}";

    int httpResponseCode = http.POST(jsonPayload);

    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.print("Resposta: ");
      Serial.println(httpResponseCode);
      Serial.println(response);
      // Feedback visual (podes ligar um LED verde aqui)
    } else {
      Serial.print("Erro no envio: ");
      Serial.println(httpResponseCode);
      // Feedback de erro (podes ligar um LED vermelho aqui)
    }
    http.end();
  }

  delay(2000); // Evitar leituras repetidas imediatas
  mfrc522.PICC_HaltA();
}
