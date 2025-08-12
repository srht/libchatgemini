// server.ts
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const DocumentProcessor = require("../../components/docprocessor"); // DocumentProcessor sınıfını içe aktar

const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { MemoryVectorStore } = require("langchain/vectorstores/memory");
const { Document } = require("@langchain/core/documents");
const { StructuredTool } = require("@langchain/core/tools");
const { AgentExecutor, createReactAgent } = require("langchain/agents");
const {
  createStuffDocumentsChain,
} = require("langchain/chains/combine_documents");
const { createRetrievalChain } = require("langchain/chains/retrieval");
const {
  ChatPromptTemplate,
  PromptTemplate,
} = require("@langchain/core/prompts");

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware'ler ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Custom Logger Middleware
app.use((req, res, next) => {
  console.log(`\n--- Gelen İstek Logu ---`);
  console.log(`Zaman: ${new Date().toISOString()}`);
  console.log(`Metot: ${req.method}`);
  console.log(`URL: ${req.originalUrl}`);
  console.log(`Başlıklar (Headers):`);
  console.log(JSON.stringify(req.headers, null, 2));
  if (req.method === "POST" || req.method === "PUT") {
    console.log(`İstek Gövdesi (Body):`);
    console.log(JSON.stringify(req.body, null, 2));
  }
  console.log(`--- İstek Sonu ---\n`);
  next();
});

// Multer yapılandırması
const upload = multer({ dest: "uploads/" });

// --- LangChain Bileşenleri ---
const documentProcessor = new DocumentProcessor(
  process.env.GEMINI_API_KEY || ""
);

const chatModel = new ChatGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  model: "gemini-1.5-flash", // Modeli güncelledim, 1.5-flash daha yetenekli
  temperature: 0.7,
  maxOutputTokens: 1024,
});

// --- ARAÇ TANIMLAMALARI ---

const getBookFromLibrary = new StructuredTool({
  name: "get_book_from_library",
  description:
    "Kullanıcının kütüphanede aradığı bir kitabı bulur. Kitap adı veya yazar adı gibi bilgilerle arama yapar.",
  schema: {
    type: "object",
    properties: {
      book: {
        type: "string",
        description:
          "Kullanıcının aradığı kitabın adı veya yazar adı. Örneğin: 'Kimya Kitabı' veya 'Ahmet Ümit'.",
      },
    },
    required: ["book"],
  },
  func: async (input) => {
    console.log(
      `[TOOL ÇAĞRISI] get_book_from_library çağrıldı, kitap: ${input.book}`
    );
    try {
      const response = await axios.get(
        `https://service.library.itu.edu.tr/web/api/llm/search?keyword=${input.book}`
      );
      return JSON.stringify(response.data);
    } catch (error) {
      if (error.response) {
        return `Hata: API ${
          error.response.status
        } koduyla yanıt verdi - ${JSON.stringify(error.response.data)}`;
      } else if (error.request) {
        return `Hata: İlgili istek yapıldı, ancak sunucudan yanıt alınamadı. ${error.message}`;
      } else {
        return `Hata: Beklenmedik bir hata oluştu: ${error.message}`;
      }
    }
  },
});

const getInformationFromDocumentsTool = new StructuredTool({
  name: "get_information_from_documents",
  description:
    "Kütüphane belgelerinden belirli bir konu veya soru hakkında bilgi alır. Bu aracı, kullanıcı bir belgeye dayalı bilgi sorduğunda kullanın. Örneğin, 'Kimya kitapları nerede bulunur?' veya 'Veri tabanı nedir?'",
  schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Belgelerde aranacak spesifik soru veya konu.",
      },
    },
    required: ["query"],
  },
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

// Tüm araçları bir diziye koyun
const tools = [getBookFromLibrary, getInformationFromDocumentsTool];

// --- API Uç Noktaları ---
app.post("/ask-chatbot", async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ message: "Sorgu metni boş olamaz." });
  }

  // Agent Prompt'unu daha dinamik hale getirelim.
  // Langchain'in {tools} ve {agent_scratchpad} gibi standart değişkenlerini kullanalım.
  const agentPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `Sen kullanıcının sorularını yanıtlayan çok yetenekli bir yapay zeka asistanısın.
Kullanıcının sorularını uygun olduğunda yanıtlamak için elindeki araçları kullanmalısın.

Kullanabileceğin araçlar şunlardır:
{tools}

Yanıtların için HER ZAMAN aşağıdaki formatı izlemelisin:

Thought: Ne yapman gerektiğini her zaman düşünmelisin.
Action: Kullanılacak aracın adı (araçlardan biri olmalı {tool_names})
Action Input: Araca verilecek girdi (JSON formatında)
Observation: Aracın çalıştırılmasından sonra dönen sonuç (bu sistem tarafından sağlanacaktır)

Eğer nihai bir cevabın varsa ve daha fazla araç kullanmana gerek yoksa:
Thought: Nihai bir cevap vermek için yeterli bilgiye sahibim.
Final Answer: Kullanıcıya vereceğin nihai cevap.`,
    ],
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"], // Agent'ın düşünce süreci için placeholder
  ]);

  try {
    // 1. DÜZELTME: Agent'ı oluştururken araçları (`tools`) veriyoruz.
    // Bu, agent'ın prompt'u doğru bir şekilde formatlamasını sağlar.
    const agent = await createReactAgent({
      llm: chatModel,
      tools, // EKLENDİ
      prompt: agentPrompt,
    });

    // 2. DÜZELTME: AgentExecutor'ı oluştururken de araçları (`tools`) veriyoruz.
    // Bu, executor'ın agent tarafından seçilen aracı nasıl çalıştıracağını bilmesini sağlar.
    const agentExecutor = new AgentExecutor({
      agent,
      tools, // EKLENDİ
      verbose: true,
    });

    console.log(`[AGENT ÇAĞRISI] Gelen Sorgu: ${query}`);
    const result = await agentExecutor.invoke({ input: query });

    console.log(`[AGENT YANITI] ${result.output}`);
    res.status(200).json({ response: result.output });
  } catch (error) {
    console.error("Agent sorgusu işlenirken hata oluştu:", error);
    res.status(500).json({
      message: "Sorgunuz işlenirken bir sunucu hatası oluştu.",
      error: error.message,
    });
  }
});

// --- Sunucuyu Başlat ve Otomatik Dosya Yükle ---
app.listen(PORT, async () => {
  console.log(`Backend sunucusu http://localhost:${PORT} adresinde çalışıyor.`);

  const uploadsDir = path.join(__dirname, "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
  }

  const filesToLoad = fs
    .readdirSync(uploadsDir)
    .filter(
      (file) =>
        file.endsWith(".txt") || file.endsWith(".pdf") || file.endsWith(".docx")
    );

  if (filesToLoad.length === 0) {
    console.log(
      `'${uploadsDir}' klasöründe yüklenecek .txt, .pdf veya .docx belge bulunamadı. Lütfen klasöre dosya ekleyin.`
    );
  } else {
    console.log(`'${uploadsDir}' klasöründeki varsayılan belgeler yükleniyor:`);
    for (const fileName of filesToLoad) {
      const filePath = path.join(uploadsDir, fileName);
      console.log(`- Yükleniyor: ${fileName}`);
      try {
        await documentProcessor.processDocument(filePath, fileName);
        console.log(`  -> ${fileName} başarıyla indekslendi.`);
      } catch (error) {
        console.error(
          `  -> ${fileName} yüklenirken hata oluştu:`,
          error.message
        );
      }
    }
    console.log("Tüm varsayılan belgeler indekslendi.");
  }
});
