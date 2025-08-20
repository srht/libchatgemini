require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const DocumentProcessor = require("./components/docprocessor"); // DocumentProcessor sınıfını içe aktar
const ChatLogger = require("./components/logger"); // ChatLogger sınıfını içe aktar
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

// Custom callback handler for detailed logging
class DetailedLoggingCallbackHandler {
  constructor(chatLogger) {
    this.chatLogger = chatLogger;
    this.currentChainId = null;
    this.chainLogs = [];
  }

  handleChainStart(chain, inputs, runId, parentRunId, tags, metadata) {
    this.currentChainId = runId;
    const logEntry = {
      type: 'chain_start',
      runId,
      parentRunId,
      chainName: chain.constructor.name,
      inputs: this.sanitizeInputs(inputs),
      tags,
      metadata,
      timestamp: new Date().toISOString()
    };
    
    this.chainLogs.push(logEntry);
    
    // Console'da da göster
    console.log('\n🔗 CHAIN START:', {
      chainName: logEntry.chainName,
      runId: logEntry.runId,
      inputs: logEntry.inputs
    });
  }

  handleChainEnd(outputs, runId, parentRunId, tags, metadata) {
    const logEntry = {
      type: 'chain_end',
      runId,
      parentRunId,
      outputs: this.sanitizeOutputs(outputs),
      tags,
      metadata,
      timestamp: new Date().toISOString()
    };
    
    this.chainLogs.push(logEntry);
    
    // Console'da da göster
    console.log('✅ CHAIN END:', {
      runId: logEntry.runId,
      outputs: logEntry.outputs
    });
  }

  handleLLMStart(llm, prompts, runId, parentRunId, tags, metadata) {
    const logEntry = {
      type: 'llm_start',
      runId,
      parentRunId,
      llmName: llm.constructor.name,
      prompts: this.sanitizePrompts(prompts),
      tags,
      metadata,
      timestamp: new Date().toISOString()
    };
    
    this.chainLogs.push(logEntry);
    
    // Console'da da göster
    console.log('🤖 LLM START:', {
      llmName: logEntry.llmName,
      runId: logEntry.runId,
      promptCount: logEntry.prompts.length
    });
  }

  handleLLMEnd(output, runId, parentRunId, tags, metadata) {
    const logEntry = {
      type: 'llm_end',
      runId,
      parentRunId,
      output: this.sanitizeOutput(output),
      tags,
      metadata,
      timestamp: new Date().toISOString()
    };
    
    this.chainLogs.push(logEntry);
    
    // Console'da da göster
    console.log('🎯 LLM END:', {
      runId: logEntry.runId,
      outputLength: typeof logEntry.output === 'string' ? logEntry.output.length : 'N/A'
    });
  }

  handleToolStart(tool, input, runId, parentRunId, tags, metadata) {
    const logEntry = {
      type: 'tool_start',
      runId,
      parentRunId,
      toolName: tool.name || tool.constructor.name,
      input: this.sanitizeInput(input),
      tags,
      metadata,
      timestamp: new Date().toISOString()
    };
    
    this.chainLogs.push(logEntry);
    
    // Console'da da göster
    console.log('🔧 TOOL START:', {
      toolName: logEntry.toolName,
      runId: logEntry.runId,
      input: logEntry.input
    });
  }

  handleToolEnd(output, runId, parentRunId, tags, metadata) {
    const logEntry = {
      type: 'tool_end',
      runId,
      parentRunId,
      output: this.sanitizeOutput(output),
      tags,
      metadata,
      timestamp: new Date().toISOString()
    };
    
    this.chainLogs.push(logEntry);
    
    // Console'da da göster
    console.log('🏁 TOOL END:', {
      runId: logEntry.runId,
      outputLength: typeof logEntry.output === 'string' ? logEntry.output.length : 'N/A'
    });
  }

  handleAgentAction(action, runId, parentRunId, tags, metadata) {
    const logEntry = {
      type: 'agent_action',
      runId,
      parentRunId,
      action: this.sanitizeAction(action),
      tags,
      metadata,
      timestamp: new Date().toISOString()
    };
    
    this.chainLogs.push(logEntry);
    
    // Console'da da göster
    console.log('🎭 AGENT ACTION:', {
      runId: logEntry.runId,
      tool: logEntry.action?.tool,
      input: logEntry.action?.toolInput
    });
  }

