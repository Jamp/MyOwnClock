/**
 * Módulo de configuración
 * Maneja la persistencia y carga de configuraciones
 */

const Config = {
    // Configuración por defecto
    defaults: {
        haUrl: '',
        haToken: '',
        weatherEntity: 'weather.openweathermap',
        calendarEntities: [],
        timezone: 'America/Lima',
        updateInterval: 60000, // 60 segundos para el clima
        clockFormat: '24h',
        showBattery: true
    },

    // API del backend
    backendUrl: window.location.origin.includes('file://')
        ? 'http://localhost:8080'
        : '',

    // Para detectar cambios remotos
    _lastConfigHash: null,
    _watchInterval: null,
    _onChangeCallbacks: [],

    /**
     * Obtiene la configuración actual
     */
    async get() {
        try {
            // Primero intenta obtener del backend
            const response = await fetch(`${this.backendUrl}/api/config`);
            if (response.ok) {
                const config = await response.json();
                return { ...this.defaults, ...config };
            }
        } catch (error) {
            console.warn('Backend no disponible, usando localStorage:', error.message);
        }

        // Fallback a localStorage
        const stored = localStorage.getItem('own_clock_config');
        if (stored) {
            try {
                return { ...this.defaults, ...JSON.parse(stored) };
            } catch (e) {
                console.error('Error parseando config local:', e);
            }
        }

        return this.defaults;
    },

    /**
     * Guarda la configuración
     */
    async save(config) {
        const newConfig = { ...this.defaults, ...config };

        try {
            // Intenta guardar en el backend
            const response = await fetch(`${this.backendUrl}/api/config`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newConfig)
            });

            if (response.ok) {
                console.log('Configuración guardada en backend');
                // Actualizar hash para no detectar nuestro propio cambio
                this._lastConfigHash = this._hashConfig(newConfig);
                return true;
            }
        } catch (error) {
            console.warn('No se pudo guardar en backend:', error.message);
        }

        // Fallback a localStorage
        try {
            localStorage.setItem('own_clock_config', JSON.stringify(newConfig));
            console.log('Configuración guardada en localStorage');
            return true;
        } catch (e) {
            console.error('Error guardando config:', e);
            return false;
        }
    },

    /**
     * Obtiene un valor específico de configuración
     */
    async getValue(key) {
        const config = await this.get();
        return config[key] ?? this.defaults[key];
    },

    /**
     * Genera un hash simple de la configuración para detectar cambios
     */
    _hashConfig(config) {
        const str = JSON.stringify({
            haUrl: config.haUrl,
            haToken: config.haToken,
            weatherEntity: config.weatherEntity,
            calendarEntities: config.calendarEntities,
            timezone: config.timezone,
            showBattery: config.showBattery,
            lastUpdate: config.lastUpdate
        });
        // Simple hash
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    },

    /**
     * Registra un callback para cuando la configuración cambie remotamente
     */
    onChange(callback) {
        this._onChangeCallbacks.push(callback);
    },

    /**
     * Inicia el monitoreo de cambios remotos
     * @param {number} interval - Intervalo en ms (default: 10 segundos)
     */
    async startWatching(interval = 10000) {
        // Guardar hash inicial
        const config = await this.get();
        this._lastConfigHash = this._hashConfig(config);

        // Limpiar intervalo anterior si existe
        if (this._watchInterval) {
            clearInterval(this._watchInterval);
        }

        // Iniciar polling
        this._watchInterval = setInterval(async () => {
            await this._checkForChanges();
        }, interval);

        console.log(`Config watcher iniciado (cada ${interval/1000}s)`);
    },

    /**
     * Detiene el monitoreo de cambios
     */
    stopWatching() {
        if (this._watchInterval) {
            clearInterval(this._watchInterval);
            this._watchInterval = null;
            console.log('Config watcher detenido');
        }
    },

    /**
     * Verifica si hubo cambios remotos
     */
    async _checkForChanges() {
        try {
            const config = await this.get();
            const newHash = this._hashConfig(config);

            if (this._lastConfigHash && newHash !== this._lastConfigHash) {
                console.log('Cambio de configuración detectado remotamente');
                this._lastConfigHash = newHash;

                // Notificar a todos los callbacks
                for (const callback of this._onChangeCallbacks) {
                    try {
                        await callback(config);
                    } catch (e) {
                        console.error('Error en callback de config:', e);
                    }
                }
            }
        } catch (error) {
            // Silenciar errores de red durante polling
        }
    }
};

// Exportar para uso global
window.Config = Config;
