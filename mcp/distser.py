#!/usr/bin/env python3
"""
Kuş Uçumu Mesafe Hesaplama Web Server
FastAPI kullanarak REST API sağlar
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Literal
import math
import uvicorn


# Pydantic modelleri
class CoordinatePoint(BaseModel):
    lat: float = Field(..., ge=-90, le=90, description="Enlem (-90 ile 90 arası)")
    lon: float = Field(..., ge=-180, le=180, description="Boylam (-180 ile 180 arası)")
    name: Optional[str] = Field(None, description="Nokta adı (opsiyonel)")


class DistanceRequest(BaseModel):
    lat1: float = Field(..., ge=-90, le=90, description="İlk nokta enlem")
    lon1: float = Field(..., ge=-180, le=180, description="İlk nokta boylam")
    lat2: float = Field(..., ge=-90, le=90, description="İkinci nokta enlem")
    lon2: float = Field(..., ge=-180, le=180, description="İkinci nokta boylam")
    method: Literal["haversine", "vincenty"] = Field("haversine", description="Hesaplama yöntemi")
    unit: Literal["km", "miles", "nautical_miles"] = Field("km", description="Sonuç birimi")


class BatchDistanceRequest(BaseModel):
    reference_point: CoordinatePoint
    target_points: List[CoordinatePoint]
    method: Literal["haversine", "vincenty"] = Field("haversine", description="Hesaplama yöntemi")
    unit: Literal["km", "miles", "nautical_miles"] = Field("km", description="Sonuç birimi")


class DistanceResponse(BaseModel):
    distance: float
    unit: str
    method: str
    coordinates: dict


class BatchDistanceResponse(BaseModel):
    reference_point: dict
    distances: List[dict]
    unit: str
    method: str
    total_points: int


# Mesafe hesaplama fonksiyonları
def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Haversine formülü kullanarak iki koordinat arasındaki kuş uçumu mesafesini hesaplar.
    """
    R = 6371.0  # Dünya yarıçapı (kilometre)
    
    # Dereceleri radyana çevir
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    # Koordinat farkları
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    # Haversine formülü
    a = (math.sin(dlat / 2) ** 2 + 
         math.cos(lat1_rad) * math.cos(lat2_rad) * 
         math.sin(dlon / 2) ** 2)
    
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance = R * c
    
    return distance


