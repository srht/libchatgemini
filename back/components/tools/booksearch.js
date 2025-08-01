const { DynamicTool } = require("langchain/tools");
const fetch = require("node-fetch");

console.log("Trying DynamicTool approach...");

let getSearchTool;

try {
  getSearchTool = new DynamicTool({
    name: "get_books",
    description:
      "Kütüphane kataloğundaki yayınları bulur. Input should be a keyword string. 'Mesela denemeler kitabı var mı?' sorusu için 'denemeler' kelimesini kullan.",
    func: async (input) => {
      console.log(
        `[TOOL ÇAĞRISI] getInformationFromDocumentsTool çağrıldı, sorgu: ${input.query}`
      );
      const rawInput = input.toLocaleLowerCase("tr-TR");
      const encodedInput = encodeURIComponent(rawInput);
      const url = `https://service.library.itu.edu.tr/web/api/llm/search?keyword=${encodedInput}`;
      const headers = {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json, text/plain, */*",
        Referer: "https://library.itu.edu.tr/",
        Origin: "https://library.itu.edu.tr",
        Host: "service.library.itu.edu.tr",
        "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
        "X-Requested-With": "XMLHttpRequest",
        // Gerekirse Cookie ekle: "Cookie": "..."
      };
      console.log(`[FETCH İSTEĞİ] ${url} adresine istek gönderiliyor...`);
      console.log(`[FETCH REQUEST HEADERS]`, headers);
      try {
        const response = await fetch(url, {
          method: "GET",
          headers,
        });
        const data = await response.json();
        console.log(`[FETCH YANITI] Status: ${response.status}`);
        console.log(`[FETCH YANITI] Headers:`, response.headers.raw());
        console.log(`[FETCH YANITI] Data:`, JSON.stringify(data, null, 2));
        return JSON.stringify(data);
      } catch (error) {
        console.log(`[FETCH HATASI]`, error);
        return `Hata: kitap arama aracında beklenmeyen bir hata oluştu: ${error.message}`;
      }
    },
  });

  console.log("DynamicTool created successfully!");
  console.log("Tool name:", getSearchTool.name);
  console.log("Tool description:", getSearchTool.description);
} catch (error) {
  console.error("Error creating DynamicTool:", error);
  // Hata durumunda basit bir tool oluştur
  getSearchTool = {
    name: "get_books",
    description:
      "Kütüphane kataloğundaki yayınları bulur. Input should be a keyword string.",
    func: async (input) => {
      return "Kitap arama aracı şu anda kullanılamıyor.";
    },
  };
}

module.exports = { getSearchTool };
