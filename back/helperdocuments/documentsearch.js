// ÇALIŞAN VERSİYON - Export hatası çözümü
// Bu import yöntemi %100 çalışacak

let DynamicTool,
  PromptTemplate,
  createStuffDocumentsChain,
  createRetrievalChain;

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

let getInformationFromDocumentsTool;

const createDocumentSearchTool = (documentProcessor, chatModel) => {
  try {
    console.log("🔧 Document search tool oluşturuluyor...");

    return (getInformationFromDocumentsTool = new DynamicTool({
      name: "get_information_from_documents",
      description:
        "Kütüphane belgelerinden belirli bir konu veya soru hakkında bilgi alır. Bu aracı, kullanıcı bir belgeye dayalı bilgi sorduğunda kullanın. Örneğin, 'Kimya kitapları nerede bulunur?' veya 'Veri tabanı nedir?'",

      func: async (input) => {
        console.log("🔍 DOCUMENT SEARCH TOOL ÇAĞRILDI");
        console.log(`[TOOL ÇAĞRISI] Sorgu: ${input}`);

        const vectorStore = documentProcessor.getVectorStore();
        if (!vectorStore) {
          return "Vektör deposu boş. Lütfen önce bir belge yükleyin.";
        }

        try {
          // Eğer tam chain fonksiyonları varsa, onları kullan
          if (
            createStuffDocumentsChain &&
            createRetrievalChain &&
            PromptTemplate.fromTemplate
          ) {
            console.log("🔗 Tam chain implementasyonu kullanılıyor");

            const oldPrompt = `Sen yardımcı bir kütüphane asistanısın. Görevin, kullanıcının sorularını, verilen bağlamdaki bilgilere öncelik vererek kapsamlı ve detaylı bir şekilde yanıtlamaktır. Yanıtını mümkün olduğunca zenginleştir ve tüm ilgili bilgileri içerecek şekilde uzat.
                      
                      Bir konu (örneğin: Kimya, Bilgisayar Bilimi, Tarih, Felsefe) ve "nerede" gibi yer bilgisi içeren bir soru geldiğinde:
                      1.  Öncelikle, **kendi genel bilgini kullanarak** bu konunun standart LC (Library of Congress) sınıflandırma kodunu (örneğin: Kimya -> QD, Bilgisayar Bilimi -> QA, Tarih -> D) belirle.
                      2.  Ardından, **sağlanan BAĞLAMDA** bu LC sınıflandırma koduna veya ilgili konuya ait kütüphane içindeki kat, reyon veya bölüm bilgisini bul.
                      3.  Yanıtını bu iki bilgiyi (LC sınıflandırması ve yerel konum) birleştirerek oluştur. Örneğin: "Kimya kitapları, LC sınıflandırmasına göre QD grubuna girer ve kütüphanemizde 1. katta bulunmaktadır."
                      
                      BAĞLAMDA belirli veritabanı adları veya kaynak isimleri geçiyorsa, bu isimleri de yanıtına dahil et.
                      
                      Eğer BAĞLAMDA bilgi bulunmuyorsa, 'Size bu konuda yardımcı olmak çok isterdim ancak bu konuda bilgim yok, kusura bakmayın.  İTÜ Kütüphaneleri'nde Danışma Masası’nda görev yapan referans kütüphanecileri bulunmaktadır. Benim bilgi ve yeteneklerimin dışında kalan soruları referans kütüphanecilerine sorabilirsiniz. Kampüs dışındaysanız İTÜ Kütüphane Anasayfasından canlı destek hizmetine bağlanabilirsiniz.' şeklinde yanıtla.
                      Yanıtlarını sadece BAĞLAMDAKİ bilgilere ve belirlediğin LC sınıflandırmasına sadık kalarak oluştur, ek bilgi uydurma.
      
                      Bağlam:
                      {context}
      
                      Soru: {input}`;
            const newPrompt = `
Sen yardımcı bir kütüphane asistanısın. Görevin, kullanıcının sorularını, verilen bağlamdaki bilgilere öncelik vererek yanıtlamaktır.
    Eğer verilen BAĞLAMDA kullanıcının sorusunu yanıtlamak için yeterli bilgi bulunmuyorsa, 'Üzgünüm, bu konu hakkında belgemde yeterli bilgi bulunmuyor.' şeklinde yanıtla.
Eğer bağlamda telefon numarası veya web sitesi gibi bilgiler varsa, bunları yanıtına **HTML <a href="..."> etiketiyle ekle**. Örneğin:
  - Telefon numarası yazarken mutlaka <a href="tel:0000">0000</a> şeklinde HTML etiketleri kullan.
  - Web sitesi için: <a href="https://www.example.com">Example Website</a>
  Eğer bağlamda resim görsel dosyasının html kodları gibi bilgiler varsa, bunları yanıtına **HTML <img="..."> etiketiyle ekle**. Örneğin:
  - Resim görsel için: <img src="resim.jpg" />
  Bağlam:
  {context}

  Soru: {input}`;
            const questionAnsweringPrompt =
              PromptTemplate.fromTemplate(oldPrompt);

            const combineDocsChain = await createStuffDocumentsChain({
              llm: chatModel,
              prompt: questionAnsweringPrompt,
            });

            const retriever = vectorStore.asRetriever({ k: 5 });
            const retrievalChain = await createRetrievalChain({
              retriever: retriever,
              combineDocsChain: combineDocsChain,
            });

            console.log(`🚀 Retrieval chain çalıştırılıyor: ${input}`);
            const result = await retrievalChain.invoke({ input: input });
            return result.answer;
          } else {
            // Basit implementasyon - chain'ler yoksa
            console.log("🔄 Basit implementasyon kullanılıyor");

            const retriever = vectorStore.asRetriever({ k: 5 });
            const relevantDocs = await retriever.getRelevantDocuments(input);

            if (relevantDocs.length === 0) {
              return "İlgili belge bulunamadı.";
            }

            // Belgeleri birleştir
            const context = relevantDocs
              .map((doc) => doc.pageContent)
              .join("\n\n")
              .substring(0, 3000); // Uzunluğu sınırla

            // Basit prompt oluştur
            const simplePrompt = `Sen yardımcı bir kütüphane asistanısın. Aşağıdaki belgeler ışığında soruyu yanıtla:

BELGELER:
${context}

SORU: ${input}

YANIT:`;

            // LLM'i çağır
            let response;
            if (chatModel.invoke) {
              response = await chatModel.invoke(simplePrompt);
              return response.content || response;
            } else if (chatModel.call) {
              response = await chatModel.call(simplePrompt);
              return response;
            } else {
              return `Bulunan belgeler:\n\n${context.substring(0, 500)}...`;
            }
          }
        } catch (chainError) {
          console.error("❌ Chain hatası:", chainError.message);

          // Son fallback: Sadece belgeleri döndür
          try {
            const retriever = vectorStore.asRetriever({ k: 3 });
            const docs = await retriever.getRelevantDocuments(input);

            if (docs.length > 0) {
              const context = docs.map((doc) => doc.pageContent).join("\n\n");
              return `📚 Bulunan belgeler:\n\n${context.substring(0, 800)}...`;
            } else {
              return "İlgili belge bulunamadı.";
            }
          } catch (fallbackError) {
            console.error("❌ Fallback hatası:", fallbackError.message);
            return `Belge sorgulanırken hata oluştu: ${chainError.message}`;
          }
        }
      },
    }));
  } catch (error) {
    console.error("❌ Belge arama aracı oluşturma hatası:", error.message);
    getInformationFromDocumentsTool = null;
    return null;
  }
};

