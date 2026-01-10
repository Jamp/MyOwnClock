"""
Own Clock Backend API
API para configuración y gestión del reloj de pared
"""

import os
import socket
import subprocess
from datetime import datetime, timedelta
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .models import ClockConfig, SystemInfo, HealthResponse
from .config_service import config_service

# Crear aplicación
app = FastAPI(
    title="Own Clock API",
    description="API para configurar el reloj de pared",
    version="1.0.0"
)

# Configurar CORS para desarrollo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ruta al frontend
FRONTEND_PATH = Path(__file__).parent.parent.parent / "frontend"


# ==================== API Endpoints ====================

@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Verifica el estado del servicio"""
    return HealthResponse(
        status="ok",
        version="1.0.0",
        timestamp=datetime.now().isoformat()
    )


@app.get("/api/config", response_model=ClockConfig)
async def get_config():
    """Obtiene la configuración actual"""
    return config_service.get_config()


@app.post("/api/config", response_model=ClockConfig)
async def save_config(config: ClockConfig):
    """Guarda la configuración"""
    success = config_service.save_config(config)
    if not success:
        raise HTTPException(status_code=500, detail="Error guardando configuración")
    return config


@app.patch("/api/config", response_model=ClockConfig)
async def update_config(updates: dict):
    """Actualiza campos específicos de la configuración"""
    return config_service.update_config(updates)


@app.post("/api/config/reset", response_model=ClockConfig)
async def reset_config():
    """Resetea la configuración a valores por defecto"""
    return config_service.reset_config()


@app.post("/api/refresh")
async def trigger_refresh():
    """
    Fuerza una actualización del reloj cambiando el timestamp de la config.
    El frontend detectará el cambio y refrescará automáticamente.
    """
    config = config_service.get_config()
    # Actualizar timestamp para forzar detección de cambio
    config_service.save_config(config)
    return {"status": "ok", "message": "Refresh triggered"}


@app.get("/api/system", response_model=SystemInfo)
async def get_system_info():
    """Obtiene información del sistema"""
    # Obtener hostname
    hostname = socket.gethostname()

    # Obtener zona horaria
    try:
        with open("/etc/timezone", "r") as f:
            timezone = f.read().strip()
    except:
        timezone = "Unknown"

    # Obtener uptime
    try:
        result = subprocess.run(["uptime", "-p"], capture_output=True, text=True)
        uptime = result.stdout.strip() if result.returncode == 0 else "Unknown"
    except:
        uptime = "Unknown"

    return SystemInfo(
        hostname=hostname,
        timezone=timezone,
        uptime=uptime,
        version="1.0.0"
    )


@app.get("/api/battery")
async def get_battery_info():
    """Obtiene información de la batería del sistema"""
    try:
        # Intentar leer desde /sys/class/power_supply/
        battery_path = Path("/sys/class/power_supply/BAT0")
        if not battery_path.exists():
            battery_path = Path("/sys/class/power_supply/BAT1")

        if battery_path.exists():
            # Leer capacidad
            capacity_file = battery_path / "capacity"
            capacity = int(capacity_file.read_text().strip()) if capacity_file.exists() else None

            # Leer estado (Charging, Discharging, Full, Not charging)
            status_file = battery_path / "status"
            status = status_file.read_text().strip() if status_file.exists() else "Unknown"

            return {
                "available": True,
                "percent": capacity,
                "status": status,
                "charging": status in ["Charging", "Full", "Not charging"]
            }

        # Fallback Linux: usar acpi command
        result = subprocess.run(["acpi", "-b"], capture_output=True, text=True)
        if result.returncode == 0 and result.stdout:
            # Parse: "Battery 0: Discharging, 85%, 02:30:00 remaining"
            output = result.stdout.strip()
            charging = "Charging" in output or "Full" in output
            # Extraer porcentaje
            import re
            match = re.search(r'(\d+)%', output)
            percent = int(match.group(1)) if match else None

            return {
                "available": True,
                "percent": percent,
                "status": "Charging" if charging else "Discharging",
                "charging": charging
            }

        # Fallback macOS: usar pmset
        result = subprocess.run(["pmset", "-g", "batt"], capture_output=True, text=True)
        if result.returncode == 0 and result.stdout:
            # Parse: "-InternalBattery-0 (id=...)	85%; charging; ..."
            output = result.stdout.strip()
            import re
            match = re.search(r'(\d+)%', output)
            percent = int(match.group(1)) if match else None
            charging = "AC Power" in output or "charging" in output.lower()

            if percent is not None:
                return {
                    "available": True,
                    "percent": percent,
                    "status": "Charging" if charging else "Discharging",
                    "charging": charging
                }

        return {"available": False, "percent": None, "status": "No battery", "charging": False}

    except Exception as e:
        return {"available": False, "percent": None, "status": str(e), "charging": False}


@app.post("/api/system/timezone")
async def set_timezone(timezone: str):
    """Establece la zona horaria del sistema (requiere permisos)"""
    try:
        # Verificar que la zona horaria existe
        tz_path = Path(f"/usr/share/zoneinfo/{timezone}")
        if not tz_path.exists():
            raise HTTPException(status_code=400, detail=f"Zona horaria inválida: {timezone}")

        # Intentar cambiar la zona horaria (requiere sudo)
        result = subprocess.run(
            ["sudo", "timedatectl", "set-timezone", timezone],
            capture_output=True,
            text=True
        )

        if result.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"Error cambiando zona horaria: {result.stderr}"
            )

        return {"status": "ok", "timezone": timezone}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Home Assistant Proxy ====================

@app.get("/api/weather")
async def get_weather():
    """Proxy para obtener datos del clima desde Home Assistant (evita CORS)"""
    config = config_service.get_config()

    if not config.ha_url or not config.ha_token:
        raise HTTPException(
            status_code=400,
            detail="Home Assistant no configurado"
        )

    try:
        headers = {
            "Authorization": f"Bearer {config.ha_token}",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient(verify=False, timeout=10.0) as client:
            # Obtener estado actual del clima
            state_url = f"{config.ha_url}/api/states/{config.weather_entity}"
            response = await client.get(state_url, headers=headers)

            if response.status_code == 401:
                raise HTTPException(status_code=401, detail="Token de Home Assistant inválido")

            if response.status_code == 404:
                raise HTTPException(status_code=404, detail=f"Entidad '{config.weather_entity}' no encontrada")

            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Error de Home Assistant: {response.text}"
                )

            weather_data = response.json()

            # Obtener forecast diario
            try:
                forecast_url = f"{config.ha_url}/api/services/weather/get_forecasts"
                forecast_response = await client.post(
                    forecast_url,
                    headers=headers,
                    json={
                        "entity_id": config.weather_entity,
                        "type": "daily"
                    }
                )

                if forecast_response.status_code == 200:
                    forecast_result = forecast_response.json()
                    print(f"Forecast response: {forecast_result}")  # Debug log
                    # El resultado viene en formato {entity_id: {forecast: [...]}}
                    entity_forecast = forecast_result.get(config.weather_entity, {})
                    forecast_list = entity_forecast.get("forecast", [])
                    # Agregar forecast a los atributos
                    if forecast_list:
                        weather_data.setdefault("attributes", {})["forecast"] = forecast_list
                else:
                    print(f"Forecast error: {forecast_response.status_code} - {forecast_response.text}")
            except Exception as e:
                print(f"Error obteniendo forecast: {e}")

        return weather_data

    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="No se puede conectar a Home Assistant")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Timeout conectando a Home Assistant")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/calendar")
async def get_calendar_events():
    """Proxy para obtener eventos de múltiples calendarios desde Home Assistant"""
    config = config_service.get_config()

    if not config.ha_url or not config.ha_token:
        raise HTTPException(
            status_code=400,
            detail="Home Assistant no configurado"
        )

    if not config.calendar_entities or len(config.calendar_entities) == 0:
        raise HTTPException(
            status_code=400,
            detail="Calendarios no configurados"
        )

    try:
        # Obtener eventos de hoy y los próximos 7 días
        now = datetime.now()
        start = now.strftime("%Y-%m-%dT00:00:00")
        end = (now + timedelta(days=7)).strftime("%Y-%m-%dT23:59:59")

        all_events = []

        async with httpx.AsyncClient(verify=False, timeout=10.0) as client:
            for calendar_entry in config.calendar_entities:
                if not calendar_entry:
                    continue

                # Parsear formato "entidad:nombre" o solo "entidad"
                if ":" in calendar_entry:
                    calendar_entity, calendar_name = calendar_entry.split(":", 1)
                    calendar_entity = calendar_entity.strip()
                    calendar_name = calendar_name.strip()
                else:
                    calendar_entity = calendar_entry.strip()
                    # Nombre por defecto: quitar "calendar." y formatear
                    calendar_name = calendar_entity.replace("calendar.", "").replace("_", " ").title()

                url = f"{config.ha_url}/api/calendars/{calendar_entity}"
                params = {"start": start, "end": end}

                try:
                    response = await client.get(
                        url,
                        params=params,
                        headers={
                            "Authorization": f"Bearer {config.ha_token}",
                            "Content-Type": "application/json"
                        }
                    )

                    if response.status_code == 200:
                        events = response.json()
                        for event in events:
                            event["calendar"] = calendar_name
                            event["calendar_entity"] = calendar_entity
                        all_events.extend(events)
                    else:
                        print(f"Error obteniendo calendario {calendar_entity}: {response.status_code}")

                except Exception as e:
                    print(f"Error con calendario {calendar_entity}: {e}")
                    continue

        # Ordenar todos los eventos por fecha de inicio
        all_events.sort(key=lambda x: x.get("start", {}).get("dateTime") or x.get("start", {}).get("date", ""))

        return all_events

    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="No se puede conectar a Home Assistant")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Timeout conectando a Home Assistant")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/calendars")
async def list_calendars():
    """Lista todos los calendarios disponibles en Home Assistant"""
    config = config_service.get_config()

    if not config.ha_url or not config.ha_token:
        raise HTTPException(
            status_code=400,
            detail="Home Assistant no configurado"
        )

    try:
        url = f"{config.ha_url}/api/calendars"

        async with httpx.AsyncClient(verify=False, timeout=10.0) as client:
            response = await client.get(
                url,
                headers={
                    "Authorization": f"Bearer {config.ha_token}",
                    "Content-Type": "application/json"
                }
            )

        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Error de Home Assistant: {response.text}"
            )

        return response.json()

    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="No se puede conectar a Home Assistant")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Frontend Serving ====================

# Servir archivos estáticos del frontend
if FRONTEND_PATH.exists():
    app.mount("/css", StaticFiles(directory=FRONTEND_PATH / "css"), name="css")
    app.mount("/js", StaticFiles(directory=FRONTEND_PATH / "js"), name="js")


@app.get("/")
async def serve_frontend():
    """Sirve el frontend"""
    index_path = FRONTEND_PATH / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    raise HTTPException(status_code=404, detail="Frontend no encontrado")


# Catch-all para SPA (si se necesita en el futuro)
@app.get("/{full_path:path}")
async def catch_all(full_path: str):
    """Redirige todas las rutas no encontradas al index"""
    # Verificar si es un archivo estático
    file_path = FRONTEND_PATH / full_path
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path)

    # Si no, servir index.html
    index_path = FRONTEND_PATH / "index.html"
    if index_path.exists():
        return FileResponse(index_path)

    raise HTTPException(status_code=404, detail="Recurso no encontrado")
