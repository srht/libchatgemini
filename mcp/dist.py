#!/usr/bin/env python3
"""
Kuş Uçumu Mesafe Hesaplama MCP Server
İki koordinat noktası arasındaki en kısa mesafeyi hesaplar.
"""

import asyncio
import json
import math
from typing import Any, Sequence
from mcp.server.models import InitializationOptions
import mcp.types as types
from mcp.server import NotificationOptions, Server
from pydantic import AnyUrl
import mcp.server.stdio


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Haversine formülü kullanarak iki koordinat arasındaki kuş uçumu mesafesini hesaplar.
    
    Args:
        lat1, lon1: İlk nokta koordinatları (derece)
        lat2, lon2: İkinci nokta koordinatları (derece)
    
    Returns:
        Mesafe (kilometre)
    """
    # Dünya yarıçapı (kilometre)
    R = 6371.0
    
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
    
    # Mesafe hesaplama
    distance = R * c
    
    return distance


def vincenty_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Vincenty formülü kullanarak daha hassas mesafe hesaplama.
    
    Args:
        lat1, lon1: İlk nokta koordinatları (derece)
        lat2, lon2: İkinci nokta koordinatları (derece)
    
    Returns:
        Mesafe (kilometre)
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


# MCP Server
server = Server("distance-calculator")


@server.list_tools()
async def handle_list_tools() -> list[types.Tool]:
    """Mevcut tool'ları listele"""
    return [
        types.Tool(
            name="calculate_distance",
            description="İki koordinat noktası arasındaki kuş uçumu mesafesini hesaplar",
            inputSchema={
                "type": "object",
                "properties": {
                    "lat1": {
                        "type": "number",
                        "description": "İlk nokta enlem (-90 ile 90 arası)"
                    },
                    "lon1": {
                        "type": "number", 
                        "description": "İlk nokta boylam (-180 ile 180 arası)"
                    },
                    "lat2": {
                        "type": "number",
                        "description": "İkinci nokta enlem (-90 ile 90 arası)"
                    },
                    "lon2": {
                        "type": "number",
                        "description": "İkinci nokta boylam (-180 ile 180 arası)"
                    },
                    "method": {
                        "type": "string",
                        "description": "Hesaplama yöntemi: 'haversine' (hızlı) veya 'vincenty' (hassas)",
                        "enum": ["haversine", "vincenty"],
                        "default": "haversine"
                    },
                    "unit": {
                        "type": "string",
                        "description": "Sonuç birimi",
                        "enum": ["km", "miles", "nautical_miles"],
                        "default": "km"
                    }
                },
                "required": ["lat1", "lon1", "lat2", "lon2"]
            }
        ),
        types.Tool(
            name="batch_distance_calculation",
            description="Bir referans noktadan birden fazla noktaya mesafe hesaplar",
            inputSchema={
                "type": "object",
                "properties": {
                    "reference_point": {
                        "type": "object",
                        "properties": {
                            "lat": {"type": "number"},
                            "lon": {"type": "number"},
                            "name": {"type": "string", "description": "Nokta adı (opsiyonel)"}
                        },
                        "required": ["lat", "lon"]
                    },
                    "target_points": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "lat": {"type": "number"},
                                "lon": {"type": "number"},
                                "name": {"type": "string", "description": "Nokta adı (opsiyonel)"}
                            },
                            "required": ["lat", "lon"]
                        }
                    },
                    "method": {
                        "type": "string",
                        "enum": ["haversine", "vincenty"],
                        "default": "haversine"
                    },
                    "unit": {
                        "type": "string",
                        "enum": ["km", "miles", "nautical_miles"],
                        "default": "km"
                    }
                },
                "required": ["reference_point", "target_points"]
            }
        )
    ]