  handleAgentEnd(action, runId, parentRunId, tags, metadata) {
    const logEntry = {
      type: 'agent_end',
      runId,
      parentRunId,
      action: this.sanitizeAction(action),
      tags,
      metadata,
      timestamp: new Date().toISOString()
    };
    
    this.chainLogs.push(logEntry);
    
    // Console'da da göster
    console.log('🎬 AGENT END:', {
      runId: logEntry.runId,
      finalAction: logEntry.action
    });
  }

  handleText(text, runId, parentRunId, tags, metadata) {
    const logEntry = {
      type: 'text',
      runId,
      parentRunId,
      text: this.sanitizeText(text),
      tags,
      metadata,
      timestamp: new Date().toISOString()
    };
    
    this.chainLogs.push(logEntry);
    
    // Console'da da göster
    console.log('📝 TEXT:', {
      runId: logEntry.runId,
      text: logEntry.text
    });
  }

  // Helper methods for sanitizing data
  sanitizeInputs(inputs) {
    try {
      return JSON.parse(JSON.stringify(inputs));
    } catch (e) {
      return { error: 'Could not serialize inputs', original: String(inputs) };
    }
  }

  sanitizeOutputs(outputs) {
    try {
      return JSON.parse(JSON.stringify(outputs));
    } catch (e) {
      return { error: 'Could not serialize outputs', original: String(outputs) };
    }
  }

  sanitizePrompts(prompts) {
    try {
      return prompts.map(prompt => {
        if (typeof prompt === 'string') return prompt;
        if (prompt && typeof prompt === 'object') {
          return {
            type: prompt.constructor.name,
            content: prompt.content || prompt.text || String(prompt)
          };
        }
        return String(prompt);
      });
    } catch (e) {
      return { error: 'Could not serialize prompts' };
    }
  }

  sanitizeInput(input) {
    try {
      return JSON.parse(JSON.stringify(input));
    } catch (e) {
      return { error: 'Could not serialize input', original: String(input) };
    }
  }

  sanitizeOutput(output) {
    try {
      return JSON.parse(JSON.stringify(output));
    } catch (e) {
      return { error: 'Could not serialize output', original: String(output) };
    }
  }

  sanitizeAction(action) {
    try {
      return JSON.parse(JSON.stringify(action));
    } catch (e) {
      return { error: 'Could not serialize action', original: String(action) };
    }
  }

  sanitizeText(text) {
    try {
      return JSON.parse(JSON.stringify(text));
    } catch (e) {
      return { error: 'Could not serialize text', original: String(text) };
    }
  }

  // Get all logs for current execution
  getChainLogs() {
    return this.chainLogs;
  }

  // Clear logs for new execution
  clearChainLogs() {
    this.chainLogs = [];
    this.currentChainId = null;
  }
}
const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware'ler ---
app.use(cors());
app.use(express.json());

