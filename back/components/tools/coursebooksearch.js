const { DynamicTool } = require("langchain/tools");
const { getPublications } = require("../functions/getCourseBooks");

console.log("Trying DynamicTool approach...");

let getCourseBookSearchTool;

try {
  getCourseBookSearchTool = new DynamicTool({
    name: "get_course_books",
    description:
      "Kütüphane kataloğundaki ders kitaplarını  bulur. Input should be a keyword string. Mesela 'GID 411E ders materyalleri var mı?' sorusu için 'GID 411E' kelimesini kullan.",
    func: async (input) => {
      try {
        console.log(
          `[TOOL ÇAĞRISI] getInformationFromDocumentsTool çağrıldı, sorgu: ${input}`
        );
        const books = await getPublications(input);
        //console.log(`[FETCH REQUEST HEADERS]`, headers);
        return books;
      } catch (error) {
        console.log(`[FETCH HATASI]`, error);
        return `Hata: kitap arama aracında beklenmeyen bir hata oluştu: ${error.message}`;
      }
    },
  });

  console.log("DynamicTool created successfully!");
  console.log("Tool name:", getSearchTool.name);
  console.log("Tool description:", getSearchTool.description);
} catch (error) {}

module.exports = { getCourseBookSearchTool };
