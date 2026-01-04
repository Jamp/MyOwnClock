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
USER_NAME="clock"
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

# Crear usuario clock si no existe
create_user() {
    log_info "Verificando usuario $USER_NAME..."

    if id "$USER_NAME" &>/dev/null; then
        log_info "Usuario $USER_NAME ya existe"
    else
        log_info "Creando usuario $USER_NAME..."
        # Crear grupo si no existe
        getent group "$USER_NAME" &>/dev/null || /usr/sbin/groupadd "$USER_NAME"
        # Crear usuario
        /usr/sbin/useradd -m -g "$USER_NAME" -s /bin/bash "$USER_NAME"
        log_info "Usuario $USER_NAME creado"
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
        librsvg2-bin \
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

    # Instalar dependencias (usar wheels pre-compilados para pydantic-core)
    pip install --upgrade pip wheel
    pip install --only-binary pydantic-core -r requirements.txt

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

    # Eliminar cualquier configuración anterior
    rm -f /etc/systemd/system/getty@tty1.service.d/*.conf

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

    # Crear .bash_profile
    BASH_PROFILE="/home/$USER_NAME/.bash_profile"
    cat > "$BASH_PROFILE" << 'EOF'
# Auto start X en tty1
if [[ -z $DISPLAY ]] && [[ $(tty) = /dev/tty1 ]]; then
    exec startx
fi
EOF

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

    # Convertir SVG a PNG usando rsvg-convert (más confiable que ImageMagick)
    if command -v rsvg-convert &> /dev/null; then
        rsvg-convert -w 200 -h 200 "$INSTALL_DIR/system/plymouth/logo.svg" \
            -o "$PLYMOUTH_THEME_DIR/logo.png" 2>/dev/null || true
        rsvg-convert -w 300 -h 6 "$INSTALL_DIR/system/plymouth/progress.svg" \
            -o "$PLYMOUTH_THEME_DIR/progress.png" 2>/dev/null || true
    fi

    # Si no se pudo convertir, crear un logo simple con ImageMagick
    if [[ ! -f "$PLYMOUTH_THEME_DIR/logo.png" ]]; then
        log_warn "Creando logo de Plymouth alternativo..."
        convert -size 200x200 xc:'#1a1a2e' \
            -fill '#64c8ff' -draw "circle 100,100 100,20" \
            -fill '#1a1a2e' -draw "circle 100,100 100,35" \
            -stroke white -strokewidth 4 \
            -draw "line 100,100 100,50" \
            -draw "line 100,100 140,100" \
            "$PLYMOUTH_THEME_DIR/logo.png" 2>/dev/null || true
    fi

    # Copiar archivos del tema
    cp "$INSTALL_DIR/system/plymouth/own-clock.plymouth" "$PLYMOUTH_THEME_DIR/" 2>/dev/null || true
    cp "$INSTALL_DIR/system/plymouth/own-clock.script" "$PLYMOUTH_THEME_DIR/" 2>/dev/null || true

    # Si no existen los archivos de tema, crearlos
    if [[ ! -f "$PLYMOUTH_THEME_DIR/own-clock.plymouth" ]]; then
        cat > "$PLYMOUTH_THEME_DIR/own-clock.plymouth" << 'EOF'
[Plymouth Theme]
Name=Own Clock
Description=Splash screen para Own Clock
ModuleName=script

[script]
ImageDir=/usr/share/plymouth/themes/own-clock
ScriptFile=/usr/share/plymouth/themes/own-clock/own-clock.script
EOF
    fi

    if [[ ! -f "$PLYMOUTH_THEME_DIR/own-clock.script" ]]; then
        cat > "$PLYMOUTH_THEME_DIR/own-clock.script" << 'EOF'
# Own Clock Plymouth Script
Window.SetBackgroundTopColor(0.10, 0.10, 0.18);
Window.SetBackgroundBottomColor(0.06, 0.08, 0.14);

logo.image = Image("logo.png");
logo.sprite = Sprite(logo.image);
logo.sprite.SetX(Window.GetWidth() / 2 - logo.image.GetWidth() / 2);
logo.sprite.SetY(Window.GetHeight() / 2 - logo.image.GetHeight() / 2);
logo.sprite.SetOpacity(1);
EOF
    fi

    # Instalar el tema
    update-alternatives --install /usr/share/plymouth/themes/default.plymouth default.plymouth \
        "$PLYMOUTH_THEME_DIR/own-clock.plymouth" 100 2>/dev/null || true

    # Establecer como tema por defecto
    plymouth-set-default-theme own-clock 2>/dev/null || true

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
    echo "Usuario creado: $USER_NAME"
    echo ""
    echo "Características instaladas:"
    echo "  - Splash screen personalizado (Plymouth)"
    echo "  - Autologin con usuario '$USER_NAME'"
    echo "  - Auto-inicio de X con Openbox"
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
    create_user
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
