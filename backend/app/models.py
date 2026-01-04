"""
Modelos de datos para Own Clock
"""

from pydantic import BaseModel, Field
from typing import Optional, List


class ClockConfig(BaseModel):
    """Configuración del reloj"""
    ha_url: str = Field(default="", alias="haUrl")
    ha_token: str = Field(default="", alias="haToken")
    weather_entity: str = Field(default="weather.openweathermap", alias="weatherEntity")
    calendar_entities: List[str] = Field(default=[], alias="calendarEntities")
    timezone: str = Field(default="America/Lima")
    update_interval: int = Field(default=60000, alias="updateInterval")
    clock_format: str = Field(default="24h", alias="clockFormat")
    last_update: Optional[str] = Field(default=None, alias="lastUpdate")

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "haUrl": "http://homeassistant.local:8123",
                "haToken": "your_long_lived_token",
                "weatherEntity": "weather.openweathermap",
                "calendarEntities": ["calendar.personal", "calendar.trabajo", "calendar.fechas"],
                "timezone": "America/Lima",
                "updateInterval": 60000,
                "clockFormat": "24h",
                "lastUpdate": "2024-01-01T00:00:00"
            }
        }


class SystemInfo(BaseModel):
    """Información del sistema"""
    hostname: str
    timezone: str
    uptime: str
    version: str = "1.0.0"


class HealthResponse(BaseModel):
    """Respuesta del health check"""
    status: str
    version: str
    timestamp: str
