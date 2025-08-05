const { DynamicTool } = require("langchain/tools");
const createEmailWriterTool = (chatModel) => {
  return new DynamicTool({
    name: "email_writer",
    description:
      "Belirtilen konuda profesyonel email yazar. Format: 'email [konu] [stil: resmi/samimi/satış]'",
    func: async (input) => {
      try {
        // Email yazımı için specialized LLM

        const prompt = `Sen deneyimli bir iş yazışmaları uzmanısın. 

INPUT: "${input}"

Eğer format "email [konu] [stil]" şeklindeyse:
1. Konuya uygun email yaz
2. Belirtilen stile göre ton ayarla:
   - resmi: Profesyonel, mesafeli
   - samimi: Dostça, yakın
   - satış: İkna edici, pazarlama odaklı

Email şu bölümleri içermeli:
- Konu başlığı
- Selamlama
- Ana içerik (3-4 paragraf)
- Sonuç/eylem çağrısı
- İmza

Türkçe yaz ve iş dünyası standartlarına uygun ol.`;

        const response = await chatModel.invoke(prompt);
        return `📧 Email Taslağı:\n${response.content}`;
      } catch (error) {
        return "Email yazımı sırasında hata oluştu.";
      }
    },
  });
};

module.exports = { createEmailWriterTool };
