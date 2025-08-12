// WEB İÇERİK SORGULAMA TOOL - Web adresinden içerik çekip sorgular
// Bu tool verilen URL'den içerik çeker ve sorguları yanıtlar

let DynamicTool,
  PromptTemplate,
  createStuffDocumentsChain,
  createRetrievalChain;

// HTTP istekleri için
const https = require("https");
const http = require("http");
const { URL } = require("url");

// HTML parsing için (opsiyonel - eğer cheerio yüklüyse)
let cheerio;
try {
  cheerio = require("cheerio");
  console.log("✅ Cheerio HTML parser yüklendi");
} catch (e) {
  console.log("⚠️ Cheerio bulunamadı, ham metin kullanılacak");
}

// Import'ları güvenli şekilde yükle
try {
  // Yöntem 1: @langchain/core'dan dene
  try {
    ({ DynamicTool } = require("@langchain/core/tools"));
    console.log("✅ DynamicTool @langchain/core'dan yüklendi");
  } catch (e1) {
    try {
      // Yöntem 2: langchain ana paketinden dene
      ({ DynamicTool } = require("langchain/tools"));
      console.log("✅ DynamicTool langchain'den yüklendi");
    } catch (e2) {
      // Yöntem 3: Manuel implementation
      console.log(
        "⚠️ DynamicTool bulunamadı, manuel implementation kullanılıyor"
      );
      DynamicTool = class ManualDynamicTool {
        constructor({ name, description, func }) {
          this.name = name;
          this.description = description;
          this.func = func;
        }
        async call(input) {
          return await this.func(input);
        }
      };
    }
  }

  // PromptTemplate için aynı yöntem
  try {
    ({ PromptTemplate } = require("@langchain/core/prompts"));
    console.log("✅ PromptTemplate @langchain/core'dan yüklendi");
  } catch (e1) {
    try {
      ({ PromptTemplate } = require("langchain/prompts"));
      console.log("✅ PromptTemplate langchain'den yüklendi");
    } catch (e2) {
      console.log("⚠️ PromptTemplate bulunamadı");
      PromptTemplate = {
        fromTemplate: (template) => ({
          template,
          format: (vars) => {
            let result = template;
            Object.keys(vars).forEach((key) => {
              result = result.replace(new RegExp(`{${key}}`, "g"), vars[key]);
            });
            return result;
          },
        }),
      };
    }
  }

  // Chain fonksiyonları için
  try {
    ({
      createStuffDocumentsChain,
    } = require("langchain/chains/combine_documents"));
    ({ createRetrievalChain } = require("langchain/chains/retrieval"));
    console.log("✅ Chain fonksiyonları yüklendi");
  } catch (e) {
    console.log(
      "⚠️ Chain fonksiyonları bulunamadı, basit implementation kullanılacak"
    );
    createStuffDocumentsChain = null;
    createRetrievalChain = null;
  }
} catch (error) {
  console.error("❌ Import hatası:", error.message);
}

// Web içeriği çekme fonksiyonu
const fetchWebContent = (url) => {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === "https:" ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; WebContentBot/1.0)",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        timeout: 10000, // 10 saniye timeout
      };

      const req = protocol.request(options, (res) => {
        let data = "";

        // Yönlendirmeyi takip et
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          console.log(`🔄 Yönlendiriliyor: ${res.headers.location}`);
          fetchWebContent(res.headers.location).then(resolve).catch(reject);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }

        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          resolve(data);
        });
      });

      req.on("error", (err) => {
        reject(err);
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("İstek zaman aşımına uğradı"));
      });

      req.end();
    } catch (error) {
      reject(error);
    }
  });
};

