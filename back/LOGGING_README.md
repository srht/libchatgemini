# Chat Agent Logging Sistemi

Bu dokümantasyon, backend Node.js uygulamasında chat agent'ın kullanıcı isteklerini ve dönüşlerini loglamak için geliştirilen logging sistemini açıklar.

## Özellikler

- **Otomatik Log Kaydı**: Her chat agent çağrısı otomatik olarak loglanır
- **Detaylı Bilgi Toplama**: Kullanıcı sorgusu, agent yanıtı, kullanılan araçlar, çalışma süresi
- **Hata Loglama**: Hata durumlarında detaylı hata bilgileri kaydedilir
- **Dosya Tabanlı**: Tüm loglar `logs/chat_logs.txt` dosyasında saklanır
- **API Endpoint'leri**: Logları görüntülemek ve yönetmek için REST API'ler

## Dosya Yapısı

```
back/
├── components/
│   └── logger.js          # Ana logging sınıfı
├── logs/
│   └── chat_logs.txt      # Log dosyası
└── chatagent.js           # Ana uygulama (logging entegre edilmiş)
```

## Kullanım

### 1. Otomatik Logging

Chat agent'a gelen her istek otomatik olarak loglanır:

```javascript
// chatagent.js'de otomatik olarak çalışır
app.post("/ask-agent", async (req, res) => {
  // ... agent işlemi ...
  
  // Otomatik logging
  chatLogger.logChat(query, result.output, toolsUsed, executionTime, null, additionalInfo);
});
```

### 2. Manuel Logging

Gerekirse manuel olarak da log yazabilirsiniz:

```javascript
const ChatLogger = require('./components/logger');
const logger = new ChatLogger();

// Basit chat log
logger.logChat(
  'Kullanıcı sorgusu',
  'Agent yanıtı',
  ['kullanılan_araç1', 'kullanılan_araç2'],
  150 // ms cinsinden çalışma süresi
);

// Hata log
try {
  // ... kod ...
} catch (error) {
  logger.logError(error, 'Hata bağlamı');
}
```

### 3. API Endpoint'leri

#### Logları Görüntüleme
```bash
GET /logs?limit=50
```

**Response:**
```json
{
  "logs": [
    {
      "Timestamp": "2025-08-12 10:46:12.967",
      "User Query": "Merhaba, kütüphanede hangi kitaplar var?",
      "Tools Used": "greeting",
      "Execution Time": "150ms",
      "Agent Response": "Merhaba! Kütüphanemizde..."
    }
  ],
  "total": 1
}
```

#### Logları Temizleme
```bash
DELETE /logs
```

**Response:**
```json
{
  "message": "Log dosyası temizlendi"
}
```

## Log Formatı

### Chat Log Entry
```
=== CHAT LOG ENTRY ===
Timestamp: 2025-08-12 10:46:12.967
User Query: Kullanıcı sorgusu
Tools Used: tool1, tool2
Execution Time: 150ms
Additional Info:
  key1: "value1"
  key2: "value2"
Agent Response: Agent yanıtı
=== END LOG ENTRY ===
```

### Error Log Entry
```
=== ERROR LOG ===
Timestamp: 2025-08-12 10:46:12.983
Context: Hata bağlamı
Error: Hata mesajı
Stack: Hata stack trace
=== END ERROR LOG ===
```

## Konfigürasyon

Log dosyası konumu `components/logger.js` dosyasında tanımlanmıştır:

```javascript
class ChatLogger {
  constructor() {
    this.logDir = path.join(__dirname, '..', 'logs');
    this.logFile = path.join(this.logDir, 'chat_logs.txt');
    // ...
  }
}
```

## Örnek Kullanım Senaryoları

### 1. Kitap Arama
```
User Query: Simyacı kitabını arıyorum
Tools Used: get_books, get_information_from_documents
Execution Time: 2500ms
Additional Info:
  bookTitle: "Simyacı"
  author: "Paulo Coelho"
  callNumber: "PL2718.O46 S56 2013"
  location: "Central Library 2nd Floor"
```

### 2. Hata Durumu
```
Context: Agent sorgusu işlenirken hata
Error: API anahtarı geçersiz
Stack: Error: API anahtarı geçersiz
    at ChatGoogleGenerativeAI...
```

## Performans

- Log yazma işlemi asenkron olarak yapılır
- Dosya I/O işlemleri non-blocking
- Log dosyası boyutu kontrol edilmez (manuel temizleme gerekli)

## Güvenlik

- Log dosyaları public erişime açık değildir
- Hassas bilgiler (API anahtarları, kullanıcı bilgileri) loglanmaz
- Log dosyası sadece backend sunucusu tarafından yazılır

## Sorun Giderme

### Log Dosyası Bulunamıyor
- `logs/` klasörünün varlığını kontrol edin
- Dosya yazma izinlerini kontrol edin

### Log Yazma Hatası
- Disk alanını kontrol edin
- Dosya izinlerini kontrol edin
- Konsol çıktısında hata mesajlarını kontrol edin

### Log Okuma Hatası
- Log dosyası formatını kontrol edin
- Dosya encoding'ini kontrol edin (UTF-8)

## Gelecek Geliştirmeler

- [ ] Log rotasyonu (eski logları otomatik silme)
- [ ] Log seviyeleri (DEBUG, INFO, WARN, ERROR)
- [ ] Veritabanı entegrasyonu
- [ ] Log analizi ve raporlama
- [ ] Real-time log streaming
- [ ] Log compression
