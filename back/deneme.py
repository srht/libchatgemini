import os
from openai import OpenAI
from sentence_transformers import SentenceTransformer
from pypdf import PdfReader
import numpy as np
import faiss
from rank_bm25 import BM25Okapi
# API Anahtarınızı ve dosya yolunu buraya girin
# Not: API anahtarınızı doğrudan koda yazmak yerine Colab Secrets
kullanmanız daha güvenlidir.
QWEN_API_KEY = &quot;sk-...............&quot; # Kendi Qwen API anahtarınızı girin
QWEN_BASE_URL = &quot;https://dashscope-intl.aliyuncs.com/compatible-
mode/v1&quot; # Qwen API endpoint&#39;i
pdf_path = &quot;/content/drive/MyDrive/İtü/YZ/kilavuz1.pdf&quot;
source_document_name = os.path.basename(pdf_path)

from langchain.text_splitter import RecursiveCharacterTextSplitter
from google.colab import drive
import torch
from transformers import BitsAndBytesConfig # 8-bit konfigürasyonu için
import ediyoruz
print(&quot;Kütüphaneler başarıyla yüklendi ve import edildi.&quot;)
# Google Drive&#39;ı bağlama
try:
drive.mount(&#39;/content/drive&#39;)
print(&quot;Google Drive başarıyla bağlandı.&quot;)
except Exception as e:
print(f&quot;Google Drive bağlanırken bir hata oluştu: {e}&quot;)
# --- API ve Dosya Yapılandırması ---
# Lütfen buraya kendi Qwen API anahtarınızı girin.
# Güvenlik için Colab Secrets kullanmanız önerilir.
QWEN_API_KEY = &quot;sk-1828fb72fd1d4ae9bb8d9aa9a86ad093&quot; # KENDİ
ANAHTARINIZI GİRİN
QWEN_BASE_URL = &quot;https://dashscope-intl.aliyuncs.com/compatible-
mode/v1&quot;
# Üzerinde çalışılacak PDF dosyasının yolu
pdf_path = &quot;/content/drive/MyDrive/İtü/YZ/kilavuz1.pdf&quot;
if not os.path.exists(pdf_path):
raise FileNotFoundError(f&quot;Belirtilen dosya bulunamadı: {pdf_path}.
Lütfen Google Drive&#39;daki yolu kontrol edin.&quot;)
# Qwen LLM&#39;i için istemci (client) oluşturma
client = OpenAI(api_key=QWEN_API_KEY, base_url=QWEN_BASE_URL)
source_document_name = os.path.basename(pdf_path)
print(&quot;\nKurulum ve yapılandırma tamamlandı.&quot;)
print(f&quot;Kaynak Belge: &#39;{source_document_name}&#39;&quot;)
print(f&quot;Kullanılacak Cihaz (GPU mevcutsa): { &#39;cuda&#39; if
torch.cuda.is_available() else &#39;cpu&#39; }&quot;)