def vincenty_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Vincenty formülü kullanarak daha hassas mesafe hesaplama.
    """
    # WGS-84 elipsoid parametreleri
    a = 6378137.0  # büyük eksen (metre)
    f = 1 / 298.257223563  # düzleşme
    b = (1 - f) * a  # küçük eksen
    
    # Dereceleri radyana çevir
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    lon_diff = math.radians(lon2 - lon1)
    
    # Yardımcı değişkenler
    U1 = math.atan((1 - f) * math.tan(lat1_rad))
    U2 = math.atan((1 - f) * math.tan(lat2_rad))
    
    sin_U1 = math.sin(U1)
    cos_U1 = math.cos(U1)
    sin_U2 = math.sin(U2)
    cos_U2 = math.cos(U2)
    
    lambda_val = lon_diff
    lambda_prev = 2 * math.pi
    
    # İteratif hesaplama
    iteration_limit = 100
    iteration = 0
    
    while abs(lambda_val - lambda_prev) > 1e-12 and iteration < iteration_limit:
        sin_lambda = math.sin(lambda_val)
        cos_lambda = math.cos(lambda_val)
        
        sin_sigma = math.sqrt(
            (cos_U2 * sin_lambda) ** 2 +
            (cos_U1 * sin_U2 - sin_U1 * cos_U2 * cos_lambda) ** 2
        )
        
        if sin_sigma == 0:
            return 0.0  # Aynı nokta
        
        cos_sigma = sin_U1 * sin_U2 + cos_U1 * cos_U2 * cos_lambda
        sigma = math.atan2(sin_sigma, cos_sigma)
        
        sin_alpha = cos_U1 * cos_U2 * sin_lambda / sin_sigma
        cos2_alpha = 1 - sin_alpha ** 2
        
        if cos2_alpha == 0:
            cos_2sigma_m = 0
        else:
            cos_2sigma_m = cos_sigma - 2 * sin_U1 * sin_U2 / cos2_alpha
        
        C = f / 16 * cos2_alpha * (4 + f * (4 - 3 * cos2_alpha))
        
        lambda_prev = lambda_val
        lambda_val = (lon_diff + (1 - C) * f * sin_alpha *
                     (sigma + C * sin_sigma *
                      (cos_2sigma_m + C * cos_sigma *
                       (-1 + 2 * cos_2sigma_m ** 2))))
        
        iteration += 1
    
    if iteration >= iteration_limit:
        # Yakınsama sağlanamazsa Haversine kullan
        return haversine_distance(lat1, lon1, lat2, lon2)
    
    u2 = cos2_alpha * (a ** 2 - b ** 2) / (b ** 2)
    A = 1 + u2 / 16384 * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)))
    B = u2 / 1024 * (256 + u2 * (-128 + u2 * (74 - 47 * u2)))
    
    delta_sigma = (B * sin_sigma *
                   (cos_2sigma_m + B / 4 *
                    (cos_sigma * (-1 + 2 * cos_2sigma_m ** 2) -
                     B / 6 * cos_2sigma_m * (-3 + 4 * sin_sigma ** 2) *
                     (-3 + 4 * cos_2sigma_m ** 2))))
    
    s = b * A * (sigma - delta_sigma)
    
    return s / 1000  # metreyi kilometreye çevir


def convert_unit(distance_km: float, unit: str) -> tuple[float, str]:
    """Mesafeyi istenen birime çevir"""
    if unit == "miles":
        return distance_km * 0.621371, "mil"
    elif unit == "nautical_miles":
        return distance_km * 0.539957, "deniz mili"
    else:  # km
        return distance_km, "km"


# FastAPI uygulaması
app = FastAPI(
    title="Kuş Uçumu Mesafe Hesaplama API",
    description="İki koordinat noktası arasındaki en kısa mesafeyi hesaplar",
    version="1.0.0"
)

# CORS middleware ekle
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", response_class=HTMLResponse)
async def root():
    """Ana sayfa - API dokümantasyonu"""
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Kuş Uçumu Mesafe Hesaplama API</title>
        <meta charset="utf-8">
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .endpoint { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }
            .method { font-weight: bold; color: #007bff; }
            code { background: #e9ecef; padding: 2px 4px; border-radius: 3px; }
        </style>
    </head>
    <body>
        <h1>🗺️ Kuş Uçumu Mesafe Hesaplama API</h1>
        <p>İki koordinat noktası arasındaki en kısa mesafeyi hesaplar.</p>
        
        <h2>📊 Endpoints</h2>
        
        <div class="endpoint">
            <div class="method">POST /distance</div>
            <p>İki nokta arasındaki mesafeyi hesaplar</p>
            <pre><code>{
  "lat1": 41.0082, "lon1": 28.9784,
  "lat2": 39.9334, "lon2": 32.8597,
  "method": "haversine", "unit": "km"
}</code></pre>
        </div>
        
        <div class="endpoint">
            <div class="method">POST /batch-distance</div>
            <p>Bir referans noktadan birden fazla noktaya mesafe hesaplar</p>
        </div>
        
        <div class="endpoint">
            <div class="method">GET /health</div>
            <p>API sağlık durumu kontrolü</p>
        </div>
        
        <h2>📖 Dokümantasyon</h2>
        <p><a href="/docs">Swagger UI</a> | <a href="/redoc">ReDoc</a></p>
        
        <h2>🌍 Örnek Koordinatlar</h2>
        <ul>
            <li><strong>İstanbul:</strong> 41.0082, 28.9784</li>
            <li><strong>Ankara:</strong> 39.9334, 32.8597</li>
            <li><strong>İzmir:</strong> 38.4192, 27.1287</li>
            <li><strong>Antalya:</strong> 36.8969, 30.7133</li>
        </ul>
    </body>
    </html>
    """
    return html_content


