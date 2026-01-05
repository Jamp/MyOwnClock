/**
 * Aplicación principal
 * Coordina todos los módulos e inicializa la aplicación
 */

const App = {
    configModal: null,
    configForm: null,
    availableCalendars: [],
    selectedCalendars: {},

    /**
     * Inicializa la aplicación
     */
    async init() {
        console.log('Iniciando Own Clock...');

        // Inicializar Lucide Icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        // Referencias DOM
        this.configModal = document.getElementById('config-modal');
        this.configForm = document.getElementById('config-form');

        // Cargar configuración
        await this.loadConfig();

        // Inicializar módulos
        await Clock.init();
        await Weather.init();
        await Calendar.init();
        await Battery.init();

        // Event listeners
        this.setupEventListeners();

        // Iniciar monitoreo de cambios remotos de configuración
        this.setupRemoteConfigWatch();

        console.log('Own Clock iniciado correctamente');
    },

    /**
     * Configura el monitoreo de cambios remotos de configuración
     */
    setupRemoteConfigWatch() {
        // Registrar callback para cuando la config cambie remotamente
        Config.onChange(async (newConfig) => {
            console.log('Aplicando configuración remota...');

            // Actualizar calendarios en memoria
            this.selectedCalendars = {};
            const calendars = newConfig.calendarEntities || [];
            calendars.forEach(entry => {
                if (entry.includes(':')) {
                    const [entity, name] = entry.split(':', 2);
                    this.selectedCalendars[entity.trim()] = name.trim();
                } else {
                    this.selectedCalendars[entry.trim()] = '';
                }
            });

            // Actualizar módulos
            if (Clock && newConfig.timezone) {
                Clock.timezone = newConfig.timezone;
                Clock.update();
            }

            if (Weather) {
                await Weather.refresh();
            }

            if (Calendar) {
                await Calendar.refresh();
            }

            if (Battery) {
                Battery.setEnabled(newConfig.showBattery !== false);
            }

            console.log('Configuración remota aplicada');
        });

        // Iniciar watcher (cada 10 segundos)
        Config.startWatching(10000);
    },

    /**
     * Carga la configuración en el formulario
     */
    async loadConfig() {
        const config = await Config.get();

        document.getElementById('ha-url').value = config.haUrl || '';
        document.getElementById('ha-token').value = config.haToken || '';
        document.getElementById('weather-entity').value = config.weatherEntity || 'weather.openweathermap';
        document.getElementById('timezone').value = config.timezone || 'America/Lima';
        document.getElementById('show-battery').checked = config.showBattery !== false;

        // Cargar calendarios seleccionados en memoria
        this.selectedCalendars = {};
        const calendars = config.calendarEntities || [];
        calendars.forEach(entry => {
            if (entry.includes(':')) {
                const [entity, name] = entry.split(':', 2);
                this.selectedCalendars[entity.trim()] = name.trim();
            } else {
                this.selectedCalendars[entry.trim()] = '';
            }
        });
    },

    /**
     * Configura los event listeners
     */
    setupEventListeners() {
        // Abrir configuración con doble clic o tecla 'c'
        document.addEventListener('dblclick', () => this.openConfig());
        document.addEventListener('keydown', (e) => {
            if (e.key === 'c' || e.key === 'C') {
                this.openConfig();
            }
            if (e.key === 'Escape') {
                this.closeConfig();
            }
            if (e.key === 'r' || e.key === 'R') {
                Weather.refresh();
            }
            if (e.key === 'f' || e.key === 'F') {
                this.toggleFullscreen();
            }
        });

        // Cerrar configuración
        document.getElementById('close-config').addEventListener('click', () => {
            this.closeConfig();
        });

        // Guardar configuración
        this.configForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveConfig();
        });

        // Cerrar modal al hacer clic fuera
        this.configModal.addEventListener('click', (e) => {
            if (e.target === this.configModal) {
                this.closeConfig();
            }
        });

        // Cargar calendarios
        document.getElementById('load-calendars').addEventListener('click', () => {
            this.loadCalendars();
        });
    },

    /**
     * Abre el modal de configuración
     */
    openConfig() {
        this.configModal.classList.remove('hidden');
        document.body.style.cursor = 'default';
        this.renderCalendarList();

        // Re-renderizar iconos de Lucide
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    /**
     * Cierra el modal de configuración
     */
    closeConfig() {
        this.configModal.classList.add('hidden');
        document.body.style.cursor = 'none';
    },

    /**
     * Carga los calendarios disponibles desde Home Assistant
     */
    async loadCalendars() {
        const btn = document.getElementById('load-calendars');
        const listEl = document.getElementById('calendar-list');

        // Validar que hay configuración de HA
        const haUrl = document.getElementById('ha-url').value.trim();
        const haToken = document.getElementById('ha-token').value.trim();

        if (!haUrl || !haToken) {
            listEl.innerHTML = '<div class="calendar-loading">Ingresa URL y Token de Home Assistant primero</div>';
            return;
        }

        // Mostrar loading
        btn.classList.add('loading');
        listEl.innerHTML = '<div class="calendar-loading">Cargando calendarios...</div>';

        try {
            const response = await fetch(`${Config.backendUrl}/api/calendars`);

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            this.availableCalendars = await response.json();
            this.renderCalendarList();

        } catch (error) {
            console.error('Error cargando calendarios:', error);
            listEl.innerHTML = `<div class="calendar-loading">Error: ${error.message}</div>`;
        } finally {
            btn.classList.remove('loading');

            // Re-renderizar iconos de Lucide
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    },

    /**
     * Renderiza la lista de calendarios
     */
    renderCalendarList() {
        const listEl = document.getElementById('calendar-list');

        if (this.availableCalendars.length === 0) {
            // Mostrar calendarios ya seleccionados si no hay lista cargada
            const selectedKeys = Object.keys(this.selectedCalendars);
            if (selectedKeys.length > 0) {
                listEl.innerHTML = selectedKeys.map(entity => {
                    const customName = this.selectedCalendars[entity] || '';
                    const displayName = entity.replace('calendar.', '').replace(/_/g, ' ');
                    return `
                        <div class="calendar-item">
                            <input type="checkbox"
                                   id="cal-${entity}"
                                   data-entity="${entity}"
                                   checked>
                            <div class="calendar-item-info">
                                <div class="calendar-item-name">${displayName}</div>
                                <div class="calendar-item-entity">${entity}</div>
                            </div>
                            <input type="text"
                                   placeholder="Nombre"
                                   data-entity="${entity}"
                                   value="${customName}">
                        </div>
                    `;
                }).join('');
            } else {
                listEl.innerHTML = '<div class="calendar-loading">Haz clic en "Cargar calendarios"</div>';
            }
            return;
        }

        listEl.innerHTML = this.availableCalendars.map(cal => {
            const entity = cal.entity_id;
            const isSelected = entity in this.selectedCalendars;
            const customName = this.selectedCalendars[entity] || '';
            const displayName = cal.name || entity.replace('calendar.', '').replace(/_/g, ' ');

            return `
                <div class="calendar-item">
                    <input type="checkbox"
                           id="cal-${entity}"
                           data-entity="${entity}"
                           ${isSelected ? 'checked' : ''}>
                    <div class="calendar-item-info">
                        <div class="calendar-item-name">${displayName}</div>
                        <div class="calendar-item-entity">${entity}</div>
                    </div>
                    <input type="text"
                           placeholder="Nombre personalizado"
                           data-entity="${entity}"
                           value="${customName}">
                </div>
            `;
        }).join('');
    },

    /**
     * Obtiene los calendarios seleccionados del formulario
     */
    getSelectedCalendars() {
        const listEl = document.getElementById('calendar-list');
        const checkboxes = listEl.querySelectorAll('input[type="checkbox"]');
        const result = [];

        checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                const entity = checkbox.dataset.entity;
                const nameInput = listEl.querySelector(`input[type="text"][data-entity="${entity}"]`);
                const customName = nameInput ? nameInput.value.trim() : '';

                if (customName) {
                    result.push(`${entity}:${customName}`);
                } else {
                    result.push(entity);
                }
            }
        });

        return result;
    },

    /**
     * Guarda la configuración
     */
    async saveConfig() {
        const calendarEntities = this.getSelectedCalendars();

        const config = {
            haUrl: document.getElementById('ha-url').value.trim(),
            haToken: document.getElementById('ha-token').value.trim(),
            weatherEntity: document.getElementById('weather-entity').value.trim(),
            calendarEntities: calendarEntities,
            timezone: document.getElementById('timezone').value,
            showBattery: document.getElementById('show-battery').checked
        };

        const success = await Config.save(config);

        if (success) {
            // Actualizar calendarios seleccionados en memoria
            this.selectedCalendars = {};
            calendarEntities.forEach(entry => {
                if (entry.includes(':')) {
                    const [entity, name] = entry.split(':', 2);
                    this.selectedCalendars[entity.trim()] = name.trim();
                } else {
                    this.selectedCalendars[entry.trim()] = '';
                }
            });

            // Actualizar módulos con nueva configuración
            Clock.timezone = config.timezone;
            Clock.update();

            await Weather.refresh();
            await Calendar.refresh();
            Battery.setEnabled(config.showBattery);

            this.closeConfig();
            console.log('Configuración guardada correctamente');
        } else {
            alert('Error al guardar la configuración');
        }
    },

    /**
     * Alterna pantalla completa
     */
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.warn('Error al entrar en pantalla completa:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }
};

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Exportar para uso global
window.App = App;
