# Own Clock

Convierte un laptop viejo en un elegante reloj de pared con pronóstico del clima y eventos de calendario integrados desde Home Assistant.

## Características

- Reloj digital grande y legible con fecha
- Pronóstico del clima desde Home Assistant (OpenWeatherMap)
- Eventos de Google Calendar via Home Assistant
- Indicador de bateria (para laptops)
- Interfaz oscura optimizada para visualización continua
- Splash screen personalizado (Plymouth)
- Modo kiosko con Chromium
- Backend API para configuración remota
- Sistema base minimalista (Debian + Openbox)

## Requisitos

### Hardware
- Laptop con pantalla funcional
- Conexión WiFi o Ethernet
- Mínimo 1GB RAM, 8GB almacenamiento

### Software
- Debian 13 (Trixie) netinst recomendado
- Home Assistant accesible en la red local
- Integración OpenWeatherMap en Home Assistant (para clima)
- Integración Google Calendar en Home Assistant (para eventos)

## Instalación

### 1. Instalar Debian minimal

Descarga [Debian netinst](https://www.debian.org/CD/netinst/) y realiza una instalación mínima:
- Solo instala "SSH server" y "standard system utilities"
- No instales entorno de escritorio

### 2. Clonar y ejecutar instalador

```bash
# Conectar via SSH al laptop
ssh root@<ip-del-laptop>

# Instalar git
apt-get update && apt-get install -y git

# Clonar el repositorio
git clone <repo-url> /tmp/own_clock
cd /tmp/own_clock

# Ejecutar instalación
bash system/install.sh

# Reiniciar
reboot
```

### 3. Configurar

Accede desde cualquier dispositivo en la red:
```
http://<ip-del-laptop>:8080
```

Presiona `C` o haz doble clic para abrir la configuración.

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
├── frontend/               # Interfaz web
│   ├── index.html
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── app.js          # Aplicación principal
│       ├── clock.js        # Módulo del reloj
│       ├── config.js       # Gestión de configuración
│       ├── weather.js      # Integración clima
│       ├── calendar.js     # Integración calendario
│       └── battery.js      # Indicador de batería
├── backend/                # API FastAPI
│   ├── app/
│   │   ├── main.py         # Endpoints API
│   │   ├── models.py       # Modelos Pydantic
│   │   └── config_service.py
│   └── requirements.txt
├── system/                 # Scripts de sistema
│   ├── install.sh          # Instalador principal
│   ├── openbox/            # Configuración Openbox
│   │   └── autostart
│   └── plymouth/           # Splash screen
│       ├── logo.svg
│       ├── own-clock.plymouth
│       └── own-clock.script
├── dev.sh                  # Script de desarrollo
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

1. **Genera un Token de acceso**:
   - Home Assistant → Perfil → Tokens de acceso de larga duración → Crear token

2. **Configura el reloj**:
   - Presiona `C` o haz doble clic
   - Ingresa la URL de tu Home Assistant (ej: `http://192.168.1.100:8123`)
   - Pega el token
   - Especifica la entidad del clima (ej: `weather.openweathermap`)
   - Haz clic en "Cargar calendarios" para seleccionar tus calendarios
   - Guarda

### Configuración Remota

Puedes configurar el reloj desde cualquier dispositivo en la misma red. **El reloj detecta automáticamente los cambios cada 10 segundos y se actualiza sin necesidad de reiniciar.**

```bash
# Ver configuración actual
curl http://<ip-del-laptop>:8080/api/config

# Guardar configuración (el reloj se actualizará automáticamente)
curl -X POST http://<ip-del-laptop>:8080/api/config \
  -H "Content-Type: application/json" \
  -d '{
    "haUrl": "http://homeassistant.local:8123",
    "haToken": "tu-token-aqui",
    "weatherEntity": "weather.openweathermap",
    "calendarEntities": ["calendar.personal:Personal", "calendar.trabajo:Trabajo"],
    "timezone": "America/Lima"
  }'

# Forzar actualización inmediata (refresca clima y calendario)
curl -X POST http://<ip-del-laptop>:8080/api/refresh
```

### API Endpoints

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/health` | GET | Estado del servicio |
| `/api/config` | GET | Obtener configuración |
| `/api/config` | POST | Guardar configuración |
| `/api/config` | PATCH | Actualizar campos específicos |
| `/api/config/reset` | POST | Resetear a valores por defecto |
| `/api/system` | GET | Información del sistema |
| `/api/weather` | GET | Datos del clima (proxy a HA) |
| `/api/calendar` | GET | Eventos del calendario (proxy a HA) |
| `/api/calendars` | GET | Lista de calendarios disponibles |
| `/api/battery` | GET | Estado de la batería |
| `/api/refresh` | POST | Forzar actualización del reloj |
| `/docs` | GET | Documentación Swagger UI |

## Personalización

### Cambiar tema visual

Edita `frontend/css/styles.css`:

```css
body {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
}
```

### Agregar zonas horarias

Edita `frontend/index.html` y agrega opciones al select:

```html
<option value="Europe/London">Londres</option>
```

### Cambiar puerto del backend

Edita `/etc/systemd/system/own-clock.service`:

```ini
ExecStart=/opt/own_clock/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8080
```

## Solución de Problemas

### El clima no carga
- Verifica que Home Assistant sea accesible desde el laptop
- Confirma que el token tiene permisos para leer entidades
- Revisa que la entidad del clima exista: `weather.openweathermap`

### Los calendarios no cargan
- Verifica que tengas la integración de Google Calendar en Home Assistant
- Los calendarios deben ser entidades tipo `calendar.*`

### La pantalla se apaga
- El instalador desactiva DPMS, pero puedes verificar con: `xset q`
- Ejecuta manualmente: `xset s off && xset -dpms`

### El backend no inicia
```bash
systemctl status own-clock
journalctl -u own-clock -f
```

### WiFi RTL8723BU no detectado
Si tu laptop tiene chip WiFi Realtek RTL8723BU, necesitas compilar el driver:

```bash
apt-get install -y build-essential git linux-headers-$(uname -r)
git clone https://github.com/lwfinger/rtl8723bu.git
cd rtl8723bu
make
sudo make install
sudo modprobe 8723bu
```

### Error de compilación pydantic-core
El script ya incluye `--only-binary pydantic-core` para evitar compilación. Si falla:

```bash
pip install --only-binary :all: pydantic
```

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                        Laptop                                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │  Chromium   │───▶│  FastAPI    │───▶│ Home Assistant  │  │
│  │  (Kiosk)    │    │  Backend    │    │    (Remoto)     │  │
│  │  :8080      │    │  :8080      │    │    :8123        │  │
│  └─────────────┘    └─────────────┘    └─────────────────┘  │
│        │                  │                                  │
│        ▼                  ▼                                  │
│  ┌─────────────┐    ┌─────────────┐                         │
│  │  Frontend   │    │   Config    │                         │
│  │  HTML/CSS/JS│    │   JSON      │                         │
│  └─────────────┘    └─────────────┘                         │
│                                                              │
│  Sistema: Debian 13 + Openbox + Plymouth                    │
└─────────────────────────────────────────────────────────────┘
```

## Licencia

MIT
