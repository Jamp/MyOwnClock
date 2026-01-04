/**
 * Módulo del reloj
 * Maneja la hora y fecha con soporte de zonas horarias
 */

const Clock = {
    timezone: 'America/Mexico_City',
    format24h: true,
    updateInterval: null,

    // Nombres de días y meses en español
    days: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
    months: [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ],

    /**
     * Inicializa el reloj
     */
    async init() {
        const config = await Config.get();
        this.timezone = config.timezone || 'America/Mexico_City';
        this.format24h = config.clockFormat !== '12h';

        this.update();
        this.startAutoUpdate();
    },

    /**
     * Obtiene la hora actual en la zona horaria configurada
     */
    getCurrentTime() {
        const now = new Date();

        try {
            const options = {
                timeZone: this.timezone,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: !this.format24h
            };

            const formatter = new Intl.DateTimeFormat('es-MX', options);
            const parts = formatter.formatToParts(now);

            const time = {};
            parts.forEach(part => {
                time[part.type] = part.value;
            });

            return {
                hours: time.hour,
                minutes: time.minute,
                seconds: time.second,
                period: time.dayPeriod || ''
            };
        } catch (error) {
            console.error('Error formateando hora:', error);
            return {
                hours: now.getHours().toString().padStart(2, '0'),
                minutes: now.getMinutes().toString().padStart(2, '0'),
                seconds: now.getSeconds().toString().padStart(2, '0'),
                period: ''
            };
        }
    },

    /**
     * Obtiene la fecha actual formateada
     */
    getCurrentDate() {
        const now = new Date();

        try {
            const options = {
                timeZone: this.timezone,
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            };

            const formatter = new Intl.DateTimeFormat('es-MX', options);
            return formatter.format(now);
        } catch (error) {
            console.error('Error formateando fecha:', error);
            const day = this.days[now.getDay()];
            const month = this.months[now.getMonth()];
            return `${day}, ${now.getDate()} de ${month} de ${now.getFullYear()}`;
        }
    },

    /**
     * Actualiza la interfaz
     */
    update() {
        const time = this.getCurrentTime();
        const date = this.getCurrentDate();

        const timeElement = document.getElementById('time');
        const secondsElement = document.getElementById('seconds');
        const dateElement = document.getElementById('date');

        if (timeElement) {
            timeElement.textContent = `${time.hours}:${time.minutes}`;
        }

        if (secondsElement) {
            secondsElement.textContent = time.seconds;
        }

        if (dateElement) {
            dateElement.textContent = date;
        }
    },

    /**
     * Inicia la actualización automática cada segundo
     */
    startAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        this.updateInterval = setInterval(() => {
            this.update();
        }, 1000);
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
     * Cambia la zona horaria
     */
    async setTimezone(tz) {
        this.timezone = tz;
        this.update();

        // Guardar en configuración
        const config = await Config.get();
        config.timezone = tz;
        await Config.save(config);
    },

    /**
     * Cambia el formato de hora
     */
    setFormat(is24h) {
        this.format24h = is24h;
        this.update();
    }
};

// Exportar para uso global
window.Clock = Clock;
