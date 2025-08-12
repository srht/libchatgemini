const fs = require('fs');
const path = require('path');

function convertTxtLogsToJson() {
  const logDir = path.join(__dirname, 'logs');
  const txtLogFile = path.join(logDir, 'chat_logs.txt');
  const jsonLogFile = path.join(logDir, 'chat_logs.json');
  
  if (!fs.existsSync(txtLogFile)) {
    console.log('TXT log dosyası bulunamadı');
    return;
  }
  
  try {
    const content = fs.readFileSync(txtLogFile, 'utf8');
    const chatLogEntries = content.split('=== CHAT LOG ENTRY ===').filter(entry => entry.trim());
    const errorLogEntries = content.split('=== ERROR LOG ===').filter(entry => entry.trim());
    
    const allEntries = [];
    
    // Parse chat logs
    chatLogEntries.forEach(entry => {
      const lines = entry.split('\n').filter(line => line.trim());
      const logObj = { type: 'chat' };
      let currentSection = null;
      let sectionData = {};
      
      lines.forEach(line => {
        if (line.includes(':')) {
          const colonIndex = line.indexOf(':');
          const key = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 1).trim();
          
          if (key && value) {
            // Special handling for nested sections
            if (key === 'Chain Execution' || key === 'Tool Execution Details' || key === 'Additional Info') {
              currentSection = key;
              if (key === 'Additional Info') {
                sectionData[key] = {};
              } else {
                sectionData[key] = {};
              }
              return;
            }
            
            if (currentSection === 'Tool Execution Details' && line.startsWith('      ')) {
              // Tool detail line
              const detailKey = line.substring(6).split(':')[0].trim();
              const detailValue = line.substring(6).split(':')[1]?.trim() || '';
              if (detailKey && detailValue) {
                if (!sectionData['Tool Execution Details'].tools) {
                  sectionData['Tool Execution Details'].tools = [];
                }
                const lastTool = sectionData['Tool Execution Details'].tools[sectionData['Tool Execution Details'].tools.length - 1];
                if (lastTool) {
                  lastTool[detailKey] = detailValue;
                }
              }
              return;
            }
            
            if (line.startsWith('    Step ') && currentSection === 'Tool Execution Details') {
              // New tool step
              if (!sectionData['Tool Execution Details'].tools) {
                sectionData['Tool Execution Details'].tools = [];
              }
              sectionData['Tool Execution Details'].tools.push({});
              return;
            }
            
            if (currentSection && line.startsWith('  ')) {
              // Section data
              const sectionKey = line.substring(2).split(':')[0].trim();
              const sectionValue = line.substring(2).split(':')[1]?.trim() || '';
              if (sectionKey && sectionValue) {
                if (currentSection === 'Additional Info') {
                  // Parse Additional Info values
                  try {
                    // Try to parse as JSON first
                    const parsedValue = JSON.parse(sectionValue);
                    sectionData[currentSection][sectionKey] = parsedValue;
                  } catch (e) {
                    // If not JSON, store as string
                    sectionData[currentSection][sectionKey] = sectionValue;
                  }
                } else {
                  sectionData[currentSection][sectionKey] = sectionValue;
                }
              }
              return;
            }
            
            // Regular key-value pair
            logObj[key] = value;
          }
        }
      });
      
      // Add section data to log object
      if (Object.keys(sectionData).length > 0) {
        Object.assign(logObj, sectionData);
      }
      
      // Extract intermediateSteps and toolDetails from Additional Info if they exist
      if (sectionData['Additional Info'] && sectionData['Additional Info'].intermediateSteps) {
        logObj['intermediateSteps'] = sectionData['Additional Info'].intermediateSteps;
      }
      
      if (sectionData['Additional Info'] && sectionData['Additional Info'].toolDetails) {
        logObj['toolDetails'] = sectionData['Additional Info'].toolDetails;
      }
      
      // Create structured JSON entry with new format
      const jsonEntry = {
        type: 'chat',
        timestamp: logObj['Timestamp'],
        userQuery: logObj['User Query'],
        toolsUsed: logObj['Tools Used'] ? logObj['Tools Used'].split(',').map(t => t.trim()) : [],
        executionTime: logObj['Execution Time'],
        agentResponse: logObj['Agent Response'],
        chainExecution: logObj['intermediateSteps'] ? {
          totalSteps: parseInt(logObj['intermediateSteps']) || 0,
          toolDetails: logObj['toolDetails'] || [],
          model: logObj['model'],
          timestamp: logObj['timestamp'],
          log: logObj['log'] || null
        } : null,
        additionalInfo: {
          intermediateSteps: logObj['intermediateSteps'],
          toolDetails: logObj['toolDetails'],
          model: logObj['model'],
          timestamp: logObj['timestamp'],
          log: logObj['log'] || null
        }
      };
      
      allEntries.push(jsonEntry);
    });
    
    // Parse error logs
    errorLogEntries.forEach(entry => {
      const lines = entry.split('\n').filter(line => line.trim());
      const logObj = { type: 'error' };
      let currentSection = null;
      let sectionData = {};
      
      lines.forEach(line => {
        if (line.includes(':')) {
          const colonIndex = line.indexOf(':');
          const key = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 1).trim();
          
          if (key && value) {
            // Special handling for sections
            if (key === 'Stack Trace' || key === 'Additional Properties') {
              currentSection = key;
              sectionData[key] = '';
              return;
            }
            
            if (currentSection === 'Stack Trace' && line.startsWith('  ')) {
              // Stack trace continuation
              sectionData['Stack Trace'] += '\n' + line.substring(2);
              return;
            }
            
            if (currentSection === 'Additional Properties' && line.startsWith('  ')) {
              // Additional properties
              const propKey = line.substring(2).split(':')[0].trim();
              const propValue = line.substring(2).split(':')[1]?.trim() || '';
              if (propKey && propValue) {
                if (!sectionData['Additional Properties']) {
                  sectionData['Additional Properties'] = {};
                }
                sectionData['Additional Properties'][propKey] = propValue;
              }
              return;
            }
            
            // Regular key-value pair
            logObj[key] = value;
          }
        }
      });
      
      // Add section data to log object
      if (Object.keys(sectionData).length > 0) {
        Object.assign(logObj, sectionData);
      }
      
      // Create structured JSON entry with new format
      const jsonEntry = {
        type: 'error',
        timestamp: logObj['Timestamp'],
        context: logObj['Context'],
        error: {
          type: logObj['Error Type'] || 'Unknown',
          name: logObj['Error Name'] || 'Unknown',
          message: logObj['Error Message'] || 'Unknown error',
          code: logObj['Error Code'],
          cause: logObj['Error Cause'],
          stack: logObj['Stack Trace'],
          additionalProperties: logObj['Additional Properties'] || {}
        }
      };
      
      allEntries.push(jsonEntry);
    });
    
    // Sort by timestamp
    allEntries.sort((a, b) => {
      const timeA = a.timestamp || '';
      const timeB = b.timestamp || '';
      return timeB.localeCompare(timeA); // Most recent first
    });
    
    // Write JSON file
    fs.writeFileSync(jsonLogFile, JSON.stringify(allEntries, null, 2));
    console.log(`✅ ${allEntries.length} log entry'si yeni JSON formatında kaydedildi: ${jsonLogFile}`);
    
  } catch (error) {
    console.error('Log dönüştürme hatası:', error);
  }
}

// Run conversion
convertTxtLogsToJson();
