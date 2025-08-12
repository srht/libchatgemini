# Frontend - Chat Agent & Logs Viewer

Bu dokümantasyon, frontend uygulamasının yeni yapısını ve özelliklerini açıklar.

## 🎯 Yeni Özellikler

### 1. **Çoklu Sayfa Desteği**
- **Chat Sayfası**: Mevcut chat agent arayüzü
- **Logs Sayfası**: Chat agent loglarını görüntüleme arayüzü

### 2. **Modern Navigasyon**
- Üst kısımda sekmeli navigasyon
- Responsive tasarım
- Smooth geçişler

## 📁 Dosya Yapısı

```
front/src/
├── App.tsx              # Ana uygulama (navigasyon + sayfa yöneticisi)
├── App.css              # Ana uygulama stilleri
├── Chatbot.tsx          # Chat agent arayüzü (değiştirilmedi)
├── LogsPage.tsx         # Log görüntüleme sayfası (yeni)
├── LogsPage.css         # Log sayfası stilleri (yeni)
├── main.tsx             # Uygulama giriş noktası
└── index.css            # Global stiller
```

## 🚀 Kullanım

### Ana Uygulama
```typescript
// App.tsx - Ana uygulama bileşeni
function App() {
  const [currentPage, setCurrentPage] = useState<'chat' | 'logs'>('chat')
  
  return (
    <div className="app">
      <nav className="app-nav">
        {/* Navigasyon */}
      </nav>
      <main className="app-main">
        {currentPage === 'chat' ? <Chatbot /> : <LogsPage />}
      </main>
    </div>
  )
}
```

### Chat Sayfası
- Mevcut chat agent arayüzü korundu
- Hiçbir değişiklik yapılmadı
- Tüm özellikler aynen çalışıyor

### Logs Sayfası
```typescript
// LogsPage.tsx - Log görüntüleme bileşeni
function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filterType, setFilterType] = useState<'all' | 'chat' | 'error'>('all')
  
  // Log verilerini backend'den çekme
  const fetchLogs = async () => {
    const response = await axios.get(`http://localhost:3001/logs?limit=${limit}`)
    setLogs(response.data.logs)
  }
  
  // Log temizleme
  const clearLogs = async () => {
    await axios.delete('http://localhost:3001/logs')
    setLogs([])
  }
}
```

## 🎨 Tasarım Özellikleri

### 1. **Modern UI/UX**
- Gradient arka plan
- Glassmorphism efektleri
- Smooth animasyonlar
- Responsive tasarım

### 2. **Navigasyon**
- Üst kısımda sabit navigasyon
- Aktif sayfa vurgusu
- Hover efektleri
- Mobil uyumlu

### 3. **Log Görüntüleme**
- Filtreleme seçenekleri (Tüm, Chat, Hata)
- Log limiti seçimi (25, 50, 100, 200)
- Detaylı log görüntüleme
- Responsive tablo yapısı

## 🔧 Teknik Detaylar

### State Yönetimi
- React hooks kullanımı
- Local state ile sayfa yönetimi
- API çağrıları için axios

### API Entegrasyonu
- Backend log endpoint'leri ile entegrasyon
- Error handling
- Loading states

### Responsive Tasarım
- Mobile-first yaklaşım
- Breakpoint'ler: 768px, 480px
- Flexible layout

## 📱 Responsive Breakpoint'ler

```css
/* Tablet */
@media (max-width: 768px) {
  .app-nav { flex-direction: column; }
  .nav-tabs { justify-content: center; }
}

/* Mobile */
@media (max-width: 480px) {
  .nav-tabs { flex-direction: column; }
  .nav-tab { width: 100%; }
}
```

## 🎯 Kullanım Senaryoları

### 1. **Chat Kullanımı**
- Navigasyonda "💬 Chat" sekmesine tıklayın
- Mevcut chat arayüzü açılır
- Tüm chat özellikleri kullanılabilir

### 2. **Log Görüntüleme**
- Navigasyonda "📊 Loglar" sekmesine tıklayın
- Log sayfası açılır
- Filtreleme ve arama yapabilirsiniz

### 3. **Log Yönetimi**
- Log limitini değiştirin (25-200 arası)
- Log türüne göre filtreleme
- Logları temizleme
- Logları yenileme

## 🚀 Geliştirme

### Frontend Başlatma
```bash
cd front
npm run dev
```

### Build
```bash
npm run build
```

### Lint
```bash
npm run lint
```

## 🔗 Backend Bağlantısı

Frontend, backend'in aşağıdaki endpoint'lerini kullanır:

- `GET /logs?limit=50` - Logları getirme
- `DELETE /logs` - Logları temizleme
- `POST /ask-agent` - Chat agent sorgusu (Chatbot.tsx)

## 📋 Özellik Listesi

### ✅ Tamamlanan
- [x] Çoklu sayfa desteği
- [x] Modern navigasyon
- [x] Log görüntüleme sayfası
- [x] Responsive tasarım
- [x] Filtreleme sistemi
- [x] Log yönetimi
- [x] Error handling
- [x] Loading states

### 🔄 Gelecek Geliştirmeler
- [ ] Real-time log güncelleme
- [ ] Log arama özelliği
- [ ] Log export (CSV, JSON)
- [ ] Log analizi grafikleri
- [ ] Kullanıcı yetkilendirme
- [ ] Dark mode
- [ ] Log bookmark'ları

## 🐛 Sorun Giderme

### Log Sayfası Açılmıyor
- Backend'in çalıştığından emin olun
- `http://localhost:3001/logs` endpoint'ini test edin
- Console'da hata mesajlarını kontrol edin

### Stil Sorunları
- CSS dosyalarının doğru yüklendiğinden emin olun
- Browser cache'ini temizleyin
- DevTools'da CSS hatalarını kontrol edin

### API Bağlantı Sorunları
- Backend port numarasını kontrol edin
- CORS ayarlarını kontrol edin
- Network sekmesinde API çağrılarını inceleyin

## 📚 Kaynaklar

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Documentation](https://vitejs.dev/)
- [Axios Documentation](https://axios-http.com/)
