// documentProcessor.js

const fs = require("fs");
const path = require("path");
const pdf = require("pdf-parse");
const mammoth = require("mammoth"); // DOCX için
const {
  getPageContent,
  getPersonelPage,
  getPlainPage,
} = require("./functions/readPage");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { MemoryVectorStore } = require("langchain/vectorstores/memory");
const { Document } = require("@langchain/core/documents");
const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai"); // Ya da OpenAIEmbeddings
const { OpenAIEmbeddings, ChatOpenAI } = require("@langchain/openai");

class DocumentProcessor {
  constructor(
    apiKey,
    embeddingModel = "gemini-embedding-001",
    chunkSize = 1000,
    chunkOverlap = 300
  ) {
    if (!apiKey) {
      throw new Error("API Anahtarı sağlanmalıdır.");
    }

    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GEMINI_API_KEY, // Ya da OpenAI API anahtarı
      model: embeddingModel,
    });

    /*
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "text-embedding-ada-002", // Varsayılan model, isteğe bağlı
    });
*/
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: chunkSize,
      chunkOverlap: chunkOverlap,
    });
    this.vectorStore = null; // Vektör deposu başlangıçta boş olacak
  }

  /**
   * Dosya tipine göre metni çıkarır.
   * @param {string} filePath - Dosya yolu.
   * @param {string} mimeType - Dosyanın MIME tipi.
   * @returns {Promise<string>} Çıkarılan metin.
   */
  async #extractTextFromFile(filePath, mimeType) {
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
        // Dilerseniz burada cleanExtractedText() fonksiyonunu kullanabilirsiniz
        return data.text;
      } catch (pdfError) {
        console.error(`PDF okuma hatası için '${filePath}':`, pdfError.message);
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
   * Verilen metin dosyasını işler, parçalara ayırır ve vektör deposuna ekler.
   * @param {string} filePath - İşlenecek dosyanın yolu.
   * @param {string} fileName - Dosyanın orijinal adı (metadata için).
   * @returns {Promise<void>}
   */
  async processDocument(filePath, fileName) {
    const fileExtension = path.extname(fileName).toLowerCase();
    let mimeType;

    switch (fileExtension) {
      case ".txt":
        mimeType = "text/plain";
        break;
      case ".pdf":
        mimeType = "application/pdf";
        break;
      case ".docx":
        mimeType =
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        break;
      default:
        throw new Error(`Desteklenmeyen dosya uzantısı: ${fileExtension}`);
    }

    let text;
    try {
      text = await this.#extractTextFromFile(filePath, mimeType);
      if (!text || text.trim().length === 0) {
        throw new Error("Çıkarılan metin boş.");
      }
    } catch (error) {
      console.error(
        `Dosya '${fileName}' metin çıkarılırken hata oluştu:`,
        error.message
      );
      throw error; // Hatayı yukarı fırlat
    }

    const docs = await this.textSplitter.createDocuments([text], {
      source: fileName,
    });
    const documents = docs.map(
      (doc) =>
        new Document({ pageContent: doc.pageContent, metadata: doc.metadata })
    );

    await this.addDocumentsInBatches(documents);
  }

  /**
   * Belgeleri toplu (batch) olarak işler ve vektör deposuna ekler.
   * @param {Document[]} documents - Eklenecek belge parçaları dizisi.
   * @param {number} batchSize - Her bir toplu işlemde gönderilecek belge sayısı.
   * @returns {Promise<void>}
   */
  async addDocumentsInBatches(documents, batchSize = 25) {
    console.log(`Toplam ${documents.length} belge parçası işleniyor.`);
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      console.log(
        `Batch ${Math.floor(i / batchSize) + 1} (${
          batch.length
        } belge) gönderiliyor...`
      );

      // LangChain'in MemoryVectorStore sınıfı zaten bir dizi belgeyi
      // toplu olarak işleyebiliyor. Ancak API tarafında limitler varsa
      // bu tür bir manuel gruplama daha güvenli olur.
      if (this.vectorStore) {
        await this.vectorStore.addDocuments(batch);
      } else {
        this.vectorStore = await MemoryVectorStore.fromDocuments(
          batch,
          this.embeddings
        );
      }
      console.log(`Batch ${Math.floor(i / batchSize) + 1} başarıyla eklendi.`);

      // Limitleri aşmamak için her toplu işlem arasında bekleme ekleyebilirsiniz.
      // Örneğin 1 saniye beklemek gibi.
      if (i + batchSize < documents.length) {
        console.log("Bir sonraki batch için 1 saniye bekleniyor...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  async processWebPage(url) {
    let text;
    try {
      text = await getPageContent(url);
      if (!text || text.trim().length === 0) {
        throw new Error("Çıkarılan metin boş.");
      }

      console.log(`Web sayfasından metin çıkarıldı: ${text}`);
    } catch (error) {
      console.error(
        `Dosya '${url}' metin çıkarılırken hata oluştu:`,
        error.message
      );
      throw error; // Hatayı yukarı fırlat
    }

    const docs = await this.textSplitter.createDocuments([text], {
      source: url,
    });
    const documents = docs.map(
      (doc) =>
        new Document({ pageContent: doc.pageContent, metadata: doc.metadata })
    );
    console.log(
      `${url} Web sayfasından ${documents.length} belge parçası oluşturuldu.`
    );
    await this.addDocumentsInBatches(documents);
  }

  async processPlainWebPage(url) {
    let text;
    try {
      text = await getPlainPage(url);
      if (!text || text.trim().length === 0) {
        throw new Error("Çıkarılan metin boş.");
      }

      console.log(`Web sayfasından metin çıkarıldı: ${text}`);
    } catch (error) {
      console.error(
        `Dosya '${url}' metin çıkarılırken hata oluştu:`,
        error.message
      );
      throw error; // Hatayı yukarı fırlat
    }

    const docs = await this.textSplitter.createDocuments([text], {
      source: url,
    });
    const documents = docs.map(
      (doc) =>
        new Document({ pageContent: doc.pageContent, metadata: doc.metadata })
    );
    console.log(
      `${url} Web sayfasından ${documents.length} belge parçası oluşturuldu.`
    );
    await this.addDocumentsInBatches(documents);
  }

  async processPersonelPage() {
    let text;
    const url = "https://kutuphane.itu.edu.tr/hakkimizda/personel-ve-bolumler";
    try {
      text = await getPersonelPage(url);
      if (!text || text.trim().length === 0) {
        throw new Error("Çıkarılan metin boş.");
      }

      console.log(`Web sayfasından metin çıkarıldı: ${text}`);
    } catch (error) {
      console.error(
        `Dosya '${url}' metin çıkarılırken hata oluştu:`,
        error.message
      );
      throw error; // Hatayı yukarı fırlat
    }

    const docs = await this.textSplitter.createDocuments([text], {
      source: url,
    });
    const documents = docs.map(
      (doc) =>
        new Document({ pageContent: doc.pageContent, metadata: doc.metadata })
    );
    console.log(
      `${url} Web sayfasından ${documents.length} belge parçası oluşturuldu.`
    );
    await this.addDocumentsInBatches(documents);
  }

  /**
   * Mevcut vektör deposunu döndürür.
   * @returns {MemoryVectorStore | null}
   */
  getVectorStore() {
    console.log("Vektör deposu alınıyor...");
    return this.vectorStore;
  }
}

module.exports = DocumentProcessor;
