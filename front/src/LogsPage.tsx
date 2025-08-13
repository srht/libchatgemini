import { useState, useEffect } from 'react';
import axios from 'axios';
import './LogsPage.css';

interface ToolDetail {
  step: number;
  tool: string;
  input: string;
  observation: string;
  log?: string;
}

interface ChainExecution {
  totalSteps: number;
  toolDetails: ToolDetail[];
  model?: string;
  timestamp?: string;
  log?: string;
  chainLogs?: any[];
}

interface LogEntry {
  type: 'chat' | 'error';
  timestamp: string;
  userQuery?: string;
  toolsUsed?: string[];
  executionTime?: string | number;
  agentResponse?: string;
  chainExecution?: ChainExecution;
  additionalInfo?: Record<string, any>;
  context?: string;
  error?: {
    type: string;
    name: string;
    message: string;
    code?: string;
    cause?: any;
    stack?: string;
    additionalProperties?: Record<string, any>;
  };
}

interface LogsResponse {
  logs: LogEntry[];
  total: number;
}

function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'chat' | 'error'>('all');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get<LogsResponse>(`http://localhost:3001/logs?limit=${limit}`);
      //const response = await axios.get<LogsResponse>(`https://service.library.itu.edu.tr/chat/api/logs?limit=${limit}`);
      setLogs(response.data.logs);
    } catch (err) {
      setError('Loglar yüklenirken bir hata oluştu');
      console.error('Log yükleme hatası:', err);
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = async () => {
    if (window.confirm('Tüm loglar silinecek. Emin misiniz?')) {
      try {
        await axios.delete('http://localhost:3001/logs');
        setLogs([]);
        alert('Loglar başarıyla temizlendi');
      } catch (err) {
        setError('Loglar temizlenirken bir hata oluştu');
        console.error('Log temizleme hatası:', err);
      }
    }
  };

  const exportJsonLogs = async () => {
    try {
      const response = await axios.get('http://localhost:3001/logs/export', {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'chat_logs.json');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      alert('JSON log dosyası başarıyla indirildi');
    } catch (err) {
      setError('JSON export yapılırken bir hata oluştu');
      console.error('JSON export hatası:', err);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('tr-TR');
    } catch {
      return timestamp;
    }
  };

  const formatExecutionTime = (time: string | number) => {
    // Eğer time number ise, direkt kullan
    if (typeof time === 'number') {
      const num = time;
      if (num < 1000) return `${num}ms`;
      if (num < 60000) return `${(num / 1000).toFixed(1)}s`;
      return `${(num / 60000).toFixed(1)}m`;
    }
    
    // Eğer time string ise, eski formatı kullan
    const timeStr = time.replace('ms', '');
    const num = parseInt(timeStr);
    if (num < 1000) return `${num}ms`;
    if (num < 60000) return `${(num / 1000).toFixed(1)}s`;
    return `${(num / 60000).toFixed(1)}m`;
  };

  const formatValue = (value: any): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'boolean') return value.toString();
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2);
      } catch (e) {
        return '[Complex Object]';
      }
    }
    return String(value);
  };

  const getFilteredLogs = () => {
    if (filterType === 'all') return logs.filter(log => log != null);
    if (filterType === 'chat') return logs.filter(log => log?.userQuery && log?.agentResponse);
    if (filterType === 'error') return logs.filter(log => log?.error);
    return logs.filter(log => log != null);
  };

  const renderChainExecution = (chainExecution: ChainExecution) => {
    console.log("CHAIN EXECUTION:",chainExecution);
    return (
      <div className="log-section">
        <h4>🔗 Chain Execution Detayları:</h4>
        <div className="chain-execution">
          <div className="chain-summary">
            <span className="chain-steps">Toplam Adım: {chainExecution.totalSteps}</span>
          </div>
          
          {/* Chain Execution Log */}
          {chainExecution.log && (
            <div className="chain-log">
              <h5>📝 Chain Log:</h5>
              <div className="log-content-text">
                {formatValue(chainExecution.log)}
              </div>
            </div>
          )}
          
          {/* Detailed Chain Logs */}
          {chainExecution.chainLogs && chainExecution.chainLogs.length > 0 && (
            <div className="detailed-chain-logs">
              <h5>🔍 Detailed Chain Logs:</h5>
              <div className="chain-logs-list">
                {chainExecution.chainLogs.map((chainLog, index) => (
                  <div key={index} className="chain-log-item">
                    <div className="chain-log-header">
                      <span className="chain-log-type">{chainLog.type}</span>
                      <span className="chain-log-time">{new Date(chainLog.timestamp).toLocaleTimeString()}</span>
                      <span className="chain-log-id">ID: {chainLog.runId}</span>
                    </div>
                    <div className="chain-log-content">
                      {chainLog.chainName && (
                        <div><strong>Chain:</strong> {chainLog.chainName}</div>
                      )}
                      {chainLog.llmName && (
                        <div><strong>LLM:</strong> {chainLog.llmName}</div>
                      )}
                      {chainLog.toolName && (
                        <div><strong>Tool:</strong> {chainLog.toolName}</div>
                      )}
                      {chainLog.inputs && (
                        <div><strong>Inputs:</strong> <pre>{formatValue(chainLog.inputs)}</pre></div>
                      )}
                      {chainLog.outputs && (
                        <div><strong>Outputs:</strong> <pre>{formatValue(chainLog.outputs)}</pre></div>
                      )}
                      {chainLog.action && (
                        <div><strong>Action:</strong> <pre>{formatValue(chainLog.action)}</pre></div>
                      )}
                      {chainLog.text && (
                        <div><strong>Text:</strong> <pre>{formatValue(chainLog.text)}</pre></div>
                      )}
                      {chainLog.parentRunId && (
                        <div><strong>Parent ID:</strong> {chainLog.parentRunId}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {chainExecution.toolDetails && (
            <div className="tool-execution-details">
              <h5>🛠️ Tool Execution Details:</h5>
              {chainExecution.toolDetails.map((tool, index) => (
                <div key={index} className="tool-execution-step">
                  <div className="step-header">
                    <span className="step-number">Adım {tool.step}</span>
                    <span className="tool-name">{tool.tool}</span>
                  </div>
                  
                  <div className="step-details">
                    <div className="step-input">
                      <strong>Input:</strong> {formatValue(tool.input)}
                    </div>
                    
                    <div className="step-observation">
                      <strong>Observation:</strong>
                      <div className="observation-content">
                        {formatValue(tool.observation)}
                      </div>
                    </div>
                    
                    {/* Tool Log */}
                    {tool.log && (
                      <div className="step-log">
                        <strong>Log:</strong>
                        <div className="log-content-text">
                          {formatValue(tool.log)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderLogContent = (log: LogEntry) => {
    
    if (log?.userQuery && log?.agentResponse) {
      // Chat log
      return (
        <div className="log-content">
          <div className="log-header">
            <span className="log-type chat">Chat</span>
            <span className="log-time">{formatTimestamp(log?.timestamp)}</span>
            {log?.executionTime && (
              <span className="execution-time">{formatExecutionTime(log.executionTime)}</span>
            )}
            {log?.chainExecution && renderChainExecution(log.chainExecution)}
            {log?.additionalInfo?.model && (
              <span className="model-info">🤖 {log?.additionalInfo?.model}</span>
            )}
          </div>
          
          <div className="log-section">
            <h4>Kullanıcı Sorgusu:</h4>
            <p className="user-query">{log?.userQuery}</p>
          </div>

          {log?.toolsUsed && (
            <div className="log-section">
              <h4>Kullanılan Araçlar:</h4>
              <div className="tools-list">
                {log.toolsUsed && Array.isArray(log.toolsUsed) && log?.toolsUsed?.map((tool, index) => (
                  <span key={index} className="tool-tag">{tool.trim()}</span>
                ))}
              </div>
            </div>
          )}

          {log?.additionalInfo && (
            <div className="log-section">
              <h4>Ek Bilgiler:</h4>
              {typeof log?.additionalInfo === 'object' ? (
                <div className="additional-info-object">
                  {log?.additionalInfo?.intermediateSteps !== undefined && (
                    <div className="info-item">
                      <strong>Intermediate Steps:</strong> {log?.additionalInfo?.intermediateSteps}
                    </div>
                  )}
                  {log?.additionalInfo?.toolDetails && Array.isArray(log?.additionalInfo?.toolDetails) && log?.additionalInfo?.toolDetails.length > 0 && (
                    <div className="info-item">
                      <strong>Tool Details:</strong>
                      <div className="tool-details-list">
                        {log?.additionalInfo?.toolDetails.map((tool, index) => (
                          <div key={index} className="tool-detail-item">
                            <div className="tool-detail-header">
                              <span className="tool-step">Step {tool.step}</span>
                              <span className="tool-name">{tool.tool}</span>
                            </div>
                            <div className="tool-detail-content">
                              <div><strong>Input:</strong> {formatValue(tool.input)}</div>
                              <div><strong>Observation:</strong> {formatValue(tool.observation)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {log?.additionalInfo?.model && (
                    <div className="info-item">
                      <strong>Model:</strong> {log?.additionalInfo?.model}
                    </div>
                  )}
                  {log?.additionalInfo?.timestamp && (
                    <div className="info-item">
                      <strong>Timestamp:</strong> {log?.additionalInfo?.timestamp}
                    </div>
                  )}
                  {/* Diğer Additional Info alanları için */}
                  {Object.entries(log?.additionalInfo).map(([key, value]) => {
                    if (!['intermediateSteps', 'toolDetails', 'model', 'timestamp'].includes(key)) {
                      return (
                        <div key={key} className="info-item">
                          <strong>{key}:</strong> {JSON.stringify(value)}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              ) : (
                <pre className="additional-info">{JSON.stringify(log?.additionalInfo, null, 2)}</pre>
              )}
            </div>
          )}

          {/* Direct properties olarak da kontrol et */}
          {log?.chainExecution && (
            <div className="log-section">
              <h4>🔗 Chain Execution Detayları:</h4>
              <div className="chain-execution">
                <div className="chain-summary">
                  <span className="chain-steps">Toplam Adım: {log?.chainExecution?.totalSteps}</span>
                </div>
                
                {log?.chainExecution?.toolDetails && Array.isArray(log?.chainExecution?.toolDetails) && log?.chainExecution?.toolDetails.length > 0 && (
                  <div className="tool-execution-details">
                    <h5>🛠️ Tool Execution Details:</h5>
                    {log?.chainExecution?.toolDetails.map((tool, index) => (
                      <div key={index} className="tool-execution-step">
                        <div className="step-header">
                          <span className="step-number">Adım {tool.step}</span>
                          <span className="tool-name">{tool.tool}</span>
                        </div>
                        
                        <div className="step-details">
                          <div className="step-input">
                            <strong>Input:</strong> {formatValue(tool.input)}
                          </div>
                          
                          <div className="step-observation">
                            <strong>Observation:</strong>
                            <div className="observation-content">
                              {formatValue(tool.observation)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="log-section">
            <h4>Agent Yanıtı:</h4>
            <div 
              className="agent-response" 
              dangerouslySetInnerHTML={{ __html: log?.agentResponse || '' }}
            />
          </div>
        </div>
      );
    } else if (log?.error) {
      // Error log
      return (
        <div className="log-content">
          <div className="log-header">
            <span className="log-type error">Error</span>
            <span className="log-time">{formatTimestamp(log.timestamp)}</span>
          </div>

          {log?.context && (
            <div className="log-section">
              <h4>Bağlam:</h4>
              <p>{log?.context}</p>
            </div>
          )}

          {log?.error?.type && (
            <div className="log-section">
              <h4>Hata Türü:</h4>
              <span className="error-type">{log?.error?.type}</span>
            </div>
          )}

          {log?.error?.name && (
            <div className="log-section">
              <h4>Hata Adı:</h4>
              <span className="error-name">{log.error?.name}</span>
            </div>
          )}

          {log.error?.message && (
            <div className="log-section">
              <h4>Hata Mesajı:</h4>
              <p className="error-message">{log.error?.message}</p>
            </div>
          )}

          {log?.error?.code && (
            <div className="log-section">
              <h4>Hata Kodu:</h4>
              <span className="error-code">{log.error?.code}</span>
            </div>
          )}

          {log?.error?.cause && (
            <div className="log-section">
              <h4>Hata Nedeni:</h4>
              <div className="error-cause">{JSON.stringify(log.error?.cause)}</div>
            </div>
          )}

          {log.error?.additionalProperties && Object.keys(log.error?.additionalProperties).length > 0 && (
            <div className="log-section">
              <h4>Ek Özellikler:</h4>
              <div className="additional-properties">
                {Object.entries(log.error?.additionalProperties).map(([key, value]) => (
                  <div key={key} className="property-item">
                    <strong>{key}:</strong> {JSON.stringify(value)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {log.error?.stack && (
            <div className="log-section">
              <h4>Stack Trace:</h4>
              <pre className="stack-trace">{log.error?.stack}</pre>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="log-content text-black">
        <p>Bilinmeyen log formatı</p>
        <pre>{JSON.stringify(log, null, 2)}</pre>
      </div>
    );
  };

  useEffect(() => {
    try {
      fetchLogs();
    } catch (error) {
      console.error('Log yükleme hatası:', error);
      setError('Loglar yüklenirken bir hata oluştu');
    }
  }, [limit]);

  return (
    <div className="logs-page">
      <div className="logs-header">
        <h1>Chat Agent Logları</h1>
        <div className="header-controls">
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value as 'all' | 'chat' | 'error')}
            className="filter-select"
          >
            <option value="all">Tüm Loglar</option>
            <option value="chat">Chat Logları</option>
            <option value="error">Hata Logları</option>
          </select>
          
          <select 
            value={limit} 
            onChange={(e) => setLimit(Number(e.target.value))}
            className="limit-select"
          >
            <option value={25}>25 Log</option>
            <option value={50}>50 Log</option>
            <option value={100}>100 Log</option>
            <option value={200}>200 Log</option>
          </select>

          <button onClick={fetchLogs} className="refresh-btn">
            🔄 Yenile
          </button>
          
          <button onClick={clearLogs} className="clear-btn">
            🗑️ Temizle
          </button>
          
          <button onClick={exportJsonLogs} className="export-btn">
            📥 JSON Export
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError(null)} className="close-error">×</button>
        </div>
      )}

      <div className="logs-container">
        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
            <p>Loglar yükleniyor...</p>
          </div>
        ) : (
          <>
            <div className="logs-summary">
              <p>Toplam {getFilteredLogs().length} log gösteriliyor</p>
            </div>

            <div className="logs-list">
              {getFilteredLogs().map((log, index) => (
                <div 
                  key={index} 
                  className={`log-item ${selectedLog === log ? 'selected' : ''}`}
                  onClick={() => setSelectedLog(selectedLog === log ? null : log)}
                >
                  <div className="log-preview">
                    <div className="log-meta">
                      <span className="log-time-preview">
                        {formatTimestamp(log.timestamp)}
                      </span>
                       {log.userQuery && (
                         <span className="log-type-indicator chat">💬</span>
                       )}
                       {log.error && (
                         <span className="log-type-indicator error">❌</span>
                       )}
                       {(log.chainExecution || log.additionalInfo?.intermediateSteps) && (
                         <span className="log-type-indicator chain">🔗</span>
                       )}
                    </div>
                    
                    <div className="log-text-preview">
                      {log?.userQuery ? (
                        <span className="query-preview">{formatValue(log?.userQuery)}</span>
                      ) : log?.error ? (
                        <span className="error-preview">{formatValue(log?.error?.message || log?.error?.name)}</span>
                      ) : (
                        <span className="unknown-preview">Bilinmeyen log formatı</span>
                      )}
                    </div>
                  </div>

                  {selectedLog === log && (
                    <div className="log-details">
                      {renderLogContent(log)}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {getFilteredLogs().length === 0 && (
              <div className="no-logs">
                <p>Henüz log bulunmuyor</p>
                <button onClick={fetchLogs} className="retry-btn">Tekrar Dene</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default LogsPage;
