/**
 * Módulo de batería
 * Muestra el estado de la batería del sistema
 */

const Battery = {
    data: null,
    updateInterval: null,

    /**
     * Inicializa el módulo de batería
     */
    async init() {
        await this.fetchBattery();
        // Actualizar cada 60 segundos
        this.startAutoUpdate(60000);
    },

    /**
     * Obtiene el estado de la batería desde el backend
     */
    async fetchBattery() {
        try {
            const response = await fetch(`${Config.backendUrl}/api/battery`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            this.data = data;
            this.updateUI(data);
            return data;

        } catch (error) {
            console.error('Error obteniendo batería:', error);
            this.updateUI(null);
            return null;
        }
    },

    /**
     * Actualiza la interfaz con el estado de la batería
     */
    updateUI(data) {
        const container = document.getElementById('battery-indicator');
        if (!container) return;

        if (!data || !data.available) {
            container.classList.add('hidden');
            return;
        }

        container.classList.remove('hidden');

        const iconEl = container.querySelector('.battery-icon');
        const percentEl = document.getElementById('battery-percent');

        // Actualizar porcentaje
        const percent = data.percent ?? 0;
        percentEl.textContent = `${percent}%`;

        // Determinar icono según nivel y estado de carga
        let iconName = 'battery';
        if (data.charging) {
            iconName = 'battery-charging';
        } else if (percent <= 10) {
            iconName = 'battery-warning';
        } else if (percent <= 25) {
            iconName = 'battery-low';
        } else if (percent <= 50) {
            iconName = 'battery-medium';
        } else {
            iconName = 'battery-full';
        }

        iconEl.innerHTML = `<i data-lucide="${iconName}"></i>`;

        // Clase de color según nivel
        container.classList.remove('battery-critical', 'battery-low', 'battery-charging');
        if (data.charging) {
            container.classList.add('battery-charging');
        } else if (percent <= 10) {
            container.classList.add('battery-critical');
        } else if (percent <= 25) {
            container.classList.add('battery-low');
        }

        // Re-renderizar iconos de Lucide
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    /**
     * Inicia la actualización automática
     */
    startAutoUpdate(interval = 60000) {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        this.updateInterval = setInterval(() => {
            this.fetchBattery();
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
        return await this.fetchBattery();
    }
};

// Exportar para uso global
window.Battery = Battery;
