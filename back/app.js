require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

// LangChain İçe Aktarımları
const { OpenAIEmbeddings, ChatOpenAI } = require("@langchain/openai");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { MemoryVectorStore } = require("langchain/vectorstores/memory");
const { Document } = require("@langchain/core/documents");
const {
  createStuffDocumentsChain,
} = require("langchain/chains/combine_documents");
const { createRetrievalChain } = require("langchain/chains/retrieval");
const { PromptTemplate } = require("@langchain/core/prompts");

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

// --- LangChain Bileşenleri ---
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "text-embedding-ada-002", // Varsayılan model, isteğe bağlı
});

const chatModel = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-4o", // gpt-4 veya gpt-4o da kullanabilirsiniz
  temperature: 0.7,
});

// Vektör deposu (Bellek içi - Kalıcı depolama için üretimde farklı bir vektör DB kullanın)
let vectorStore; // Sunucu başlatıldığında doldurulacak

// --- Yardımcı Fonksiyonlar ---

/**
 * Dosya tipine göre metni çıkarır.
 * @param {string} filePath - Dosya yolu.
 * @param {string} mimeType - Dosyanın MIME tipi.
 * @returns {Promise<string>} Çıkarılan metin.
 */
async function extractTextFromFile(filePath, mimeType) {
  if (mimeType === "application/pdf") {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    return data.text;
  } else if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    // .docx
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
    chunkOverlap: 80, // Parçalar arasındaki çakışma
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

/**
 * POST /upload-document
 * Yüklenen bir belgeyi işler, parçalara ayırır ve embeddinglerini oluşturur.
 */
app.post("/upload-document", upload.single("document"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Dosya bulunamadı." });
  }

  const filePath = req.file.path;
  const mimeType = req.file.mimetype;
  console.log(`Dosya yüklendi: ${filePath}, Tip: ${mimeType}`);

  try {
    const text = await extractTextFromFile(filePath, mimeType);
    if (!text || text.trim().length === 0) {
      fs.unlinkSync(filePath);
      return res
        .status(400)
        .json({ message: "Dosya içeriği boş veya desteklenmiyor." });
    }

    await indexDocumentText(text); // LangChain kullanarak indeksle

    fs.unlinkSync(filePath); // Geçici dosyayı sil

    res
      .status(200)
      .json({ message: "Belge başarıyla yüklendi ve indekslendi." });
  } catch (error) {
    console.error("Belge işlenirken hata oluştu:", error);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.status(500).json({
      message: "Belge işlenirken sunucu hatası oluştu.",
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

  if (!vectorStore) {
    return res.status(400).json({
      message:
        "Henüz indekslenmiş bir belge yok. Lütfen önce bir belge yükleyin veya sunucuyu varsayılan belgeyle başlatın.",
    });
  }

  try {
    // RAG zincirini oluştur
    const questionAnsweringPrompt = PromptTemplate.fromTemplate(
      `Aşağıdaki bağlamı kullanarak kullanıcının sorusuna cevap ver. 
            Eğer bağlamda bilgi yoksa, 'Üzgünüm, bu konu hakkında belgemde yeterli bilgi bulunmuyor.' şeklinde yanıtla.
            Sadece bağlamdaki bilgilere sadık kal.
            
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

  // Yükleme klasörünü oluştur (yoksa)
  if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads");
  }

  // --- OTOMATİK DOSYA YÜKLEME KISMI ---
  const initialDocumentPath = path.join(__dirname, "initial_document.txt");
  console.log(
    `Sunucu başlatılırken varsayılan belge yükleniyor: ${initialDocumentPath}`
  );

  try {
    const text = await extractTextFromFile(initialDocumentPath, "text/plain"); // initial_document.txt'nin tipi
    if (text && text.trim().length > 0) {
      await indexDocumentText(text); // LangChain kullanarak indeksle
      console.log("Varsayılan belge başarıyla indekslendi.");
    } else {
      console.log("Varsayılan belge boş veya okunamadı, indeksleme yapılmadı.");
    }
  } catch (error) {
    console.error("Varsayılan belge yüklenirken hata oluştu:", error);
  }
});
