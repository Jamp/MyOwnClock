# Own Clock

Convierte un laptop viejo en un elegante reloj de pared con pronóstico del clima integrado desde Home Assistant.

## Características

- Reloj digital grande y legible
- Fecha completa en español
- Pronóstico del clima desde Home Assistant
- Interfaz oscura optimizada para visualización continua
- Modo kiosko con Chromium
- Backend ligero para configuración
- Sistema base minimalista (Openbox)

## Requisitos

### Hardware
- Laptop con pantalla funcional
- Conexión WiFi o Ethernet
- Mínimo 1GB RAM, 4GB almacenamiento

### Software
- Distribución Linux basada en Debian/Ubuntu (recomendado: Debian minimal o Ubuntu Server)
- Home Assistant accesible en la red local

## Instalación Rápida

```bash
# Clonar el repositorio
git clone <repo-url> /tmp/own_clock
cd /tmp/own_clock

# Ejecutar instalación
sudo ./system/install.sh

# Reiniciar
sudo reboot
```

## Desarrollo Local

```bash
# Clonar el repositorio
git clone <repo-url>
cd own_clock

# Ejecutar en modo desarrollo
./dev.sh
```

Abre http://localhost:8080 en tu navegador.

## Estructura del Proyecto

```
own_clock/
├── frontend/           # Interfaz web
│   ├── index.html
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── app.js      # Aplicación principal
│       ├── clock.js    # Módulo del reloj
│       ├── config.js   # Gestión de configuración
│       └── weather.js  # Integración Home Assistant
├── backend/            # API de configuración
│   ├── app/
│   │   ├── main.py     # FastAPI app
│   │   ├── models.py   # Modelos Pydantic
│   │   └── config_service.py
│   └── requirements.txt
├── system/             # Scripts de sistema
│   ├── install.sh      # Instalador principal
│   ├── openbox/        # Configuración Openbox
│   │   ├── autostart
│   │   └── rc.xml
│   └── systemd/
├── dev.sh              # Script de desarrollo
└── README.md
```

## Configuración

### Atajos de Teclado

| Tecla | Acción |
|-------|--------|
| `C` | Abrir panel de configuración |
| `F` | Alternar pantalla completa |
| `R` | Refrescar datos del clima |
| `Escape` | Cerrar panel de configuración |
| Doble clic | Abrir configuración |

### Home Assistant

1. Genera un **Token de acceso de larga duración** en Home Assistant:
   - Perfil de usuario → Tokens de acceso de larga duración → Crear token

2. Configura el reloj:
   - Presiona `C` o haz doble clic
   - Ingresa la URL de tu Home Assistant (ej: `http://192.168.1.100:8123`)
   - Pega el token
   - Especifica la entidad del clima (ej: `weather.home`)

### API Endpoints

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/health` | GET | Estado del servicio |
| `/api/config` | GET | Obtener configuración |
| `/api/config` | POST | Guardar configuración |
| `/api/config` | PATCH | Actualizar campos específicos |
| `/api/config/reset` | POST | Resetear a valores por defecto |
| `/api/system` | GET | Información del sistema |

## Personalización

### Cambiar tema visual

Edita `frontend/css/styles.css`:

```css
body {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
}
```

### Agregar más zonas horarias

Edita `frontend/index.html` y agrega opciones al select:

```html
<option value="Europe/London">Londres</option>
```

## Solución de Problemas

### El clima no carga
- Verifica que Home Assistant sea accesible desde el laptop
- Confirma que el token tiene permisos para leer entidades
- Revisa la consola del navegador (F12) para errores

### La pantalla se apaga
- El instalador desactiva DPMS, pero puedes verificar con: `xset q`
- Ejecuta manualmente: `xset s off && xset -dpms`

### El backend no inicia
```bash
sudo systemctl status own-clock
sudo journalctl -u own-clock -f
```

## Roadmap

- [ ] Integración con Google Calendar
- [ ] Notificaciones de Home Assistant
- [ ] Múltiples temas visuales
- [ ] Soporte para múltiples idiomas
- [ ] Widget de noticias/RSS

## Licencia

MIT
