# React Router ile Sayfa Yönetimi

Bu dokümantasyon, React uygulamasına eklenen routing sistemini ve yeni sayfaları açıklar.

## 🎯 Eklenen Özellikler

### 1. **React Router Entegrasyonu**
- `react-router-dom` paketi eklendi
- BrowserRouter ile client-side routing
- Programmatic navigation desteği

### 2. **Yeni Sayfalar**
- **Chat** (`/`) - Ana chat agent arayüzü
- **Dashboard** (`/dashboard`) - İstatistikler ve genel bakış
- **Logs** (`/logs`) - Chat agent logları
- **About** (`/about`) - Uygulama hakkında bilgiler
- **Settings** (`/settings`) - Uygulama ayarları
- **404** - Sayfa bulunamadı

## 📁 Dosya Yapısı

```
front/src/
├── App.tsx              # Ana routing yapısı
├── App.css              # Ana stiller
├── Chatbot.tsx          # Chat sayfası (/)
├── DashboardPage.tsx    # Dashboard sayfası (/dashboard)
├── LogsPage.tsx         # Log sayfası (/logs)
├── SettingsPage.tsx     # Ayarlar sayfası (/settings)
├── main.tsx             # Router entegrasyonu
└── index.css            # Global stiller
```

## 🚀 Routing Sistemi

### Ana Router Yapısı
```typescript
// main.tsx
import { BrowserRouter } from 'react-router-dom'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```

### Route Tanımları
```typescript
// App.tsx
<Routes>
  <Route path="/" element={<Chatbot />} />
  <Route path="/dashboard" element={<DashboardPage />} />
  <Route path="/logs" element={<LogsPage />} />
  <Route path="/about" element={<AboutPage />} />
  <Route path="/settings" element={<SettingsPage />} />
  <Route path="*" element={<NotFoundPage />} />
</Routes>
```

### Navigasyon
```typescript
// Link kullanımı
<Link to="/dashboard" className="nav-tab">
  📈 Dashboard
</Link>

// Programmatic navigation
import { useNavigate } from 'react-router-dom'
const navigate = useNavigate()
navigate('/dashboard')
```

## 📱 Sayfa Detayları

### 1. **Chat Sayfası** (`/`)
- Mevcut chat agent arayüzü
- Hiçbir değişiklik yapılmadı
- Tüm özellikler korundu

### 2. **Dashboard Sayfası** (`/dashboard`)
- **İstatistik Kartları**: Toplam log, chat log, hata log, ortalama yanıt süresi
- **En Çok Kullanılan Araçlar**: Tool kullanım sıralaması
- **Hızlı Erişim**: Diğer sayfalara kolay erişim
- **Responsive Tasarım**: Mobil ve tablet uyumlu

### 3. **Logs Sayfası** (`/logs`)
- **Filtreleme**: Tüm, Chat, Hata logları
- **Log Yönetimi**: Yenileme, temizleme, limit ayarlama
- **Detaylı Görüntüleme**: Her log için genişletilebilir detaylar
- **API Entegrasyonu**: Backend log endpoint'leri

### 4. **About Sayfası** (`/about`)
- **Uygulama Tanıtımı**: Özellikler ve teknolojiler
- **Özellik Listesi**: Chat agent yetenekleri
- **Teknoloji Stack**: Frontend, Backend, AI teknolojileri
- **İletişim Bilgileri**: Kütüphane iletişim

### 5. **Settings Sayfası** (`/settings`)
- **Görünüm Ayarları**: Tema, dil seçimi
- **Bildirim Ayarları**: Bildirim tercihleri
- **Otomatik Yenileme**: Log yenileme aralığı
- **Veri Yönetimi**: Log temizleme, export
- **LocalStorage**: Ayarları tarayıcıda saklama

### 6. **404 Sayfası**
- **Kullanıcı Dostu**: Açıklayıcı hata mesajı
- **Ana Sayfa Linki**: Kolay navigasyon
- **Modern Tasarım**: Gradient butonlar

## 🎨 Tasarım Özellikleri

### 1. **Modern UI/UX**
- Gradient arka planlar
- Glassmorphism efektleri
- Smooth animasyonlar
- Hover efektleri