// HTML'den metin çıkarma fonksiyonu
const extractTextFromHTML = (html) => {
  if (cheerio) {
    try {
      const $ = cheerio.load(html);

      // Gereksiz elementleri kaldır
      $(
        "script, style, nav, header, footer, aside, .advertisement, .ad"
      ).remove();

      // Ana içeriği al
      let content = "";
      const mainSelectors = [
        "main",
        "article",
        ".content",
        "#content",
        ".post",
        ".entry",
      ];

      for (const selector of mainSelectors) {
        const element = $(selector);
        if (element.length > 0 && element.text().trim().length > 200) {
          content = element.text().trim();
          break;
        }
      }

      // Eğer ana içerik bulunamazsa body'yi al
      if (!content) {
        content = $("body").text().trim();
      }

      // Çoklu boşlukları temizle
      return content.replace(/\s+/g, " ").substring(0, 10000); // İlk 10K karakter
    } catch (error) {
      console.log("⚠️ HTML parsing hatası, ham metin kullanılıyor");
      return html
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .substring(0, 10000);
    }
  } else {
    // Cheerio yoksa basit HTML tag temizliği
    return html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .substring(0, 10000);
  }
};

let getInformationFromWebTool;

const createDatabaseContentSearchTool = (chatModel) => {
  try {
    console.log("🔧 Web içerik sorgulama tool oluşturuluyor...");

    return (getInformationFromWebTool = new DynamicTool({
      name: "get_databases_from_web",
      description:
        "Kütüphanenin abone olduğu akademik veritabanlarıyla ilgili verilen akademik veritabanları web sitesine bağlanıp içeriği getirir ve sorulan soruya cevap verir." +
        "Input formatı: 'URL: https://example.com | SORU: Sormak istediğiniz soru'. " +
        "Örnek: 'URL: https://example.com/article | SORU: Bu makale neyi anlatıyor?'",

      func: async (input) => {
        console.log("🌐 WEB CONTENT SEARCH TOOL ÇAĞRILDI");
        console.log(`[TOOL ÇAĞRISI] Input: ${input}`);
        const url = "https://service.library.itu.edu.tr/web/Veritabanlari/llm";
        // Input'u parse et
        /*const parts = input.split("|");
        if (parts.length < 2) {
          return "❌ Hatalı format! Lütfen şu formatı kullanın: 'URL: https://example.com | SORU: Sorunuz'";
        }

        const urlPart = parts[0].trim();
        const questionPart = parts[1].trim();

        // URL'i çıkar
        const urlMatch = urlPart.match(/URL:\s*(https?:\/\/[^\s]+)/i);
        if (!urlMatch) {
          return "❌ Geçerli bir URL bulunamadı! URL kısmı 'URL: https://...' formatında olmalı.";
        }
        
        // Soruyu çıkar
        const questionMatch = questionPart.match(/SORU:\s*(.+)/i);
        if (!questionMatch) {
          return "❌ Soru bulunamadı! Soru kısmı 'SORU: ...' formatında olmalı.";
        }

        const url = urlMatch[1];
        const question = questionMatch[1];

        console.log(`🔍 URL: ${url}`);
        console.log(`❓ Soru: ${question}`);
*/
        const question = input;
        try {
          // Web içeriğini çek
          console.log("📥 Web içeriği çekiliyor...");
          const htmlContent = await fetchWebContent(url);

          // HTML'den metin çıkar
          const textContent = extractTextFromHTML(htmlContent);

          if (!textContent || textContent.trim().length < 50) {
            return `❌ Web sayfasından yeterli içerik çekilemedi. URL: ${url}`;
          }

          console.log(`📄 ${textContent.length} karakter içerik çekildi`);

          // Eğer tam chain fonksiyonları varsa, onları kullan
          if (
            createStuffDocumentsChain &&
            PromptTemplate.fromTemplate &&
            chatModel.invoke
          ) {
            console.log("🔗 LLM ile içerik analizi yapılıyor...");

            const prompt = `Sen yardımcı bir web içerik analizcisisin. Verilen web sayfası içeriğini analiz ederek soruları yanıtlayacaksın.

WEB SİTESİ: ${url}

İÇERİK:
${textContent}

SORU: ${question}

Lütfen soruyu web sayfasındaki bilgilere dayanarak yanıtla. Eğer cevap içerikte yoksa, bunu belirt.

YANIT:`;

            try {
              const response = await chatModel.invoke(prompt);
              const answer = response.content || response.text || response;

              return `📊 **Web İçerik Analizi**\n\n🌐 **Kaynak:** ${url}\n\n❓ **Soru:** ${question}\n\n💡 **Yanıt:** ${answer}`;
            } catch (llmError) {
              console.error("❌ LLM hatası:", llmError.message);
              // LLM hatası durumunda ham içeriği döndür
            }
          }

          // Basit yanıt - LLM yoksa veya hata varsa
          const preview = textContent.substring(0, 1000);
          return `📄 **Web İçeriği Çekildi**\n\n🌐 **Kaynak:** ${url}\n\n❓ **Sorunuz:** ${question}\n\n📝 **İçerik Özeti:**\n${preview}${
            textContent.length > 1000 ? "..." : ""
          }\n\n💡 Yukarıdaki içerikte sorunuzun yanıtını arayabilirsiniz.`;
        } catch (fetchError) {
          console.error("❌ Web içerik çekme hatası:", fetchError.message);

          if (fetchError.message.includes("timeout")) {
            return `⏰ Web sayfası yüklenemedi (zaman aşımı): ${url}`;
          } else if (fetchError.message.includes("ENOTFOUND")) {
            return `🌐 Web sitesine ulaşılamadı: ${url}`;
          } else {
            return `❌ Web içeriği çekilirken hata oluştu: ${fetchError.message}\nURL: ${url}`;
          }
        }
      },
    }));
  } catch (error) {
    console.error("❌ Web içerik arama aracı oluşturma hatası:", error.message);
    getInformationFromWebTool = null;
    return null;
  }
};

