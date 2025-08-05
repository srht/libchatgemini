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

const documentProcessor = new DocumentProcessor(process.env.OPENAI_API_KEY);

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
// --- API Uç Noktaları ---
app.post("/ask-agent", async (req, res) => {
  const { getSearchTool } = require("./components/tools/booksearch");
  const { createEmailWriterTool } = require("./components/tools/emailsend");
  const {
    createDocumentSearchTool,
  } = require("./components/tools/documentsearch");

  const emailWriterTool = createEmailWriterTool(chatModel);

  const getInformationFromDocumentsTool = createDocumentSearchTool(
    documentProcessor,
    chatModel
  );

  const query = req.body.query;
  const tools = [
    getSearchTool,
    getInformationFromDocumentsTool,
    emailWriterTool,
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
      `You are a highly capable AI assistant that answers user questions.
You have access to the following tools: {tools}

You must use these tools to answer user questions when appropriate.
If a question requires information about a book or magazine, you MUST use the 'get_books' tool.
If user asks about book call number (location number) or location, you MUST use 'get_books' tool and call 'get_information_from_documents' tool to get location information of the book's call number (location number).
If you response with a location information you MUST provide <img src="itumap.jpg" /> to show the location on the map.
If a question requires information based on uploaded documents, you MUST use the 'get_information_from_documents' tool.
If a question requires writing an email, you MUST use the 'email_writer' tool.
For other general knowledge questions, you MUST use the 'get_information_from_documents' tool.
Always strive to be helpful and provide comprehensive answers.

The names of the tools are: {tool_names}

You MUST always follow this specific format for your responses:

When you need to use a tool:
Thought: You should always think about what to do and which tool to use.
Action: the_name_of_the_tool_to_use (one of {tool_names})
Action Input: the_input_to_the_tool_as_a_plain_string (e.g., "Simyacı" or "chemistry books")
Observation: the_result_of_the_tool (this will be provided by the system)

When you have a final answer and no more tools are needed:
Thought: I have sufficient information to provide a final answer.
Final Answer: Your final answer to the user.

Do NOT include any other text or explanation outside of this format.
Do NOT respond with just a thought.
Do NOT respond with an action and action input if you don't have enough information for a final answer yet.
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