### 2. **Responsive Tasarım**
- Mobile-first yaklaşım
- Breakpoint'ler: 768px, 480px
- Flexible grid sistemleri
- Touch-friendly butonlar

### 3. **Renk Kodlaması**
- **Primary**: #667eea (Mavi)
- **Success**: #27ae60 (Yeşil)
- **Warning**: #f39c12 (Turuncu)
- **Danger**: #e74c3c (Kırmızı)
- **Info**: #3498db (Mavi)

## 🔧 Teknik Detaylar

### State Yönetimi
- React hooks kullanımı
- Local state ile sayfa yönetimi
- LocalStorage entegrasyonu
- API state management

### Component Yapısı
- Functional components
- TypeScript interface'leri
- Props ve state yönetimi
- Event handling

### CSS Styling
- CSS modules (gelecekte)
- Responsive breakpoint'ler
- CSS Grid ve Flexbox
- CSS animations

## 📱 Responsive Breakpoint'ler

```css
/* Tablet */
@media (max-width: 768px) {
  .app-nav { flex-direction: column; }
  .nav-tabs { justify-content: center; }
  .stats-grid { grid-template-columns: 1fr; }
}

/* Mobile */
@media (max-width: 480px) {
  .nav-tabs { flex-direction: column; }
  .nav-tab { width: 100%; }
  .settings-actions { flex-direction: column; }
}
```

## 🚀 Yeni Sayfa Ekleme

### 1. **Component Oluşturma**
```typescript
// NewPage.tsx
import React from 'react';
import './NewPage.css';

function NewPage() {
  return (
    <div className="new-page">
      <h1>Yeni Sayfa</h1>
      <p>Sayfa içeriği...</p>
    </div>
  );
}

export default NewPage;
```

### 2. **CSS Dosyası Oluşturma**
```css
/* NewPage.css */
.new-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}
```

### 3. **Route Ekleme**
```typescript
// App.tsx
import NewPage from './NewPage';

// Navigasyona ekle
<Link to="/new-page" className="nav-tab">
  🆕 Yeni Sayfa
</Link>

// Route ekle
<Route path="/new-page" element={<NewPage />} />
```

## 🔗 Backend Entegrasyonu

### API Endpoint'leri
- `GET /logs` - Log verilerini getirme
- `DELETE /logs` - Logları temizleme
- `POST /ask-agent` - Chat agent sorgusu

### Gelecek Endpoint'ler
- `GET /dashboard/stats` - Dashboard istatistikleri
- `POST /settings` - Ayarları kaydetme
- `GET /export/logs` - Log export

## 📋 Özellik Listesi

### ✅ Tamamlanan
- [x] React Router entegrasyonu
- [x] 5 ana sayfa
- [x] Responsive navigasyon
- [x] Modern UI/UX tasarım
- [x] TypeScript desteği
- [x] LocalStorage entegrasyonu
- [x] Error handling
- [x] Loading states

### 🔄 Gelecek Geliştirmeler
- [ ] Dark mode tema
- [ ] Çoklu dil desteği
- [ ] Real-time güncelleme
- [ ] PWA desteği
- [ ] Offline çalışma
- [ ] Push notifications
- [ ] User authentication

## 🐛 Sorun Giderme

### Routing Sorunları
- BrowserRouter'ın doğru import edildiğinden emin olun
- Route path'lerinin doğru tanımlandığını kontrol edin
- Link component'lerinin doğru kullanıldığını kontrol edin

### Sayfa Yüklenmiyor
- Component'in doğru export edildiğini kontrol edin
- CSS dosyasının import edildiğini kontrol edin
- Console'da hata mesajlarını kontrol edin

### Stil Sorunları
- CSS dosyalarının doğru yüklendiğini kontrol edin
- CSS class isimlerinin doğru olduğunu kontrol edin
- Responsive breakpoint'leri kontrol edin

## 📚 Kaynaklar

- [React Router Documentation](https://reactrouter.com/)
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [CSS Grid Guide](https://css-tricks.com/snippets/css/complete-guide-grid/)
- [CSS Flexbox Guide](https://css-tricks.com/snippets/css/a-guide-to-flexbox/)
