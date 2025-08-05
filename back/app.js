require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const DocumentProcessor = require("./components/docprocessor"); // DocumentProcessor sınıfını içe aktar
// LangChain İçe Aktarımları
const { OpenAIEmbeddings, ChatOpenAI } = require("@langchain/openai");
const {
  GoogleGenerativeAIEmbeddings,
  ChatGoogleGenerativeAI,
} = require("@langchain/google-genai");
const { AgentExecutor, createReactAgent } = require("langchain/agents");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { MemoryVectorStore } = require("langchain/vectorstores/memory");
const { Document } = require("@langchain/core/documents");
const {
  createStuffDocumentsChain,
} = require("langchain/chains/combine_documents");
const { createRetrievalChain } = require("langchain/chains/retrieval");
const {
  PromptTemplate,
  ChatPromptTemplate,
} = require("@langchain/core/prompts");

// Dosya yükleyici yardımcıları
const pdf = require("pdf-parse");
const mammoth = require("mammoth"); // DOCX için

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware'ler ---
app.use(cors());
app.use(express.json());

// Multer yapılandırması
const upload = multer({ dest: "uploads/" });
const documentProcessor = new DocumentProcessor(process.env.GEMINI_API_KEY);
// --- LangChain Bileşenleri ---
/*
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "text-embedding-ada-002", // Varsayılan model, isteğe bağlı
});
*/

const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GEMINI_API_KEY, // Gemini API anahtarınızı kullanın
  model: "gemini-embedding-001", // Gemini için embedding modeli
});

/*
const chatModel = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-4o", // gpt-4 veya gpt-4o da kullanabilirsiniz
  temperature: 0.7,
});
*/

const chatModel = new ChatGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY, // Gemini API anahtarınızı kullanın
  model: "gemini-2.5-flash", // Metin tabanlı sohbetler için Gemini Pro
  temperature: 0.7,
});

// Vektör deposu (Bellek içi - Kalıcı depolama için üretimde farklı bir vektör DB kullanın)
//let vectorStore; // Sunucu başlatıldığında doldurulacak

// --- Yardımcı Fonksiyonlar ---

/**
 * Dosya tipine göre metni çıkarır.
 * @param {string} filePath - Dosya yolu.
 * @param {string} mimeType - Dosyanın MIME tipi.
 * @returns {Promise<string>} Çıkarılan metin.
 */
async function extractTextFromFile(filePath, mimeType) {
  if (mimeType === "application/pdf") {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      if (!dataBuffer || dataBuffer.length === 0) {
        throw new Error("PDF dosyası boş veya okunamadı.");
      }
      const data = await pdf(dataBuffer);
      if (!data || !data.text) {
        throw new Error("PDF'ten metin çıkarılamadı.");
      }
      return data.text;
    } catch (pdfError) {
      console.error(`PDF okuma hatası için '${filePath}':`, pdfError.message);
      // Bu hatayı daha spesifik hale getirebilirsiniz.
      // Belki boş bir string döndürün veya hatayı yukarı fırlatın.
      throw new Error(`PDF işlenirken bir sorun oluştu: ${pdfError.message}`);
    }
  } else if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const { value } = await mammoth.extractRawText({ path: filePath });
    return value;
  } else if (mimeType === "text/plain") {
    return fs.readFileSync(filePath, "utf8");
  } else {
    throw new Error(`Desteklenmeyen dosya tipi: ${mimeType}`);
  }
}

/**
 * Metinleri parçalara ayırır ve embeddinglerini oluşturarak vektör deposuna ekler.
 * @param {string} text - İşlenecek metin.
 * @returns {Promise<void>}
 */
async function indexDocumentText(text) {
  // RecursiveCharacterTextSplitter kullanarak metni parçala
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500, // Her parçanın maksimum token/karakter sayısı
    chunkOverlap: 150, // Parçalar arasındaki çakışma,
  });

  const docs = await textSplitter.createDocuments([text]);

  // Her bir Document objesi için bir kaynaksız Document oluşturalım, aksi halde MemoryVectorStore hata verebilir.
  const documents = docs.map(
    (doc) => new Document({ pageContent: doc.pageContent })
  );

  // Embeddings oluştur ve vektör deposuna ekle
  vectorStore = await MemoryVectorStore.fromDocuments(documents, embeddings);
  console.log(`Toplam ${documents.length} belge parçası indekslendi.`);
}

