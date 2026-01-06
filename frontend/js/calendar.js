/**
 * Módulo del calendario
 * Integración con Google Calendar via Home Assistant
 */

const Calendar = {
    events: [],
    updateInterval: null,
    timezone: 'America/Lima',

    /**
     * Inicializa el módulo del calendario
     */
    async init() {
        const config = await Config.get();
        this.timezone = config.timezone || 'America/Lima';

        await this.fetchEvents();
        // Actualizar cada 5 minutos
        this.startAutoUpdate(300000);
    },

    /**
     * Obtiene los eventos del calendario desde el backend
     */
    async fetchEvents() {
        try {
            const response = await fetch(`${Config.backendUrl}/api/calendar`);

            if (response.status === 400) {
                // Calendario no configurado
                this.events = [];
                this.updateUI();
                return [];
            }

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.detail || `HTTP ${response.status}`);
            }

            const events = await response.json();
            this.events = this.processEvents(events);
            this.updateUI();
            return this.events;

        } catch (error) {
            console.error('Error obteniendo calendario:', error);
            this.events = [];
            this.updateUI();
            return [];
        }
    },

    /**
     * Parsea una fecha de evento, manejando correctamente eventos de todo el día
     */
    parseEventDate(dateTime, date) {
        if (dateTime) {
            // Evento con hora específica
            return new Date(dateTime);
        }
        // Evento de todo el día: agregar T12:00:00 para evitar cambios de día por zona horaria
        // "2026-01-06" -> "2026-01-06T12:00:00" (mediodía, seguro en cualquier zona horaria)
        return new Date(date + 'T12:00:00');
    },

    /**
     * Procesa y ordena los eventos
     */
    processEvents(events) {
        if (!Array.isArray(events)) return [];

        const now = new Date();

        return events
            .map(event => ({
                summary: event.summary || 'Sin título',
                start: this.parseEventDate(event.start?.dateTime, event.start?.date),
                end: this.parseEventDate(event.end?.dateTime, event.end?.date),
                allDay: !event.start?.dateTime,
                location: event.location || '',
                description: event.description || '',
                calendar: event.calendar || '',
                calendarEntity: event.calendar_entity || ''
            }))
            .filter(event => event.end >= now) // Solo eventos futuros o en curso
            .sort((a, b) => a.start - b.start)
            .slice(0, 5); // Máximo 5 eventos
    },

    /**
     * Actualiza la interfaz con los eventos
     */
    updateUI() {
        const container = document.getElementById('calendar-events');
        if (!container) return;

        if (this.events.length === 0) {
            container.innerHTML = '<div class="no-events">Sin eventos próximos</div>';
            return;
        }

        const eventsHtml = this.events.map(event => this.renderEvent(event)).join('');
        container.innerHTML = eventsHtml;

        // Re-renderizar iconos de Lucide
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    /**
     * Renderiza un evento individual
     */
    renderEvent(event) {
        const timeStr = this.formatEventTime(event);
        const isToday = this.isToday(event.start);
        const isTomorrow = this.isTomorrow(event.start);
        const isNow = this.isHappening(event);

        let dayLabel = '';
        if (isToday) {
            dayLabel = '<span class="event-day today">Hoy</span>';
        } else if (isTomorrow) {
            dayLabel = '<span class="event-day tomorrow">Mañana</span>';
        } else {
            dayLabel = `<span class="event-day">${this.formatDayName(event.start)}</span>`;
        }

        const nowClass = isNow ? 'event-now' : '';
        const calendarBadge = event.calendar
            ? `<span class="event-calendar">${this.escapeHtml(event.calendar)}</span>`
            : '';

        return `
            <div class="event ${nowClass}">
                <div class="event-time">
                    ${dayLabel}
                    <span class="event-hour">${timeStr}</span>
                </div>
                <div class="event-details">
                    <div class="event-title">${this.escapeHtml(event.summary)}</div>
                    ${calendarBadge}
                </div>
            </div>
        `;
    },

    /**
     * Formatea la hora del evento (en la zona horaria configurada)
     */
    formatEventTime(event) {
        if (event.allDay) {
            return 'Todo el día';
        }

        const options = {
            timeZone: this.timezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        };
        return event.start.toLocaleTimeString('es-PE', options);
    },

    /**
     * Formatea el nombre del día (en la zona horaria configurada)
     */
    formatDayName(date) {
        const options = {
            timeZone: this.timezone,
            weekday: 'short',
            day: 'numeric'
        };
        return date.toLocaleDateString('es-PE', options);
    },

    /**
     * Obtiene la fecha actual en la zona horaria configurada (solo año-mes-día)
     */
    getTodayInTimezone() {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: this.timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        return formatter.format(now); // Returns "YYYY-MM-DD"
    },

    /**
     * Convierte una fecha a string YYYY-MM-DD en la zona horaria configurada
     */
    getDateStringInTimezone(date) {
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: this.timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        return formatter.format(date);
    },

    /**
     * Verifica si una fecha es hoy (en la zona horaria configurada)
     */
    isToday(date) {
        const today = this.getTodayInTimezone();
        const dateStr = this.getDateStringInTimezone(date);
        return dateStr === today;
    },

    /**
     * Verifica si una fecha es mañana (en la zona horaria configurada)
     */
    isTomorrow(date) {
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const tomorrowStr = this.getDateStringInTimezone(tomorrow);
        const dateStr = this.getDateStringInTimezone(date);
        return dateStr === tomorrowStr;
    },

    /**
     * Verifica si un evento está en curso (en la zona horaria configurada)
     */
    isHappening(event) {
        const now = new Date();

        // Para eventos de todo el día, comparar solo la fecha
        if (event.allDay) {
            const todayStr = this.getTodayInTimezone();
            const startStr = this.getDateStringInTimezone(event.start);
            const endStr = this.getDateStringInTimezone(event.end);
            // El evento está en curso si hoy >= start y hoy < end
            return todayStr >= startStr && todayStr < endStr;
        }

        return now >= event.start && now <= event.end;
    },

    /**
     * Escapa HTML para prevenir XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Inicia la actualización automática
     */
    startAutoUpdate(interval = 300000) {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        this.updateInterval = setInterval(() => {
            this.fetchEvents();
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
        return await this.fetchEvents();
    }
};

// Exportar para uso global
window.Calendar = Calendar;