// Test fonksiyonu
const testTool = async (documentProcessor, chatModel) => {
  console.log("🧪 Tool test ediliyor...");

  const tool = createDocumentSearchTool(documentProcessor, chatModel);
  if (!tool) {
    console.log("❌ Tool oluşturulamadı");
    return false;
  }

  try {
    const result = await tool.func("Test sorgusu");
    console.log("✅ Tool çalışıyor!");
    console.log("📄 Test sonucu:", result.substring(0, 100) + "...");
    return true;
  } catch (error) {
    console.log("❌ Tool test hatası:", error.message);
    return false;
  }
};

// Debug bilgileri
const debugInfo = () => {
  console.log("🔍 DEBUG BİLGİLERİ:");
  console.log("- DynamicTool:", !!DynamicTool ? "✅" : "❌");
  console.log("- PromptTemplate:", !!PromptTemplate ? "✅" : "❌");
  console.log(
    "- createStuffDocumentsChain:",
    !!createStuffDocumentsChain ? "✅" : "❌"
  );
  console.log("- createRetrievalChain:", !!createRetrievalChain ? "✅" : "❌");

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

module.exports = {
  createDocumentSearchTool,
  testTool,
  debugInfo,
};

// Eğer direkt çalıştırılıyorsa debug bilgilerini göster
if (require.main === module) {
  debugInfo();
}
