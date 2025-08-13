import { useState, useEffect } from 'react';
import './DashboardPage.css';

interface DashboardStats {
  totalLogs: number;
  chatLogs: number;
  errorLogs: number;
  averageResponseTime: number;
  mostUsedTools: string[];
}

function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Backend'den istatistikleri çek (örnek veri)
      // Gerçek uygulamada bu endpoint'i backend'de oluşturmanız gerekir
      const mockStats: DashboardStats = {
        totalLogs: 156,
        chatLogs: 142,
        errorLogs: 14,
        averageResponseTime: 2.3,
        mostUsedTools: ['get_books', 'get_information_from_documents', 'get_course_books']
      };
      
      setStats(mockStats);
    } catch (err) {
      setError('Dashboard verileri yüklenirken bir hata oluştu');
      console.error('Dashboard hatası:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Dashboard yükleniyor...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <h2>Hata</h2>
        <p>{error}</p>
        <button onClick={fetchDashboardStats} className="retry-btn">
          Tekrar Dene
        </button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="dashboard-error">
        <h2>Veri Bulunamadı</h2>
        <p>Dashboard verileri yüklenemedi.</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p>Chat Agent performans istatistikleri ve genel bakış</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card total-logs">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>Toplam Log</h3>
            <div className="stat-number">{stats.totalLogs}</div>
            <p>Tüm zamanlar</p>
          </div>
        </div>

        <div className="stat-card chat-logs">
          <div className="stat-icon">💬</div>
          <div className="stat-content">
            <h3>Chat Logları</h3>
            <div className="stat-number">{stats.chatLogs}</div>
            <p>Başarılı sorgular</p>
          </div>
        </div>

        <div className="stat-card error-logs">
          <div className="stat-icon">❌</div>
          <div className="stat-content">
            <h3>Hata Logları</h3>
            <div className="stat-number">{stats.errorLogs}</div>
            <p>Hata oranı: {((stats.errorLogs / stats.totalLogs) * 100).toFixed(1)}%</p>
          </div>
        </div>

        <div className="stat-card response-time">
          <div className="stat-icon">⚡</div>
          <div className="stat-content">
            <h3>Ortalama Yanıt</h3>
            <div className="stat-number">{stats.averageResponseTime}s</div>
            <p>Saniye cinsinden</p>
          </div>
        </div>
      </div>

      <div className="dashboard-sections">
        <div className="section-card">
          <h2>En Çok Kullanılan Araçlar</h2>
          <div className="tools-list">
            {stats.mostUsedTools.map((tool, index) => (
              <div key={index} className="tool-item">
                <span className="tool-rank">#{index + 1}</span>
                <span className="tool-name">{tool}</span>
                <span className="tool-usage">Sık kullanılan</span>
              </div>
            ))}
          </div>
        </div>

        <div className="section-card">
          <h2>Hızlı Erişim</h2>
          <div className="quick-actions">
            <button className="action-btn primary">
              📊 Logları Görüntüle
            </button>
            <button className="action-btn secondary">
              💬 Chat'e Git
            </button>
            <button className="action-btn secondary">
              ⚙️ Ayarlar
            </button>
          </div>
        </div>
      </div>

      <div className="dashboard-footer">
        <p>Son güncelleme: {new Date().toLocaleString('tr-TR')}</p>
      </div>
    </div>
  );
}

export default DashboardPage;
