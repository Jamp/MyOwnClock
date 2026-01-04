#!/bin/bash
#
# Own Clock - Script de desarrollo
# Ejecuta el backend y abre el frontend para desarrollo local
#

set -e

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo -e "${GREEN}Own Clock - Modo Desarrollo${NC}"
echo ""

# Verificar Python
if ! command -v python3 &> /dev/null; then
    echo "Python3 no encontrado. Por favor instálalo primero."
    exit 1
fi

# Crear entorno virtual si no existe
if [[ ! -d "$BACKEND_DIR/venv" ]]; then
    echo -e "${YELLOW}Creando entorno virtual...${NC}"
    python3 -m venv "$BACKEND_DIR/venv"
fi

# Activar entorno virtual e instalar dependencias
echo -e "${YELLOW}Instalando dependencias...${NC}"
source "$BACKEND_DIR/venv/bin/activate"
pip install -q -r "$BACKEND_DIR/requirements.txt"

# Iniciar el backend
echo ""
echo -e "${GREEN}Iniciando backend en http://localhost:8080${NC}"
echo -e "${GREEN}Frontend disponible en http://localhost:8080${NC}"
echo ""
echo "Presiona Ctrl+C para detener"
echo ""

cd "$BACKEND_DIR"
uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