@app.get("/health")
async def health_check():
    """API sağlık durumu kontrolü"""
    return {"status": "healthy", "message": "Kuş uçumu mesafe hesaplama API çalışıyor"}


@app.post("/distance", response_model=DistanceResponse)
async def calculate_distance(request: DistanceRequest):
    """
    İki koordinat noktası arasındaki kuş uçumu mesafesini hesaplar
    
    - **lat1, lon1**: İlk nokta koordinatları
    - **lat2, lon2**: İkinci nokta koordinatları  
    - **method**: Hesaplama yöntemi (haversine/vincenty)
    - **unit**: Sonuç birimi (km/miles/nautical_miles)
    """
    try:
        # Mesafe hesapla
        if request.method == "vincenty":
            distance_km = vincenty_distance(request.lat1, request.lon1, request.lat2, request.lon2)
        else:
            distance_km = haversine_distance(request.lat1, request.lon1, request.lat2, request.lon2)
        
        # Birim dönüştür
        distance_converted, unit_name = convert_unit(distance_km, request.unit)
        
        return DistanceResponse(
            distance=round(distance_converted, 3),
            unit=unit_name,
            method=request.method,
            coordinates={
                "point1": {"lat": request.lat1, "lon": request.lon1},
                "point2": {"lat": request.lat2, "lon": request.lon2}
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Hesaplama hatası: {str(e)}")


@app.post("/batch-distance", response_model=BatchDistanceResponse)
async def batch_distance_calculation(request: BatchDistanceRequest):
    """
    Bir referans noktadan birden fazla noktaya mesafe hesaplar
    
    - **reference_point**: Referans koordinat noktası
    - **target_points**: Hedef koordinat noktaları listesi
    - **method**: Hesaplama yöntemi (haversine/vincenty)
    - **unit**: Sonuç birimi (km/miles/nautical_miles)
    """
    try:
        ref_lat = request.reference_point.lat
        ref_lon = request.reference_point.lon
        ref_name = request.reference_point.name or f"({ref_lat}, {ref_lon})"
        
        results = []
        
        for i, target in enumerate(request.target_points):
            target_lat = target.lat
            target_lon = target.lon
            target_name = target.name or f"Nokta {i+1}"
            
            # Mesafe hesapla
            if request.method == "vincenty":
                distance_km = vincenty_distance(ref_lat, ref_lon, target_lat, target_lon)
            else:
                distance_km = haversine_distance(ref_lat, ref_lon, target_lat, target_lon)
            
            # Birim dönüştür
            distance_converted, unit_name = convert_unit(distance_km, request.unit)
            
            results.append({
                "target_name": target_name,
                "distance": round(distance_converted, 3),
                "coordinates": {"lat": target_lat, "lon": target_lon}
            })
        
        # Mesafeye göre sırala
        results.sort(key=lambda x: x["distance"])
        
        return BatchDistanceResponse(
            reference_point={
                "name": ref_name,
                "coordinates": {"lat": ref_lat, "lon": ref_lon}
            },
            distances=results,
            unit=unit_name,
            method=request.method,
            total_points=len(results)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Toplu hesaplama hatası: {str(e)}")


@app.get("/distance")
async def calculate_distance_get(
    lat1: float,
    lon1: float, 
    lat2: float,
    lon2: float,
    method: Literal["haversine", "vincenty"] = "haversine",
    unit: Literal["km", "miles", "nautical_miles"] = "km"
):
    """
    GET isteği ile mesafe hesaplama (URL parametreleri)
    """
    request = DistanceRequest(
        lat1=lat1, lon1=lon1, lat2=lat2, lon2=lon2,
        method=method, unit=unit
    )
    return await calculate_distance(request)


if __name__ == "__main__":
    print("🚀 Kuş Uçumu Mesafe Hesaplama Web Server başlatılıyor...")
    print("📍 API Dokümantasyonu: http://localhost:8000")
    print("📊 Swagger UI: http://localhost:8000/docs")
    print("📖 ReDoc: http://localhost:8000/redoc")
    
    uvicorn.run(
        "distser:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )