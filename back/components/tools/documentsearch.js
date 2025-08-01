const { DynamicTool } = require("langchain/tools");
let getInformationFromDocumentsTool;
try {
    getInformationFromDocumentsTool = new DynamicTool({
        name: "get_information_from_documents",
        description:
          "Kütüphane belgelerinden belirli bir konu veya soru hakkında bilgi alır. Bu aracı, kullanıcı bir belgeye dayalı bilgi sorduğunda kullanın. Örneğin, 'Kimya kitapları nerede bulunur?' veya 'Veri tabanı nedir?'",
        func: async (input) => {
          console.log(
            `[TOOL ÇAĞRISI] getInformationFromDocumentsTool çağrıldı, sorgu: ${input.query}`
          );
          const vectorStore = documentProcessor.getVectorStore();
          if (!vectorStore) {
            return "Vektör deposu boş. Lütfen önce bir belge yükleyin.";
          }
      
          try {
            const questionAnsweringPrompt = PromptTemplate.fromTemplate(
              `Sen yardımcı bir kütüphane asistanısın. Görevin, kullanıcının sorularını, verilen bağlamdaki bilgilere öncelik vererek kapsamlı ve detaylı bir şekilde yanıtlamaktır. Yanıtını mümkün olduğunca zenginleştir ve tüm ilgili bilgileri içerecek şekilde uzat.
                      
                      Bir konu (örneğin: Kimya, Bilgisayar Bilimi, Tarih, Felsefe) ve "nerede" gibi yer bilgisi içeren bir soru geldiğinde:
                      1.  Öncelikle, **kendi genel bilgini kullanarak** bu konunun standart LC (Library of Congress) sınıflandırma kodunu (örneğin: Kimya -> QD, Bilgisayar Bilimi -> QA, Tarih -> D) belirle.
                      2.  Ardından, **sağlanan BAĞLAMDA** bu LC sınıflandırma koduna veya ilgili konuya ait kütüphane içindeki kat, reyon veya bölüm bilgisini bul.
                      3.  Yanıtını bu iki bilgiyi (LC sınıflandırması ve yerel konum) birleştirerek oluştur. Örneğin: "Kimya kitapları, LC sınıflandırmasına göre QD grubuna girer ve kütüphanemizde 1. katta bulunmaktadır."
                      
                      BAĞLAMDA belirli veritabanı adları veya kaynak isimleri geçiyorsa, bu isimleri de yanıtına dahil et.
                      
                      Eğer BAĞLAMDA bilgi bulunmuyorsa, 'Üzgünüm, bu konu hakkında belgemde yeterli bilgi bulunmuyor.' şeklinde yanıtla.
                      Yanıtlarını sadece BAĞLAMDAKİ bilgilere ve belirlediğin LC sınıflandırmasına sadık kalarak oluştur, ek bilgi uydurma.
      
                      Bağlam:
                      {context}
      
                      Soru: {input}`
            );
      
            const combineDocsChain = await createStuffDocumentsChain({
              llm: chatModel,
              prompt: questionAnsweringPrompt,
            });
      
            const retriever = vectorStore.asRetriever({ k: 5 });
      
            const retrievalChain = await createRetrievalChain({
              retriever: retriever,
              combineDocsChain: combineDocsChain,
            });
      
            const result = await retrievalChain.invoke({ input: input.query });
            return result.answer;
          } catch (chainError) {
            console.error("Belge sorgu zinciri hatası:", chainError.message);
            return `Belge sorgulanırken bir hata oluştu: ${chainError.message}`;
          }
        },
      });
    } catch (error) {
        console.error("Belge arama aracı hatası:", error.message);
        getInformationFromDocumentsTool = null;
    }


module.exports = { getInformationFromDocumentsTool };