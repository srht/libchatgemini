require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const DocumentProcessor = require("./components/docprocessor"); // DocumentProcessor sınıfını içe aktar
const { AgentExecutor, createReactAgent } = require("langchain/agents");
const {
  GoogleGenerativeAIEmbeddings,
  ChatGoogleGenerativeAI,
} = require("@langchain/google-genai");
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

const documentProcessor = new DocumentProcessor(process.env.GEMINI_API_KEY);

const chatModel = new ChatGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY, // Gemini API anahtarınızı kullanın
  model: "gemini-2.5-flash", // Metin tabanlı sohbetler için Gemini Pro
  temperature: 0.7,
});

// --- API Uç Noktaları ---
app.post("/ask-agent", async (req, res) => {
  const { getSearchTool } = require("./components/tools/booksearch");
  const { getInformationFromDocumentsTool } = require("./components/tools/documentsearch");
  const query = "denemeler kitabı var mı?"; // Örnek bir sorgu
  const tools = [getSearchTool,getInformationFromDocumentsTool];

  console.log("=== DEBUGGING TOOLS ARRAY ===");
  console.log("Tools variable type:", typeof tools);
  console.log("Tools is array:", Array.isArray(tools));
  console.log("Tools length:", tools?.length);
  console.log("Raw tools variable:", tools);

  // Check each item in the array
  if (Array.isArray(tools)) {
    tools.forEach((tool, index) => {
      console.log(`\nTool ${index}:`);
      console.log("  - Type:", typeof tool);
      console.log("  - Is null:", tool === null);
      console.log("  - Is undefined:", tool === undefined);
      console.log("  - Has name property:", "name" in (tool || {}));
      console.log("  - Name value:", tool?.name);
      console.log("  - Full object:", tool);
    });
  } else {
    console.log("ERROR: tools is not an array!");
  }

  // Agent Prompt'unu tanımlayın
  const agentPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `Sen kullanıcının sorularını cevaplayan çok yetenekli bir asistansın.
      Kullanıcının sorularını uygun olduğunda yanıtlamak için elindeki {tool_names} araçlarını kullanmalısın.

Kullanabileceğin araçlar şunlardır:
{tools} 

ÖNEMLİ: Araçları kullanırken şu formatı takip etmelisin:
Action: [araç_adı]
Action Input: [araç_girişi]

Örnek:
Action: get_books
Action Input: Simyacı

Eğer bir kitap veya dergi aranıyorsa, 'get_books' aracını kullanmalısın. Genel bilgi soruları için kendi bilginle yanıtla.
Eğer bir belgeye dayalı bilgi sorularınız varsa, 'get_information_from_documents' aracını kullanmalısın.

Eğer sorunun cevabını bulduysan, cevabını aşağıdaki formatta ver:
Final Answer: [cevabın]

Aşağıdaki örnekte olduğu gibi, cevabını mutlaka 'Final Answer: ...' ile başlat:

Örnek:
Action: get_books
Action Input: Simyacı

Observation: null
Thought: Kitap bulunamadı.

Final Answer: Üzgünüm, "Simyacı" adlı kitabı kütüphane kataloğunda bulamadım.
`,
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
    returnIntermediateSteps: true, // Ara adımları döndür
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
