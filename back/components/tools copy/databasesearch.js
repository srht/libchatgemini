const { DynamicTool } = require("langchain/tools");
const fetch = require("node-fetch");

let getDatabaseSearchTool;

try {
  getDatabaseSearchTool = new DynamicTool({
    name: "get_library_databases",
    description: `Kütüphanenin abone olduğu veritabanlarını bulur konu başlıklarına göre filtreler. Input should be a keyword string. 'Mesela mühendislik veritabanları var mı?' sorusu için 'mühendislik' kelimesini kullanır. Sonuç olarak bulunan tüm veritabanlarını isimlerini, açıklamalarını ve kampüs içi ve  kampüs dışı erişim linklerini döndürür. `,
    func: async (input) => {
      console.log(input);
      console.log(
        `[TOOL ÇAĞRISI] get_library_databases çağrıldı, sorgu: ${input}`
      );

      const rawInput = input.toLocaleLowerCase("tr-TR");
      const encodedInput = encodeURIComponent(rawInput);
      const subjectsResponse = await fetch(
        "https://service.library.itu.edu.tr/web/api/Veritabanlari/Filtreler?turid=1"
      );
      const subjectsData = await subjectsResponse.json();
      console.log(
        `[SUBJECT BULUNDU] ${subjectsData} filtre bulundu:`,
        subjectsData
      );
      const foundFilters = subjectsData.filter(
        (i) => i.Adi.toLocaleLowerCase("tr-TR").indexOf(encodedInput) > -1
      );
      console.log(
        `[FİLTRE BULUNDU] ${foundFilters.length} filtre bulundu:`,
        foundFilters
      );

      const filterIdStrings = foundFilters.map((i) => i.Id).join(",");
      const databasesResponse = await fetch(
        `https://service.library.itu.edu.tr/web/api/Veritabanlari/FilterByMultiple?filters=,${filterIdStrings}&page=1`
      );
      const databasesData = await databasesResponse.json();
      const databases = databasesData.Liste.map((db) => {
        return {
          name: db.Adi,
          link: `https://kutuphane.itu.edu.tr/arastirma/veritabanlari#${db.Id}`,
        };
      });
      return JSON.stringify(databases);
    },
  });

  console.log("DynamicTool created successfully!");
  console.log("Tool name:", getDatabasesTool.name);
  console.log("Tool description:", getDatabasesTool.description);
} catch (error) {
  console.error("Error creating DynamicTool:", error);
  // Hata durumunda basit bir tool oluştur
}

module.exports = { getDatabaseSearchTool };
