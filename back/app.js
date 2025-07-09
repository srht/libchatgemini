require("dotenv").config(); // .env dosyasındaki değişkenleri yükle

const express = require("express");
const cors = require("cors");
const multer = require("multer"); // Dosya yükleme için
const fs = require("fs");
const path = require("path"); // Path modülünü ekleyin
const OpenAI = require("openai");
const natural = require("natural"); // Metin parçalama için

// OpenAI API istemcisini başlat
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
const PORT = process.env.PORT || 3001; // Backend için varsayılan port 3001

// --- Middleware'ler ---
app.use(cors()); // Tüm frontend isteklerine izin ver
app.use(express.json()); // JSON formatındaki request body'lerini ayrıştırmak için

// Multer yapılandırması: Yüklenen dosyaları 'uploads' klasörüne kaydet
const upload = multer({ dest: "uploads/" });

// --- Bellek İçi Vektör Veritabanı (Geçici ve Basit Uygulama için) ---
const documentChunks = [];
const documentEmbeddings = [];

// --- Yardımcı Fonksiyonlar ---

/**
 * Dosyayı okur ve metni cümlelere böler (chunking).
 * @param {string} filePath - Okunacak dosyanın yolu.
 * @returns {string[]} Metin parçalarının dizisi.
 */
async function readFileAndChunk(filePath) {
  try {
    // Dosya mevcut mu kontrol edelim
    if (!fs.existsSync(filePath)) {
      console.warn(
        `Uyarı: Dosya bulunamadı: ${filePath}. Otomatik yükleme atlanıyor.`
      );
      return [];
    }
    // Şu an sadece .txt dosyalarını destekliyoruz.
    const text = fs.readFileSync(filePath, "utf8");
    const tokenizer = new natural.SentenceTokenizer();
    const sentences = tokenizer.tokenize(text);

    const chunks = sentences.map((s) => s.trim()).filter((s) => s.length > 0);

    console.log(`Dosyadan ${chunks.length} parça çıkarıldı: ${filePath}`);
    return chunks;
  } catch (error) {
    console.error("Dosya okunurken veya parçalanırken hata oluştu:", error);
    return [];
  }
}

/**
 * Metin dizileri için embedding vektörleri oluşturur.
 * @param {string[]} texts - Embedding oluşturulacak metinlerin dizisi.
 * @returns {number[][]} Her metin için bir embedding vektörü içeren dizi.
 */
async function getEmbeddings(texts) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: texts,
    });
    return response.data.map((item) => item.embedding);
  } catch (error) {
    console.error("Embeddings oluşturulurken hata oluştu:", error);
    return [];
  }
}

/**
 * İki vektör arasındaki kosinüs benzerliğini hesaplar.
 * @param {number[]} vecA - Birinci vektör.
 * @param {number[]} vecB - İkinci vektör.
 * @returns {number} Kosinüs benzerliği değeri.
 */
function calculateCosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error("Vektör uzunlukları eşleşmiyor.");
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0; // Sıfır vektörler için benzerlik tanımsızdır, 0 döndürelim.
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

// --- API Uç Noktaları ---
// (Bu kısım önceki ile aynı, değişiklik yok)
app.post("/upload-document", upload.single("document"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Dosya bulunamadı." });
  }

  const filePath = req.file.path;
  console.log(`Dosya yüklendi: ${filePath}`);

  try {
    const chunks = await readFileAndChunk(filePath);
    if (chunks.length === 0) {
      fs.unlinkSync(filePath);
      return res
        .status(400)
        .json({ message: "Dosya içeriği boş veya işlenemedi." });
    }

    const embeddings = await getEmbeddings(chunks);

    // Mevcutları temizle ve yenilerini ekle (tek bir dokümanı destekleyecek şekilde)
    documentChunks.splice(0, documentChunks.length, ...chunks);
    documentEmbeddings.splice(0, documentEmbeddings.length, ...embeddings);

    fs.unlinkSync(filePath); // Geçici dosyayı sil

    res.status(200).json({
      message: "Belge başarıyla yüklendi ve indekslendi.",
      indexedChunks: chunks.length,
    });
  } catch (error) {
    console.error("Belge işlenirken hata oluştu:", error);
    fs.unlinkSync(filePath);
    res.status(500).json({
      message: "Belge işlenirken sunucu hatası oluştu.",
      error: error.message,
    });
  }
});

app.post("/ask-chatbot", async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ message: "Sorgu metni boş olamaz." });
  }

  if (documentChunks.length === 0) {
    return res.status(400).json({
      message:
        "Henüz indekslenmiş bir belge yok. Lütfen önce bir belge yükleyin veya sunucuyu varsayılan belgeyle başlatın.",
    });
  }

  try {
    const queryEmbeddingResponse = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: [query],
    });
    const queryEmbedding = queryEmbeddingResponse.data[0].embedding;

    const similarities = [];
    for (let i = 0; i < documentEmbeddings.length; i++) {
      const sim = calculateCosineSimilarity(
        queryEmbedding,
        documentEmbeddings[i]
      );
      similarities.push({ similarity: sim, index: i });
    }

    similarities.sort((a, b) => b.similarity - a.similarity);

    const topN = 3;
    const relevantChunks = [];
    for (let i = 0; i < Math.min(topN, similarities.length); i++) {
      relevantChunks.push(documentChunks[similarities[i].index]);
    }

    const contextStr =
      relevantChunks.length > 0
        ? relevantChunks.join("\n")
        : "Sağlanan belge içinde bilgi bulunamadı.";

    const messages = [
      {
        role: "system",
        content:
          "Sen yardımcı bir asistansın. Eğer verilen bağlamda bilgi yoksa, 'Üzgünüm, bu konu hakkında belgemde yeterli bilgi bulunmuyor.' şeklinde yanıtla. Sadece bağlamdaki bilgilere sadık kal.",
      },
      {
        role: "user",
        content: `Bağlam:\n${contextStr}\n\nKullanıcının sorusu: ${query}`,
      },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // GPT-4 Turbo modelini kullanıyoruz
      messages: messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    const botResponse = completion.choices[0].message.content;
    res.status(200).json({ response: botResponse });
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
  // async anahtar kelimesini ekleyin
  console.log(`Backend sunucusu http://localhost:${PORT} adresinde çalışıyor.`);

  // Yükleme klasörünü oluştur (yoksa)
  if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads");
  }

  // --- OTOMATİK DOSYA YÜKLEME KISMI ---
  const initialDocumentPath = path.join(__dirname, "initial_document.txt"); // Backend klasöründe varsayılan dosya
  console.log(
    `Sunucu başlatılırken varsayılan belge yükleniyor: ${initialDocumentPath}`
  );

  try {
    const chunks = await readFileAndChunk(initialDocumentPath);
    if (chunks.length > 0) {
      const embeddings = await getEmbeddings(chunks);
      // Bellek içi veritabanına ekle
      documentChunks.splice(0, documentChunks.length, ...chunks);
      documentEmbeddings.splice(0, documentEmbeddings.length, ...embeddings);
      console.log(
        `Varsayılan belge başarıyla indekslendi (${chunks.length} parça).`
      );
    } else {
      console.log("Varsayılan belge boş veya okunamadı, indeksleme yapılmadı.");
    }
  } catch (error) {
    console.error("Varsayılan belge yüklenirken hata oluştu:", error);
  }
});