const documentProcessor = new DocumentProcessor(process.env.GEMINI_API_KEY);
const chatLogger = new ChatLogger(); // ChatLogger instance'ı oluştur

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
    chatModel,
    chatLogger
  );

  const getContactInformationTool = createLibraryWebPageSearchTool(chatModel);

  const query = req.body.query;
  const tools = [
    getSearchTool,
    getInformationFromDocumentsTool,
    emailWriterTool,
    getCourseBookSearchTool,
    getDatabaseSearchTool,
    getContactInformationTool,
  ];

  // Her sorgu için yeni callback handler oluştur
  const detailedCallbackHandler = new DetailedLoggingCallbackHandler(chatLogger);
  detailedCallbackHandler.clearChainLogs();

  try {
    // Agent prompt'unu tanımla
    const agentPrompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are a highly capable library assistant AI. You can think privately, call tools when needed, and deliver a clean HTML final answer.

Tools available: {tools}
Tool names: {tool_names}

When to use tools

Books/magazines (incl. call numbers or locations): Use get_books. If a physical item's location is requested or implied, also call get_information_from_documents to resolve the location for the call number.

IMPORTANT: For "where is [book name]" questions:
1. First use get_books to find the book and get its call number
2. Then try use get_information_from_documents with the call number to find which floor/shelf it's located on
3. Provide complete location information including floor, shelf, and call number from the documents

Course books/materials: Use get_course_books.

Library databases (what the library subscribes to): Use get_library_databases, then guide the user to the library page even nothing found: https://kutuphane.itu.edu.tr/arastirma/veritabanlari

Queries requiring info from uploaded documents: Use get_information_from_documents.

IMPORTANT: For "how to" and "nasıl yapılır" questions:
1. ALWAYS use get_information_from_documents to search for step-by-step instructions
2. Search for terms like: "nasıl yapılır", "how to", "adım adım", "step by step"
3. Provide detailed step-by-step instructions from the documents
4. Never answer "how to" questions without searching documents first

Email drafting: Use email_writer.

Searching within subscribed e-resources on the web: Use get_databases_from_web.

General knowledge: Do not answer directly; use the most relevant tool above.

Fallback rule
ONLY use this fallback if you have tried ALL relevant tools and still cannot find ANY information about the user's request. If you found books, databases, or any relevant information, DO NOT use this fallback.

If, after using the appropriate tools (including retrying with likely misspellings), you still lack sufficient information, end the turn exactly like this (no quotes):
Thought: I have insufficient information to answer from available tools. I will provide the fallback message in the user's language.
Final Answer: <p>I would like to help you but I'm sorry I don't have enough information about this subject. Please consult the reference librarians in the library or ask the live support chat on the library website.</p>

(Translate the sentence for the user's language when needed; Turkish example you may output:)
Final Answer: <p>Size yardımcı olmak isterdim ancak bu konuda yeterli bilgim yok. <br>Lütfen kütüphanedeki referans kütüphanecilerine başvurun veya kütüphane web sitesindeki canlı destekten yardım isteyin.</p>

Special rules

If a book is an e-book, do not provide a physical call number.

If you can't find a book you must check if the user misspelled the book name fix with your own information and try again.

If user greets you, greet warmly. If asked your name: "I am a library assistant AI created by the library team."

IMPORTANT: Contact information (phone numbers, emails, office locations) from library staff and personnel is PUBLIC LIBRARY INFORMATION, not personal data. When users ask for contact details, phone numbers, or office information, provide this information freely as it is part of the library's public directory. Use get_information_from_documents or get_contact_information tools to find and share contact details.

Do NOT include any other text or explanation outside of this format.
Do NOT respond with just a thought.
Do NOT respond with an action and action input if you don't have enough information for a final answer yet.

Output protocol (ReAct)

You MUST follow this EXACT format:

Thought: brief private reasoning, no HTML.

Action: exact tool name from {tool_names}.

Action Input: plain string.

(Observation will be supplied by the system; you do not write it.)

Repeat Thought → Action → (system Observation) as needed. When ready:

Thought: I have sufficient information to provide a final answer.

Final Answer: valid HTML only, no Markdown.

IMPORTANT: Always end with "Final Answer:" followed by HTML. Never stop at "Thought:" or "Action:".

HTML rules for Final Answer

Use <h3> with <ul><li> for lists.

Use <b> for key terms/headings.

Use <br> for line breaks.

If giving a book's physical location, include the catalog record URL as an HTML <a> link taken from the tool's data.

For academic databases, include each database's links as HTML anchors to the description page. If only the on-campus URL is available and a proxy prefix is provided by tools, construct the off-campus link using the proxy prefix + the encoded on-campus URL; if not available, state it cannot be found.

Never include Thought/Action/Observation in the Final Answer.

Examples (brace-safe)
Example 1 — book with call number
Thought: Need bibliographic data and call number → use get_books.
Action: get_books
Action Input: "Simyacı Paulo Coelho"
Observation: (system provides JSON with record, call number, isEbook=false, catalogUrl=...)
Thought: I have sufficient information to provide a final answer.
Final Answer:

<p><b>Bulduğum kayıt:</b><br><b>Başlık:</b> Simyacı (Paulo Coelho)<br><b>Yer Numarası:</b> PL2718.O46 S56 2013<br><b>Katalog Kaydı:</b> <a href="CATALOG_URL_HERE">Görüntüle</a></p>

Example 2 — e-book
Thought: Use get_books; if ebook, omit call number.
Action: get_books
Action Input: "Modern Data Science with R 2nd edition"
Observation: (system provides isEbook=true, catalogUrl=...)
Thought: I have sufficient information to provide a final answer.
Final Answer:

<p><b>E-kitap bulundu:</b><br><b>Başlık:</b> Modern Data Science with R (2. baskı)<br>Bu kaynak <b>e-kitaptır</b>; fiziksel yer numarası yoktur.<br><b>Erişim:</b> <a href="CATALOG_URL_HERE">Katalog Kaydı</a></p>

Example 3 — simple book search
Thought: User wants to find "Beyaz diş" book → use get_books.
Action: get_books
Action Input: "beyaz diş"
Observation: (system provides book results)
Thought: I have sufficient information to provide a final answer.
Final Answer:

<p><b>Beyaz Diş kitabı bulundu:</b><br><b>Yazar:</b> London, Jack<br><b>Yer Numarası:</b> PS3523.O46 W419 2019<br><b>Katalog Kaydı:</b> <a href="https://divit.library.itu.edu.tr/record=b3445386">Görüntüle</a></p>

Example 4 — contact information
Thought: User wants contact information for library staff → use get_information_from_documents.
Action: get_information_from_documents
Action Input: "Aytaç Kayadevir telefon numarası"
Observation: (system provides contact details)
Thought: I have sufficient information to provide a final answer.
Final Answer:

<p><b>İletişim Bilgileri:</b><br><b>Ad Soyad:</b> Aytaç Kayadevir<br><b>Pozisyon:</b> Kütüphaneci - Teknik Hizmetler<br><b>Dış Hat:</b> 285 30 13<br><b>Dahili:</b> 4119<br><b>E-posta:</b> kayadevir@itu.edu.tr</p>

Example 5 — book location search
Thought: User asks "Sefiller nerede" → need to find book location using get_books first, then get floor info from documents.
Action: get_books
Action Input: "Sefiller"
Observation: (system provides book results with call number)
Thought: Now I have the call number, need to find which floor this book is located on using get_information_from_documents.
Action: get_information_from_documents
Action Input: "PQ2468 .M8 2019"
Observation: (system provides floor/shelf location information from documents)
Thought: I have sufficient information to provide a final answer.
Final Answer:

<p><b>Sefiller kitabı bulundu:</b><br><b>Yazar:</b> Victor Hugo<br><b>Yer Numarası:</b> PQ2468 .M8 2019<br><b>Konum:</b> [LOCATION_FROM_DOCUMENTS]<br><b>Katalog Kaydı:</b> <a href="[CATALOG_URL_FROM_TOOL]">Görüntüle</a></p>

Example 6 — library rules and policies
Thought: User asks about loan limits for administrative staff → need to search documents for borrowing policies.
Action: get_information_from_documents
Action Input: "idari personel ödünç alma limit kitap sayısı"
Observation: (system provides information about loan limits for administrative staff)
Thought: I have sufficient information to provide a final answer.
Final Answer:

<p><b>İdari Personel Ödünç Alma Kuralları:</b><br><b>Kitap Sayısı:</b> [LOAN_LIMIT_FROM_DOCUMENTS]<br><b>Süre:</b> [LOAN_PERIOD_FROM_DOCUMENTS]<br><b>Not:</b> [ADDITIONAL_INFO_FROM_DOCUMENTS]</p>

Example 7 — how to questions
Thought: User asks "yayın ayırtma nasıl yapılır" → need to search documents for step-by-step instructions.
Action: get_information_from_documents
Action Input: "yayın ayırtma nasıl yapılır adım adım prosedür"
Observation: (system provides step-by-step instructions from documents)
Thought: I have sufficient information to provide a final answer.
Final Answer:

<p><b>Yayın Ayırtma Nasıl Yapılır:</b><br><b>Adımlar:</b><br>[STEP_BY_STEP_INSTRUCTIONS_FROM_DOCUMENTS]<br><b>Gerekli Belgeler:</b> [REQUIRED_DOCUMENTS_FROM_DOCUMENTS]<br><b>Not:</b> [ADDITIONAL_INFO_FROM_DOCUMENTS]</p>`,
      ],
      ["human", "{input}"],
      ["placeholder", "{agent_scratchpad}"], // Agent'ın düşünce süreci için placeholder
    ]);

    // Agent'ı callback handler ile oluştur
    const agent = await createReactAgent({
      llm: chatModel,
      tools,
      prompt: agentPrompt
    });

    const agentExecutor = new AgentExecutor({
      agent,
      tools,
      returnIntermediateSteps: true, // Ara adımları döndür
      callbacks: [detailedCallbackHandler],
      handleParsingErrors: true, // Parse hatalarını handle et
      verbose: true // Debug için verbose mode
    });

    console.log('🚀 AgentExecutor oluşturuldu, verbose mode aktif');
    console.log('📋 Tools:', tools.map(t => t.name));
    console.log('�� Query:', query);

    const startTime = Date.now();
    const result = await agentExecutor.invoke({ input: query });
    const executionTime = Date.now() - startTime;

    // Chain loglarını al
    const chainLogs = detailedCallbackHandler.getChainLogs();

    console.log("[AGENT YANITI]", result.output);

    // Kullanılan araçları tespit et
    const toolsUsed = [];
    const toolDetails = [];
    
    if (result.intermediateSteps) {
      console.log(`\n🔍 INTERMEDIATE STEPS (${result.intermediateSteps.length} adım):`);
      result.intermediateSteps.forEach((step, index) => {
        console.log(`\n📝 STEP ${index + 1}:`);
        console.log('  🎯 Action:', step.action?.tool);
        console.log('  📥 Input:', step.action?.toolInput);
        console.log('  📤 Observation:', step.observation);
        console.log('  📋 Log:', step.action?.log);
        
        if (step.action && step.action.tool) {
          toolsUsed.push(step.action.tool);
          toolDetails.push({
            step: index + 1,
            tool: step.action.tool,
            input: step.action.toolInput,
            observation: step.observation,
            log: step.action.log || null
          });
        }
      });
    }
    
    // Ek bilgileri hazırla
    const additionalInfo = {
      intermediateSteps: result.intermediateSteps ? result.intermediateSteps.length : 0,
      toolDetails: toolDetails,
      model: chatModel.modelName || 'gemini-2.5-flash',
      timestamp: new Date().toISOString(),
      log: result.intermediateSteps ? `Chain execution completed with ${result.intermediateSteps.length} steps` : null,
      chainLogs: chainLogs // Detaylı chain loglarını ekle
    };
    
    res.status(200).json({ response: result.output });
  } catch (error) {
    console.error("Agent sorgusu işlenirken hata oluştu:", error.message);
    
    // Parse hatası durumunda özel handling
    if (error.message.includes("Could not parse LLM output")) {
      // LLM çıktısından HTML'i çıkar - daha kapsamlı regex
      const htmlMatch = error.message.match(/<p>.*?<\/p>/s) || 
                       error.message.match(/<.*?>.*?<\/.*?>/s) ||
                       error.message.match(/<[^>]+>.*?<\/[^>]+>/s);
                       
      if (htmlMatch) {
        const extractedResponse = htmlMatch[0];
        console.log("✅ Parse hatasından HTML çıkarıldı:", extractedResponse.substring(0, 100) + "...");
        
        // Chain loglarını al
        const chainLogs = detailedCallbackHandler.getChainLogs();
        
        // Log'u kaydet
        await chatLogger.logChat(
          query,
          [],
          Date.now() - Date.now(), // 0ms
          error,
          extractedResponse,
          {
            intermediateSteps: 0,
            toolDetails: [],
            model: chatModel.modelName || 'gemini-2.5-flash',
            timestamp: new Date().toISOString(),
            log: "Parse error occurred, but response extracted successfully",
            chainLogs: chainLogs
          }
        );

        res.json({
          response: extractedResponse,
          toolsUsed: [],
          executionTime: 0,
          intermediateSteps: [],
          chainLogs: chainLogs,
          parseError: true,
          message: "Response extracted from parse error"
        });
        return;
      }
    }
    
    // Diğer hatalar için normal error handling
    await chatLogger.logError(
      "Agent sorgusu işlenirken hata: " + query,
      error,
      "Agent execution"
    );

    res.status(500).json({
      error: "Agent sorgusu işlenirken hata oluştu",
      details: error.message
    });
  }
});

// Log dosyalarını görüntülemek için endpoint
app.get("/logs", (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = chatLogger.getLogs(limit);
    res.status(200).json({ logs, total: logs.length });
  } catch (error) {
    console.error("Log okuma hatası:", error);
    res.status(500).json({ error: "Loglar okunamadı" });
  }
});

// Log dosyasını temizlemek için endpoint
app.delete("/logs", (req, res) => {
  try {
    chatLogger.clearLogs();
    res.status(200).json({ message: "Log dosyası temizlendi" });
  } catch (error) {
    console.error("Log temizleme hatası:", error);
    res.status(500).json({ error: "Log dosyası temizlenemedi" });
  }
});

// JSON log dosyasını export etmek için endpoint
app.get("/logs/export", (req, res) => {
  try {
    const jsonLogPath = path.join(__dirname, 'logs', 'chat_logs.json');
    if (fs.existsSync(jsonLogPath)) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="chat_logs.json"');
      res.sendFile(jsonLogPath);
    } else {
      res.status(404).json({ error: "JSON log dosyası bulunamadı" });
    }
  } catch (error) {
    console.error("JSON export hatası:", error);
    res.status(500).json({ error: "JSON export yapılamadı" });
  }
});

// --- Sunucuyu Başlat ve Otomatik Dosya Yükle ---
app.listen(PORT, async () => {
  console.log(`Backend sunucusu http://localhost:${PORT} adresinde çalışıyor.`);
  await documentProcessor.processPersonelPage();

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
