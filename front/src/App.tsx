import { Routes, Route, Link, useLocation } from 'react-router-dom'
import Chatbot from './Chatbot'
import LogsPage from './LogsPage'
import DashboardPage from './DashboardPage'
import SettingsPage from './SettingsPage'
import './App.css'

function App() {
  const location = useLocation()

  return (
    <div className="app">
      <nav className="app-nav">
        <div className="nav-brand">
          <h2>ITU Library Chat Agent</h2>
        </div>
        <div className="nav-tabs">
          <Link 
            to="/" 
            className={`nav-tab ${location.pathname === '/' ? 'active' : ''}`}
          >
            💬 Chat
          </Link>
          <Link 
            to="/dashboard" 
            className={`nav-tab ${location.pathname === '/dashboard' ? 'active' : ''}`}
          >
            📈 Dashboard
          </Link>
          <Link 
            to="/logs" 
            className={`nav-tab ${location.pathname === '/logs' ? 'active' : ''}`}
          >
            📊 Loglar
          </Link>
          <Link 
            to="/about" 
            className={`nav-tab ${location.pathname === '/about' ? 'active' : ''}`}
          >
            ℹ️ Hakkında
          </Link>
          <Link 
            to="/settings" 
            className={`nav-tab ${location.pathname === '/chat/settings' ? 'active' : ''}`}
          >
            ⚙️ Ayarlar
          </Link>
        </div>
      </nav>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Chatbot />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  )
}

// Hakkında sayfası
function AboutPage() {
  return (
    <div className="about-page">
      <div className="about-content">
        <h1>ITU Library Chat Agent</h1>
        <p className="about-description">
          Bu uygulama, İTÜ Kütüphanesi için geliştirilmiş yapay zeka destekli 
          bir chat agent'ıdır. Kullanıcılar kütüphane hizmetleri hakkında 
          sorular sorabilir ve hızlı yanıtlar alabilir.
        </p>
        
        <div className="features-section">
          <h2>Özellikler</h2>
          <ul>
            <li>📚 Kitap arama ve yer bilgisi</li>
            <li>🎓 Ders materyali arama</li>
            <li>🔍 Veritabanı bilgileri</li>
            <li>📧 E-posta yazma yardımı</li>
            <li>📊 Detaylı log kayıtları</li>
          </ul>
        </div>

        <div className="tech-section">
          <h2>Teknolojiler</h2>
          <div className="tech-grid">
            <div className="tech-item">
              <h3>Frontend</h3>
              <p>React, TypeScript, Vite</p>
            </div>
            <div className="tech-item">
              <h3>Backend</h3>
              <p>Node.js, Express, LangChain</p>
            </div>
            <div className="tech-item">
              <h3>AI</h3>
              <p>Google Gemini, OpenAI GPT</p>
            </div>
          </div>
        </div>

        <div className="contact-section">
          <h2>İletişim</h2>
          <p>
            Sorularınız için: <a href="mailto:library@itu.edu.tr">library@itu.edu.tr</a>
          </p>
        </div>
      </div>
    </div>
  )
}

// 404 sayfası
function NotFoundPage() {
  return (
    <div className="not-found-page">
      <div className="not-found-content">
        <h1>404</h1>
        <h2>Sayfa Bulunamadı</h2>
        <p>Aradığınız sayfa mevcut değil.</p>
        <Link to="/" className="home-link">
          🏠 Ana Sayfaya Dön
        </Link>
      </div>
    </div>
  )
}

export default App
