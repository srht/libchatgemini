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
const { OpenAIEmbeddings, ChatOpenAI } = require("@langchain/openai");
const {
  ChatAlibabaTongyi,
} = require("@langchain/community/chat_models/alibaba_tongyi");
const {
  createStuffDocumentsChain,
} = require("langchain/chains/combine_documents");
const { createRetrievalChain } = require("langchain/chains/retrieval");

const {
  ChatPromptTemplate,
  PromptTemplate,
} = require("@langchain/core/prompts");
const { StringOutputParser } = require("@langchain/core/output_parsers");
class HTMLPassthroughOutputParser {
  async parse(text) {
    return text; // Hiçbir parse işlemi yapma, direkt döndür
  }

  getFormatInstructions() {
    return "Return your response as raw HTML.";
  }
}
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

/*
const chatModel = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-4o", // gpt-4 veya gpt-4o da kullanabilirsiniz
  temperature: 0.7,
});
*/
/*
const chatModel = new ChatAlibabaTongyi({
  model: "qwen-plus", // Available models: qwen-turbo, qwen-plus, qwen-max
  temperature: 0.7,
  alibabaApiKey: process.env.QWEN_API_KEY, // In Node.js defaults to process.env.ALIBABA_API_KEY
});
*/
// --- API Uç Noktaları ---
app.post("/ask-agent", async (req, res) => {
  const { getSearchTool } = require("./components/tools/booksearch");
  const {
    getDatabaseSearchTool,
  } = require("./components/tools/databasesearch");
  const {
    getCourseBookSearchTool,
  } = require("./components/tools/coursebooksearch");

  const { createEmailWriterTool } = require("./helperdocuments/emailsend");
  const {
    createDocumentSearchTool,
  } = require("./components/tools/documentsearch");

  const {
    createLibraryWebPageSearchTool,
  } = require("./components/tools/webdocsearch");

  const emailWriterTool = createEmailWriterTool(chatModel);

  const getInformationFromDocumentsTool = createDocumentSearchTool(
    documentProcessor,
    chatModel
  );

  const getContactInformationTool = createLibraryWebPageSearchTool(chatModel);

  const query = req.body.query;
  const tools = [
    getSearchTool,
    getInformationFromDocumentsTool,
    emailWriterTool,
    getCourseBookSearchTool,
    getDatabaseSearchTool,
  ];

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
      `You are a highly capable library assistant AI. You can think privately, call tools when needed, and deliver a clean HTML final answer.

Tools available: {tools}
Tool names: {tool_names}

When to use tools

Books/magazines (incl. call numbers or locations): Use get_books. If a physical item’s location is requested or implied, also call get_information_from_documents to resolve the location for the call number.

Course books/materials: Use get_course_books.

Library databases (what the library subscribes to): Use get_library_databases, then guide the user to the library page: https://kutuphane.itu.edu.tr/arastirma/veritabanlari

Queries requiring info from uploaded documents: Use get_information_from_documents.

Email drafting: Use email_writer.

Searching within subscribed e-resources on the web: Use get_databases_from_web.

General knowledge: Do not answer directly; use the most relevant tool above.

Fallback rule
If, after using the appropriate tools (including retrying with likely misspellings), you still lack sufficient information, end the turn exactly like this (no quotes):
Thought: I have insufficient information to answer from available tools. I will provide the fallback message in the user's language.
Final Answer: <p>I would like to help you but I'm sorry I don't have enough information about this subject. Please consult the reference librarians in the library or ask the live support chat on the library website.</p>

(Translate the sentence for the user’s language when needed; Turkish example you may output:)
Final Answer: <p>Size yardımcı olmak isterdim ancak bu konuda yeterli bilgim yok. <br>Lütfen kütüphanedeki referans kütüphanecilerine başvurun veya kütüphane web sitesindeki canlı destekten yardım isteyin.</p>

Special rules

If a book is an e-book, do not provide a physical call number.

If you can't find a book you must check if the user misspelled the book name fix with your own information and try again.

If user greets you, greet warmly. If asked your name: “I am a library assistant AI created by the library team.”

Do NOT include any other text or explanation outside of this format.
Do NOT respond with just a thought.
Do NOT respond with an action and action input if you don't have enough information for a final answer yet.

Output protocol (ReAct)

Thought: brief private reasoning, no HTML.

Action: exact tool name from {tool_names}.

Action Input: plain string.
(Observation will be supplied by the system; you do not write it.)
Repeat Thought → Action → (system Observation) as needed. When ready:

Thought: I have sufficient information to provide a final answer.

Final Answer: valid HTML only, no Markdown.

HTML rules for Final Answer

Use <h3> with <ul><li> for lists.

Use <b> for key terms/headings.

Use <br> for line breaks.

If giving a book’s physical location, include the catalog record URL as an HTML <a> link taken from the tool’s data.

For academic databases, include each database’s links as HTML anchors to the description page. If only the on-campus URL is available and a proxy prefix is provided by tools, construct the off-campus link using the proxy prefix + the encoded on-campus URL; if not available, state it cannot be found.

Never include Thought/Action/Observation in the Final Answer.

Examples (brace-safe)
Example 1 — book with call number
Thought: Need bibliographic data and call number → use get_books.
Action: get_books
Action Input: "Simyacı Paulo Coelho"
Observation: (system provides JSON with record, call number, isEbook=false, catalogUrl=...)
Thought: Need shelf/location for this call number → use get_information_from_documents.
Action: get_information_from_documents
Action Input: "PL2718.O46 S56 2013"
Observation: (system provides {{ "location": "Central Library 2nd Floor" }})
Thought: I have sufficient information to provide a final answer.
Final Answer:

<p><b>Bulduğum kayıt:</b><br><b>Başlık:</b> Simyacı (Paulo Coelho)<br><b>Yer Numarası:</b> PL2718.O46 S56 2013<br><b>Konum:</b> Central Library 2nd Floor, Shelf B12<br><b>Katalog Kaydı:</b> <a href="CATALOG_URL_HERE">Görüntüle</a></p>
Example 2 — e-book
Thought: Use get_books; if ebook, omit call number.
Action: get_books
Action Input: "Modern Data Science with R 2nd edition"
Observation: (system provides isEbook=true, catalogUrl=...)
Thought: I have sufficient information to provide a final answer.
Final Answer:

<p><b>E-kitap bulundu:</b><br><b>Başlık:</b> Modern Data Science with R (2. baskı)<br>Bu kaynak <b>e-kitaptır</b>; fiziksel yer numarası yoktur.<br><b>Erişim:</b> <a href="CATALOG_URL_HERE">Katalog Kaydı</a></p>`,
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
    verbose: true, // Agent'ın düşünce sürecini konsolda görmek için true yapın,
    handleParsingErrors: true, // Hata durumunda düz metin döndür
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
  // await documentProcessor.processPersonelPage();

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
