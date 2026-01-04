#!/bin/bash
#
# Own Clock - Script de actualización
# Actualiza el reloj con los últimos cambios del repositorio
#

set -e

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

INSTALL_DIR="/opt/own_clock"
SERVICE_NAME="own-clock"
USER_NAME="clock"

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Verificar root
if [[ $EUID -ne 0 ]]; then
    log_error "Ejecuta como root: sudo bash update.sh"
    exit 1
fi

cd "$INSTALL_DIR"

log_info "============================================"
log_info "Own Clock - Actualización"
log_info "============================================"

# 1. Actualizar desde git
if [[ -d ".git" ]]; then
    log_info "Descargando cambios de git..."
    git fetch origin
    git reset --hard origin/master
    log_info "Código actualizado"
else
    log_warn "No es un repositorio git. Configurando..."
    if [[ -n "$1" ]]; then
        REPO_URL="$1"
        git init
        git remote add origin "$REPO_URL"
        git fetch origin
        git reset --hard origin/master
        log_info "Repositorio configurado"
    else
        log_error "Proporciona URL del repo: sudo bash update.sh <repo-url>"
        log_error "Ejemplo: sudo bash update.sh https://github.com/usuario/own_clock.git"
        exit 1
    fi
fi

# 2. Actualizar dependencias Python si requirements.txt cambió
log_info "Verificando dependencias Python..."
cd "$INSTALL_DIR/backend"
source venv/bin/activate
pip install --quiet --only-binary pydantic-core -r requirements.txt
deactivate

# 3. Arreglar permisos
log_info "Arreglando permisos..."
chown -R "$USER_NAME:$USER_NAME" "$INSTALL_DIR"

# 4. Reiniciar backend
log_info "Reiniciando backend..."
systemctl restart "$SERVICE_NAME"

# 5. Refrescar frontend (reiniciar sesión del usuario clock)
log_info "Refrescando frontend..."
pkill -u "$USER_NAME" 2>/dev/null || true

# Esperar a que getty reinicie la sesión
sleep 2

log_info "============================================"
log_info "Actualización completada!"
log_info "============================================"
echo ""
echo "El reloj se reiniciará automáticamente en unos segundos."
echo ""
