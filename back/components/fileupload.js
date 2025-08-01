/**
 * POST /upload-document
 * Yüklenen bir belgeyi işler, parçalara ayırır ve embeddinglerini oluşturur.
 */
/*app.post("/upload-document", upload.single("document"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Dosya bulunamadı." });
  }

  const filePath = req.file.path;
  const mimeType = req.file.mimetype;
  console.log(`Dosya yüklendi: ${filePath}, Tip: ${mimeType}`);

  try {
    const text = await extractTextFromFile(filePath, mimeType);
    if (!text || text.trim().length === 0) {
      fs.unlinkSync(filePath);
      return res
        .status(400)
        .json({ message: "Dosya içeriği boş veya desteklenmiyor." });
    }

    await indexDocumentText(text); // LangChain kullanarak indeksle

    fs.unlinkSync(filePath); // Geçici dosyayı sil

    res
      .status(200)
      .json({ message: "Belge başarıyla yüklendi ve indekslendi." });

  } catch (error) {
    console.error("Belge işlenirken hata oluştu:", error);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.status(500).json({
      message: "Belge işlenirken sunucu hatası oluştu.",
      error: error.message,
    });
  }
});
*/