// --- API Uç Noktaları ---
app.post("/ask-agent", async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ message: "Sorgu metni boş olamaz." });
  }

  // Agent Prompt'unu tanımlayın
  const agentPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "Sen kullanıcının sorularını cevaplayan çok yetenekli bir asistansın. Eğer bir kitap veya dergi aranıyorsa, 'get_books' aracını kullanmalısın. Genel bilgi soruları için kendi bilginle yanıtla.",
    ],
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"], // Agent'ın düşünce süreci için placeholder
  ]);

  // Agent'ı oluştur
  const agent = await createReactAgent({
    llm: chatModel,
    tools: tools,
    prompt: agentPrompt,
  });

  // Agent Executor'ı oluştur ve çalıştır
  const agentExecutor = new AgentExecutor({
    agent: agent,
    tools: tools,
    verbose: true, // Agent'ın düşünce sürecini konsolda görmek için true yapın
  });

  try {
    console.log(`[AGENT ÇAĞRISI] Gelen Sorgu: ${query}`);
    const result = await agentExecutor.invoke({ input: query });
    console.log(`[AGENT YANITI] ${result.output}`);
    res.status(200).json({ response: result.output });
  } catch (error) {
    console.error("Agent sorgusu işlenirken hata oluştu:", error.message);
    res.status(500).json({
      message: "Sorgunuz işlenirken bir sunucu hatası oluştu.",
      error: error.message,
    });
  }
});

/**
 * POST /ask-chatbot
 * Kullanıcı sorgusunu alır, ilgili bağlamı bulur ve OpenAI ile yanıt oluşturur.
 */
app.post("/ask-chatbot", async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ message: "Sorgu metni boş olamaz." });
  }
  const vectorStore = documentProcessor.getVectorStore(); // DocumentProcessor'dan vektör deposunu al
  if (!vectorStore) {
    return res.status(400).json({
      message:
        "Henüz indekslenmiş bir belge yok. Lütfen önce bir belge yükleyin veya sunucuyu varsayılan belgelerle başlatın.",
    });
  }
  try {
    // RAG zincirini oluştur
    const questionAnsweringPrompt = PromptTemplate.fromTemplate(
      `Sen yardımcı bir kütüphane asistanısın. Görevin, kullanıcının sorularını, verilen bağlamdaki bilgilere öncelik vererek yanıtlamaktır.
    Eğer verilen BAĞLAMDA kullanıcının sorusunu yanıtlamak için yeterli bilgi bulunmuyorsa, 'Üzgünüm, bu konu hakkında belgemde yeterli bilgi bulunmuyor.' şeklinde yanıtla.
Eğer bağlamda telefon numarası veya web sitesi gibi tıklanabilir bilgiler varsa, bunları yanıtına **HTML <a href="..."> etiketiyle ekle**. Örneğin:
  - Telefon numarası için: <a href="tel:0000">0000</a>
  - Web sitesi için: <a href="https://www.example.com">Example Website</a>
  Eğer bağlamda resim görsel dosyasının html kodları gibi bilgiler varsa, bunları yanıtına **HTML <img="..."> etiketiyle ekle**. Örneğin:
  - Resim görsel için: <img src="resim.jpg" />
  Bağlam:
  {context}

  Soru: {input}`
    );

    const combineDocsChain = await createStuffDocumentsChain({
      llm: chatModel,
      prompt: questionAnsweringPrompt,
    });

    const retriever = vectorStore.asRetriever(); // Vektör deposundan bir retriever oluştur

    const retrievalChain = await createRetrievalChain({
      retriever: retriever,
      combineDocsChain: combineDocsChain,
    });

    // Zinciri çalıştır ve yanıtı al
    const result = await retrievalChain.invoke({ input: query });
    console.log("Sorgu sonucu:", result);
    res.status(200).json({ response: result.answer });
  } catch (error) {
    console.error("Chatbot sorgusu işlenirken hata oluştu:", error);
    res.status(500).json({
      message: "Sorgunuz işlenirken bir sunucu hatası oluştu.",
      error: error.message,
    });
  }
});

// --- Sunucuyu Başlat ve Otomatik Dosya Yükle ---
app.listen(PORT, async () => {
  console.log(`Backend sunucusu http://localhost:${PORT} adresinde çalışıyor.`);

  if (!fs.existsSync("data")) {
    fs.mkdirSync("data");
  }

  const initialDocsDir = path.join(__dirname, "data");

  if (!fs.existsSync(initialDocsDir)) {
    fs.mkdirSync(initialDocsDir);
    console.log(
      `'${initialDocsDir}' klasörü oluşturuldu. Lütfen içine başlangıç belgelerinizi (txt, pdf, docx) koyun.`
    );
    return;
  }

  // Yüklenecek dosyaları filtrele (txt, pdf, docx)
  const filesToLoad = fs
    .readdirSync(initialDocsDir)
    .filter(
      (file) =>
        file.endsWith(".txt") || file.endsWith(".pdf") || file.endsWith(".docx")
    );

  if (filesToLoad.length === 0) {
    console.log(
      `'${initialDocsDir}' klasöründe yüklenecek .txt, .pdf veya .docx belge bulunamadı. Lütfen klasöre dosya ekleyin.`
    );
  } else {
    console.log(
      `'${initialDocsDir}' klasöründeki varsayılan belgeler yükleniyor:`
    );
    for (const fileName of filesToLoad) {
      const filePath = path.join(initialDocsDir, fileName);
      console.log(`- Yükleniyor: ${fileName}`);
      try {
        // DocumentProcessor sınıfını kullanarak belgeyi işle
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
