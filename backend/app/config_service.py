"""
Servicio de configuración
Maneja la persistencia de la configuración en archivo JSON
"""

import json
import os
from pathlib import Path
from typing import Optional

from .models import ClockConfig


class ConfigService:
    """Servicio para gestionar la configuración del reloj"""

    def __init__(self, config_path: Optional[str] = None):
        if config_path:
            self.config_path = Path(config_path)
        else:
            # Por defecto, guardar en el directorio home del usuario
            self.config_path = Path.home() / ".own_clock" / "config.json"

        # Crear directorio si no existe
        self.config_path.parent.mkdir(parents=True, exist_ok=True)

    def get_config(self) -> ClockConfig:
        """Obtiene la configuración actual"""
        if not self.config_path.exists():
            return ClockConfig()

        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return ClockConfig(**data)
        except (json.JSONDecodeError, Exception) as e:
            print(f"Error leyendo configuración: {e}")
            return ClockConfig()

    def save_config(self, config: ClockConfig) -> bool:
        """Guarda la configuración"""
        try:
            # Usar by_alias para mantener camelCase en el JSON
            data = config.model_dump(by_alias=True)

            with open(self.config_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

            return True
        except Exception as e:
            print(f"Error guardando configuración: {e}")
            return False

    def update_config(self, updates: dict) -> ClockConfig:
        """Actualiza campos específicos de la configuración"""
        current = self.get_config()
        current_dict = current.model_dump(by_alias=True)
        current_dict.update(updates)

        new_config = ClockConfig(**current_dict)
        self.save_config(new_config)

        return new_config

    def reset_config(self) -> ClockConfig:
        """Resetea la configuración a valores por defecto"""
        default_config = ClockConfig()
        self.save_config(default_config)
        return default_config


# Instancia global del servicio
config_service = ConfigService()
