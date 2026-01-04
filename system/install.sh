#!/bin/bash
#
# Own Clock - Script de instalación
# Convierte un laptop viejo en un reloj de pared
#

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variables
INSTALL_DIR="/opt/own_clock"
USER_NAME="${SUDO_USER:-$USER}"
SERVICE_NAME="own-clock"

# Funciones de utilidad
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar que se ejecuta como root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "Este script debe ejecutarse como root (sudo)"
        exit 1
    fi
}

# Instalar dependencias del sistema
install_system_deps() {
    log_info "Instalando dependencias del sistema..."

    apt-get update
    apt-get install -y \
        xorg \
        openbox \
        chromium \
        python3 \
        python3-pip \
        python3-venv \
        build-essential \
        unclutter \
        x11-xserver-utils \
        pulseaudio \
        plymouth \
        plymouth-themes \
        imagemagick \
        acpi \
        --no-install-recommends
}

# Copiar archivos del proyecto
copy_files() {
    log_info "Copiando archivos del proyecto..."

    mkdir -p "$INSTALL_DIR"

    # Copiar frontend y backend
    cp -r frontend "$INSTALL_DIR/"
    cp -r backend "$INSTALL_DIR/"
    cp -r system "$INSTALL_DIR/"

    chown -R "$USER_NAME:$USER_NAME" "$INSTALL_DIR"
}

# Crear entorno virtual e instalar dependencias Python
setup_python() {
    log_info "Configurando entorno Python..."

    cd "$INSTALL_DIR/backend"

    # Crear entorno virtual
    python3 -m venv venv
    source venv/bin/activate

    # Instalar dependencias
    pip install --upgrade pip
    pip install -r requirements.txt

    deactivate
    chown -R "$USER_NAME:$USER_NAME" "$INSTALL_DIR/backend/venv"
}

# Configurar Openbox
setup_openbox() {
    log_info "Configurando Openbox..."

    # Directorio de configuración de Openbox
    OPENBOX_CONFIG_DIR="/home/$USER_NAME/.config/openbox"
    mkdir -p "$OPENBOX_CONFIG_DIR"

    # Copiar configuración de autostart
    cp "$INSTALL_DIR/system/openbox/autostart" "$OPENBOX_CONFIG_DIR/autostart"
    chmod +x "$OPENBOX_CONFIG_DIR/autostart"

    # Copiar configuración de rc.xml si existe
    if [[ -f "$INSTALL_DIR/system/openbox/rc.xml" ]]; then
        cp "$INSTALL_DIR/system/openbox/rc.xml" "$OPENBOX_CONFIG_DIR/rc.xml"
    fi

    chown -R "$USER_NAME:$USER_NAME" "$OPENBOX_CONFIG_DIR"
}

# Configurar autologin
setup_autologin() {
    log_info "Configurando autologin..."

    # Crear directorio para override de getty
    mkdir -p /etc/systemd/system/getty@tty1.service.d/

    cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf << EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $USER_NAME --noclear %I \$TERM
EOF

    systemctl daemon-reload
}

# Configurar inicio automático de X
setup_auto_startx() {
    log_info "Configurando inicio automático de X..."

    # Agregar startx al .bash_profile
    BASH_PROFILE="/home/$USER_NAME/.bash_profile"

    if ! grep -q "startx" "$BASH_PROFILE" 2>/dev/null; then
        cat >> "$BASH_PROFILE" << 'EOF'

# Auto start X en tty1
if [[ -z $DISPLAY ]] && [[ $(tty) = /dev/tty1 ]]; then
    exec startx
fi
EOF
    fi

    # Crear .xinitrc para iniciar Openbox
    XINITRC="/home/$USER_NAME/.xinitrc"
    cat > "$XINITRC" << 'EOF'
#!/bin/bash
exec openbox-session
EOF

    chmod +x "$XINITRC"
    chown "$USER_NAME:$USER_NAME" "$BASH_PROFILE" "$XINITRC"
}

# Crear servicio systemd para el backend
setup_systemd_service() {
    log_info "Creando servicio systemd..."

    cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=Own Clock Backend Service
After=network.target

[Service]
Type=simple
User=$USER_NAME
WorkingDirectory=$INSTALL_DIR/backend
Environment="PATH=$INSTALL_DIR/backend/venv/bin"
ExecStart=$INSTALL_DIR/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8080
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable ${SERVICE_NAME}
    systemctl start ${SERVICE_NAME}
}

