/**
 * Módulo del clima
 * Integración con Home Assistant para obtener datos del clima (OpenWeatherMap)
 */

const Weather = {
    currentData: null,
    updateInterval: null,
    statusElement: null,

    // Mapeo de condiciones de HA a iconos de Lucide
    conditionMap: {
        'clear-night': { icon: 'moon', text: 'Despejado' },
        'cloudy': { icon: 'cloud', text: 'Nublado' },
        'fog': { icon: 'cloud-fog', text: 'Neblina' },
        'hail': { icon: 'cloud-hail', text: 'Granizo' },
        'lightning': { icon: 'cloud-lightning', text: 'Tormenta eléctrica' },
        'lightning-rainy': { icon: 'cloud-lightning', text: 'Tormenta con lluvia' },
        'partlycloudy': { icon: 'cloud-sun', text: 'Parcialmente nublado' },
        'pouring': { icon: 'cloud-rain', text: 'Lluvia intensa' },
        'rainy': { icon: 'cloud-drizzle', text: 'Lluvia' },
        'snowy': { icon: 'snowflake', text: 'Nieve' },
        'snowy-rainy': { icon: 'cloud-snow', text: 'Aguanieve' },
        'sunny': { icon: 'sun', text: 'Soleado' },
        'windy': { icon: 'wind', text: 'Ventoso' },
        'windy-variant': { icon: 'wind', text: 'Ventoso' },
        'exceptional': { icon: 'alert-triangle', text: 'Excepcional' }
    },

    /**
     * Inicializa el módulo del clima
     */
    async init() {
        this.statusElement = document.getElementById('ha-status');
        await this.fetchWeather();

        const config = await Config.get();
        this.startAutoUpdate(config.updateInterval);
    },

    /**
     * Obtiene los datos del clima desde el backend (proxy a Home Assistant)
     */
    async fetchWeather() {
        this.setStatus('connecting');

        try {
            // Usar el proxy del backend para evitar CORS
            const response = await fetch(`${Config.backendUrl}/api/weather`);

            if (response.status === 400) {
                this.setStatus('disconnected');
                this.updateUI(null, 'Configurar HA');
                return null;
            }

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.detail || `HTTP ${response.status}`);
            }

            const data = await response.json();
            this.currentData = data;
            this.setStatus('connected');
            this.updateUI(data);
            return data;

        } catch (error) {
            console.error('Error obteniendo clima:', error);
            this.setStatus('disconnected');
            this.updateUI(null, error.message || 'Error de conexión');
            return null;
        }
    },

    /**
     * Actualiza la interfaz con los datos del clima
     */
    updateUI(data, errorMessage = null) {
        const tempElement = document.getElementById('temperature');
        const feelsLikeElement = document.getElementById('feels-like');
        const conditionElement = document.getElementById('weather-condition');
        const iconElement = document.getElementById('weather-icon');
        const humidityElement = document.getElementById('humidity');
        const locationElement = document.getElementById('location-name');

        if (!data || errorMessage) {
            tempElement.textContent = '--°';
            feelsLikeElement.textContent = '--°';
            conditionElement.textContent = errorMessage || 'Sin datos';
            humidityElement.textContent = '--%';
            locationElement.textContent = '';
            this.setIcon(iconElement, 'cloud-off');
            return;
        }

        const attrs = data.attributes || {};

        // Temperatura
        const temp = attrs.temperature;
        tempElement.textContent = temp !== undefined ? `${Math.round(temp)}°` : '--°';

        // Sensación térmica
        const feelsLike = attrs.apparent_temperature;
        feelsLikeElement.textContent = feelsLike !== undefined ? `${Math.round(feelsLike)}°` : '--°';

        // Condición
        const condition = data.state;
        const conditionInfo = this.conditionMap[condition] || {
            icon: 'cloud-question',
            text: condition
        };
        conditionElement.textContent = conditionInfo.text;

        // Icono principal
        this.setIcon(iconElement, conditionInfo.icon);

        // Humedad
        const humidity = attrs.humidity;
        humidityElement.textContent = humidity !== undefined ? `${humidity}%` : '--%';

        // Ubicación
        const friendlyName = attrs.friendly_name;
        locationElement.textContent = friendlyName || '';

        // Re-renderizar iconos de Lucide
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    /**
     * Establece el icono de Lucide en un elemento
     */
    setIcon(element, iconName) {
        if (element) {
            element.innerHTML = `<i data-lucide="${iconName}"></i>`;
            // Re-renderizar iconos de Lucide
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    },

    /**
     * Establece el estado de conexión
     */
    setStatus(status) {
        if (this.statusElement) {
            this.statusElement.className = `status-indicator ${status}`;
        }
    },

    /**
     * Inicia la actualización automática
     */
    startAutoUpdate(interval = 30000) {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        this.updateInterval = setInterval(() => {
            this.fetchWeather();
        }, interval);
    },

    /**
     * Detiene la actualización automática
     */
    stopAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    },

    /**
     * Fuerza una actualización inmediata
     */
    async refresh() {
        return await this.fetchWeather();
    }
};

// Exportar para uso global
window.Weather = Weather;
