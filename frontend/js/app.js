/**
 * Aplicación principal
 * Coordina todos los módulos e inicializa la aplicación
 */

const App = {
    configModal: null,
    configForm: null,

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

        // Event listeners
        this.setupEventListeners();

        console.log('Own Clock iniciado correctamente');
    },

    /**
     * Carga la configuración en el formulario
     */
    async loadConfig() {
        const config = await Config.get();

        document.getElementById('ha-url').value = config.haUrl || '';
        document.getElementById('ha-token').value = config.haToken || '';
        document.getElementById('weather-entity').value = config.weatherEntity || 'weather.openweathermap';

        // Calendarios: convertir array a texto (uno por línea)
        const calendars = config.calendarEntities || [];
        document.getElementById('calendar-entities').value = calendars.join('\n');

        document.getElementById('timezone').value = config.timezone || 'America/Lima';
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
    },

    /**
     * Abre el modal de configuración
     */
    openConfig() {
        this.configModal.classList.remove('hidden');
        document.body.style.cursor = 'default';
    },

    /**
     * Cierra el modal de configuración
     */
    closeConfig() {
        this.configModal.classList.add('hidden');
        document.body.style.cursor = 'none';
    },

    /**
     * Guarda la configuración
     */
    async saveConfig() {
        // Procesar calendarios: texto a array (uno por línea)
        const calendarsText = document.getElementById('calendar-entities').value;
        const calendarEntities = calendarsText
            .split('\n')
            .map(c => c.trim())
            .filter(c => c.length > 0);

        const config = {
            haUrl: document.getElementById('ha-url').value.trim(),
            haToken: document.getElementById('ha-token').value.trim(),
            weatherEntity: document.getElementById('weather-entity').value.trim(),
            calendarEntities: calendarEntities,
            timezone: document.getElementById('timezone').value
        };

        const success = await Config.save(config);

        if (success) {
            // Actualizar módulos con nueva configuración
            Clock.timezone = config.timezone;
            Clock.update();

            await Weather.refresh();
            await Calendar.refresh();

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
