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
        clockFormat: '24h'
    },

    // API del backend
    backendUrl: window.location.origin.includes('file://')
        ? 'http://localhost:8080'
        : '',

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
    }
};

// Exportar para uso global
window.Config = Config;
