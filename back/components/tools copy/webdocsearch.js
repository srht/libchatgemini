const { DynamicTool } = require("langchain/tools");
const DocumentProcessor = require("../docprocessor");
const {
  createStuffDocumentsChain,
} = require("langchain/chains/combine_documents");
const { createRetrievalChain } = require("langchain/chains/retrieval");

const { PromptTemplate } = require("@langchain/core/prompts");
const axios = require("axios");
const cheerio = require("cheerio");
const documentProcessor = new DocumentProcessor(process.env.GEMINI_API_KEY);
const createLibraryWebPageSearchTool = (chatModel) => {
  return new DynamicTool({
    name: "library_Web_Page_Search_Tool",
    description:
      "Searches the web for information related to the user's query.",
    func: async (input) => {
      console.log(`[TOOL CALL] webdocsearch called with query: ${input.query}`);
      const url = `https://kutuphane.itu.edu.tr/hakkimizda/personel-ve-bolumler`;
      console.log(`[FETCH REQUEST] Fetching URL: ${url}`);
      await documentProcessor.processWebPage(url);
      try {
        const newPrompt = `
Sen yardımcı bir asistan olarak kullanıcının kütüphane personelinin iletişim bilgilerini bulmasına yardımcı olacaksın. Sorulan sorulara göre kütüphane personelinin iletişim bilgilerini (dış hat ve dahili telefon numarası, e-posta adresi, web sitesi) bulup yanıtlayacaksın.
    Eğer verilen BAĞLAMDA kullanıcının sorusunu yanıtlamak için yeterli bilgi bulunmuyorsa, 'Üzgünüm, bu konu hakkında belgemde yeterli bilgi bulunmuyor.' şeklinde yanıtla.
Eğer bağlamda telefon numarası veya web sitesi gibi bilgiler varsa, bunları yanıtına **HTML <a href="..."> etiketiyle ekle**. Örneğin:
  - Telefon numarası yazarken mutlaka <a href="tel:0000">0000</a> şeklinde HTML etiketleri kullan.
  - Web sitesi için: <a href="https://www.example.com">Example Website</a>
  Eğer bağlamda resim görsel dosyasının html kodları gibi bilgiler varsa, bunları yanıtına **HTML <img="..."> etiketiyle ekle**. Örneğin:
  - Resim görsel için: <img src="resim.jpg" />
  Bağlam:
  {context}

  Soru: {input}`;
        const questionAnsweringPrompt = PromptTemplate.fromTemplate(newPrompt);

        const combineDocsChain = await createStuffDocumentsChain({
          llm: chatModel,
          prompt: questionAnsweringPrompt,
        });

        const retriever = documentProcessor
          .getVectorStore()
          .asRetriever({ k: 5 });
        const retrievalChain = await createRetrievalChain({
          retriever: retriever,
          combineDocsChain: combineDocsChain,
        });

        console.log(`🚀 Retrieval chain çalıştırılıyor: ${input}`);
        const result = await retrievalChain.invoke({ input: input });
        return result.answer;
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
  });
};

module.exports = { createLibraryWebPageSearchTool };