// Test fonksiyonu
const testWebTool = async (chatModel) => {
  console.log("🧪 Web Tool test ediliyor...");

  const tool = createDatabaseContentSearchTool(chatModel);
  if (!tool) {
    console.log("❌ Tool oluşturulamadı");
    return false;
  }

  try {
    const testInput = "URL: https://example.com | SORU: Bu site ne hakkında?";
    const result = await tool.func(testInput);
    console.log("✅ Web Tool çalışıyor!");
    console.log("📄 Test sonucu:", result.substring(0, 200) + "...");
    return true;
  } catch (error) {
    console.log("❌ Web Tool test hatası:", error.message);
    return false;
  }
};

// Debug bilgileri
const debugInfo = () => {
  console.log("🔍 WEB TOOL DEBUG BİLGİLERİ:");
  console.log("- DynamicTool:", !!DynamicTool ? "✅" : "❌");
  console.log("- PromptTemplate:", !!PromptTemplate ? "✅" : "❌");
  console.log("- Cheerio HTML Parser:", !!cheerio ? "✅" : "❌");
  console.log("- HTTPS/HTTP Modules:", "✅");

  // Node.js versiyonu
  console.log("- Node.js version:", process.version);

  // LangChain versiyonu
  try {
    const langchainPkg = require("langchain/package.json");
    console.log("- LangChain version:", langchainPkg.version);
  } catch (e) {
    console.log("- LangChain version: Tespit edilemedi");
  }
};

// Kullanım örneği
const usageExample = () => {
  console.log(`
🚀 WEB İÇERİK SORGULAMA TOOL KULLANIM ÖRNEĞİ:

const tool = createWebContentSearchTool(chatModel);

// Kullanım:
await tool.func("URL: https://example.com/article | SORU: Bu makale neyi anlatıyor?");
await tool.func("URL: https://news.site.com/post | SORU: Haberin ana konusu nedir?");
await tool.func("URL: https://docs.site.com | SORU: API nasıl kullanılır?");

📝 Format: "URL: [web_adresi] | SORU: [sorunuz]"
  `);
};

module.exports = {
  createDatabaseContentSearchTool,
  testWebTool,
  debugInfo,
  usageExample,
  fetchWebContent,
  extractTextFromHTML,
};

// Eğer direkt çalıştırılıyorsa debug bilgilerini ve örneği göster
if (require.main === module) {
  debugInfo();
  usageExample();
}
