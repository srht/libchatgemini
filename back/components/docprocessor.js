// documentProcessor.js

const fs = require("fs");
const path = require("path");
const pdf = require("pdf-parse");
const mammoth = require("mammoth"); // DOCX için
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { MemoryVectorStore } = require("langchain/vectorstores/memory");
const { Document } = require("@langchain/core/documents");
const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai"); // Ya da OpenAIEmbeddings

class DocumentProcessor {
  constructor(
    apiKey,
    embeddingModel = "gemini-embedding-001",
    chunkSize = 500,
    chunkOverlap = 150
  ) {
    if (!apiKey) {
      throw new Error("API Anahtarı sağlanmalıdır.");
    }
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: apiKey,
      model: embeddingModel,
    });
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

    if (this.vectorStore) {
      await this.vectorStore.addDocuments(documents);
      console.log(
        `'${fileName}' kaynağından ${documents.length} yeni belge parçası vektör deposuna eklendi.`
      );
    } else {
      this.vectorStore = await MemoryVectorStore.fromDocuments(
        documents,
        this.embeddings
      );
      console.log(
        `'${fileName}' kaynağından toplam ${documents.length} belge parçası ile vektör deposu oluşturuldu.`
      );
    }
  }

  /**
   * Mevcut vektör deposunu döndürür.
   * @returns {MemoryVectorStore | null}
   */
  getVectorStore() {
    return this.vectorStore;
  }
}

module.exports = DocumentProcessor;
