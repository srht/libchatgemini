import { useState } from 'react';
import './SettingsPage.css';

interface Settings {
  theme: 'light' | 'dark' | 'auto';
  language: 'tr' | 'en';
  notifications: boolean;
  autoRefresh: boolean;
  refreshInterval: number;
}

function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    theme: 'light',
    language: 'tr',
    notifications: true,
    autoRefresh: false,
    refreshInterval: 30
  });

  const [saved, setSaved] = useState(false);

  const handleSettingChange = (key: keyof Settings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    // Burada ayarları localStorage'a veya backend'e kaydedebilirsiniz
    localStorage.setItem('chatAgentSettings', JSON.stringify(settings));
    setSaved(true);
    
    // 3 saniye sonra saved mesajını kaldır
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    const defaultSettings: Settings = {
      theme: 'light',
      language: 'tr',
      notifications: true,
      autoRefresh: false,
      refreshInterval: 30
    };
    setSettings(defaultSettings);
    setSaved(false);
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>⚙️ Ayarlar</h1>
        <p>Uygulama tercihlerinizi ve görünüm ayarlarınızı yapılandırın</p>
      </div>

      {saved && (
        <div className="save-notification">
          ✅ Ayarlar başarıyla kaydedildi!
        </div>
      )}

      <div className="settings-container">
        <div className="settings-section">
          <h2>🎨 Görünüm</h2>
          
          <div className="setting-item">
            <label htmlFor="theme">Tema:</label>
            <select
              id="theme"
              value={settings.theme}
              onChange={(e) => handleSettingChange('theme', e.target.value)}
            >
              <option value="light">Açık</option>
              <option value="dark">Koyu</option>
              <option value="auto">Otomatik</option>
            </select>
            <p className="setting-description">
              Uygulamanın görünüm temasını seçin
            </p>
          </div>

          <div className="setting-item">
            <label htmlFor="language">Dil:</label>
            <select
              id="language"
              value={settings.language}
              onChange={(e) => handleSettingChange('language', e.target.value)}
            >
              <option value="tr">Türkçe</option>
              <option value="en">English</option>
            </select>
            <p className="setting-description">
              Uygulama dilini seçin
            </p>
          </div>
        </div>

        <div className="settings-section">
          <h2>🔔 Bildirimler</h2>
          
          <div className="setting-item">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.notifications}
                onChange={(e) => handleSettingChange('notifications', e.target.checked)}
              />
              <span className="checkmark"></span>
              Bildirimleri etkinleştir
            </label>
            <p className="setting-description">
              Önemli güncellemeler için bildirim alın
            </p>
          </div>
        </div>

        <div className="settings-section">
          <h2>🔄 Otomatik Yenileme</h2>
          
          <div className="setting-item">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.autoRefresh}
                onChange={(e) => handleSettingChange('autoRefresh', e.target.checked)}
              />
              <span className="checkmark"></span>
              Otomatik yenileme
            </label>
            <p className="setting-description">
              Logları otomatik olarak yenileyin
            </p>
          </div>

          {settings.autoRefresh && (
            <div className="setting-item">
              <label htmlFor="refreshInterval">Yenileme aralığı (saniye):</label>
              <input
                type="range"
                id="refreshInterval"
                min="10"
                max="300"
                step="10"
                value={settings.refreshInterval}
                onChange={(e) => handleSettingChange('refreshInterval', parseInt(e.target.value))}
              />
              <span className="range-value">{settings.refreshInterval}s</span>
              <p className="setting-description">
                Logların ne sıklıkla yenileneceğini belirleyin
              </p>
            </div>
          )}
        </div>

        <div className="settings-section">
          <h2>📊 Veri Yönetimi</h2>
          
          <div className="setting-item">
            <button className="danger-btn" onClick={() => {
              if (window.confirm('Tüm loglar silinecek. Bu işlem geri alınamaz. Emin misiniz?')) {
                // Log temizleme işlemi
                alert('Loglar temizlendi');
              }
            }}>
              🗑️ Tüm Logları Temizle
            </button>
            <p className="setting-description">
              Tüm log verilerini kalıcı olarak silin
            </p>
          </div>

          <div className="setting-item">
            <button className="secondary-btn" onClick={() => {
              // Log export işlemi
              alert('Log export özelliği yakında eklenecek');
            }}>
              📥 Logları Dışa Aktar
            </button>
            <p className="setting-description">
              Logları CSV veya JSON formatında dışa aktarın
            </p>
          </div>
        </div>

        <div className="settings-actions">
          <button className="save-btn" onClick={handleSave}>
            💾 Ayarları Kaydet
          </button>
          <button className="reset-btn" onClick={handleReset}>
            🔄 Varsayılana Döndür
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