@server.call_tool()
async def handle_call_tool(name: str, arguments: dict | None) -> list[types.TextContent]:
    """Tool çağrılarını işle"""
    
    def convert_unit(distance_km: float, unit: str) -> tuple[float, str]:
        """Mesafeyi istenen birime çevir"""
        if unit == "miles":
            return distance_km * 0.621371, "mil"
        elif unit == "nautical_miles":
            return distance_km * 0.539957, "deniz mili"
        else:  # km
            return distance_km, "km"
    
    if name == "calculate_distance":
        if not arguments:
            raise ValueError("Koordinat parametreleri gerekli")
        
        # Parametreleri al
        lat1 = arguments.get("lat1")
        lon1 = arguments.get("lon1")
        lat2 = arguments.get("lat2")
        lon2 = arguments.get("lon2")
        method = arguments.get("method", "haversine")
        unit = arguments.get("unit", "km")
        
        # Koordinat doğrulama
        if not all(isinstance(x, (int, float)) for x in [lat1, lon1, lat2, lon2]):
            raise ValueError("Tüm koordinatlar sayısal değer olmalı")
        
        if not (-90 <= lat1 <= 90 and -90 <= lat2 <= 90):
            raise ValueError("Enlem değerleri -90 ile 90 arasında olmalı")
        
        if not (-180 <= lon1 <= 180 and -180 <= lon2 <= 180):
            raise ValueError("Boylam değerleri -180 ile 180 arasında olmalı")
        
        # Mesafe hesapla
        if method == "vincenty":
            distance_km = vincenty_distance(lat1, lon1, lat2, lon2)
        else:
            distance_km = haversine_distance(lat1, lon1, lat2, lon2)
        
        # Birim dönüştür
        distance_converted, unit_name = convert_unit(distance_km, unit)
        
        result = {
            "distance": round(distance_converted, 3),
            "unit": unit_name,
            "method": method,
            "coordinates": {
                "point1": {"lat": lat1, "lon": lon1},
                "point2": {"lat": lat2, "lon": lon2}
            }
        }
        
        return [types.TextContent(
            type="text",
            text=json.dumps(result, ensure_ascii=False, indent=2)
        )]
    
    elif name == "batch_distance_calculation":
        if not arguments:
            raise ValueError("Parametreler gerekli")
        
        reference_point = arguments.get("reference_point")
        target_points = arguments.get("target_points", [])
        method = arguments.get("method", "haversine")
        unit = arguments.get("unit", "km")
        
        if not reference_point or not target_points:
            raise ValueError("Referans nokta ve hedef noktalar gerekli")
        
        ref_lat = reference_point["lat"]
        ref_lon = reference_point["lon"]
        ref_name = reference_point.get("name", f"({ref_lat}, {ref_lon})")
        
        results = []
        
        for i, target in enumerate(target_points):
            target_lat = target["lat"]
            target_lon = target["lon"]
            target_name = target.get("name", f"Nokta {i+1}")
            
            # Mesafe hesapla
            if method == "vincenty":
                distance_km = vincenty_distance(ref_lat, ref_lon, target_lat, target_lon)
            else:
                distance_km = haversine_distance(ref_lat, ref_lon, target_lat, target_lon)
            
            # Birim dönüştür
            distance_converted, unit_name = convert_unit(distance_km, unit)
            
            results.append({
                "target_name": target_name,
                "distance": round(distance_converted, 3),
                "coordinates": {"lat": target_lat, "lon": target_lon}
            })
        
        # Mesafeye göre sırala
        results.sort(key=lambda x: x["distance"])
        
        batch_result = {
            "reference_point": {
                "name": ref_name,
                "coordinates": {"lat": ref_lat, "lon": ref_lon}
            },
            "distances": results,
            "unit": unit_name,
            "method": method,
            "total_points": len(results)
        }
        
        return [types.TextContent(
            type="text",
            text=json.dumps(batch_result, ensure_ascii=False, indent=2)
        )]
    
    else:
        raise ValueError(f"Bilinmeyen tool: {name}")


async def main():
    # Stdin/stdout üzerinden MCP server çalıştır
    async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="distance-calculator",
                server_version="1.0.0",
                capabilities=server.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={}
                )
            )
        )


if __name__ == "__main__":
    asyncio.run(main())