# Configurar opciones de energía
setup_power_management() {
    log_info "Configurando gestión de energía..."

    # Desactivar suspensión y hibernación
    systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target

    # Configurar DPMS (apagar pantalla) - desactivado para reloj
    # Se puede reactivar editando el autostart de Openbox
}

# Configurar Plymouth (splash screen de arranque)
setup_plymouth() {
    log_info "Configurando Plymouth (splash screen)..."

    PLYMOUTH_THEME_DIR="/usr/share/plymouth/themes/own-clock"

    # Crear directorio del tema
    mkdir -p "$PLYMOUTH_THEME_DIR"

    # Convertir SVG a PNG
    if command -v convert &> /dev/null; then
        convert -background none "$INSTALL_DIR/system/plymouth/logo.svg" \
            -resize 200x200 "$PLYMOUTH_THEME_DIR/logo.png"
        convert -background none "$INSTALL_DIR/system/plymouth/progress.svg" \
            -resize 300x6 "$PLYMOUTH_THEME_DIR/progress.png"
    else
        log_warn "ImageMagick no disponible, usando imágenes por defecto"
        # Crear imágenes placeholder simples con base64
        cp "$INSTALL_DIR/system/plymouth/logo.svg" "$PLYMOUTH_THEME_DIR/" 2>/dev/null || true
    fi

    # Copiar archivos del tema
    cp "$INSTALL_DIR/system/plymouth/own-clock.plymouth" "$PLYMOUTH_THEME_DIR/"
    cp "$INSTALL_DIR/system/plymouth/own-clock.script" "$PLYMOUTH_THEME_DIR/"

    # Instalar el tema
    update-alternatives --install /usr/share/plymouth/themes/default.plymouth default.plymouth \
        "$PLYMOUTH_THEME_DIR/own-clock.plymouth" 100

    # Establecer como tema por defecto
    plymouth-set-default-theme own-clock

    # Configurar GRUB para splash silencioso
    if [[ -f /etc/default/grub ]]; then
        # Backup
        cp /etc/default/grub /etc/default/grub.backup

        # Agregar quiet splash si no existe
        if ! grep -q "quiet splash" /etc/default/grub; then
            sed -i 's/GRUB_CMDLINE_LINUX_DEFAULT="\([^"]*\)"/GRUB_CMDLINE_LINUX_DEFAULT="\1 quiet splash"/' /etc/default/grub
        fi

        # Actualizar GRUB
        update-grub 2>/dev/null || grub-mkconfig -o /boot/grub/grub.cfg 2>/dev/null || true
    fi

    # Regenerar initramfs
    update-initramfs -u 2>/dev/null || true

    log_info "Plymouth configurado correctamente"
}

# Mostrar resumen de instalación
show_summary() {
    log_info "============================================"
    log_info "Instalación completada!"
    log_info "============================================"
    echo ""
    echo "El sistema ha sido configurado como reloj de pared."
    echo ""
    echo "Características instaladas:"
    echo "  - Splash screen personalizado (Plymouth)"
    echo "  - Autologin y auto-inicio de X"
    echo "  - Chromium en modo kiosko"
    echo "  - Backend API en puerto 8080"
    echo ""
    echo "Accesos:"
    echo "  - Frontend: http://localhost:8080"
    echo "  - API: http://localhost:8080/api"
    echo "  - Swagger: http://localhost:8080/docs"
    echo ""
    echo "Atajos de teclado:"
    echo "  - C: Abrir configuración"
    echo "  - F: Pantalla completa"
    echo "  - R: Refrescar clima"
    echo "  - Escape: Cerrar configuración"
    echo ""
    echo "Reinicia el sistema para aplicar todos los cambios:"
    echo "  sudo reboot"
    echo ""
}

# Main
main() {
    log_info "============================================"
    log_info "Own Clock - Instalación"
    log_info "============================================"

    check_root
    install_system_deps
    copy_files
    setup_python
    setup_openbox
    setup_autologin
    setup_auto_startx
    setup_systemd_service
    setup_power_management
    setup_plymouth
    show_summary
}

main "$@"
