// Configuración de la API
const API_URL = 'https://tribunal-strong-flags-testing.trycloudflare.com/api';
const APP_TIMEZONE = 'America/Bogota';

// Estado global de la aplicación
const AppState = {
	menuItems: [],
	orders: [],
	transactions: [],
	waiters: [],
	config: {},
	cashClosures: [],
	isOnline: navigator.onLine
};

// Utilidades para LocalStorage
const Storage = {
	get(key) {
		const data = localStorage.getItem(key);
		return data ? JSON.parse(data) : null;
	},
	set(key, value) {
		localStorage.setItem(key, JSON.stringify(value));
	},
	remove(key) {
		localStorage.removeItem(key);
	}
};

// Cliente API - Solo backend, sin localStorage
const API = {
	async getAll(table) {
		try {
			const response = await fetch(`${API_URL}/${table}`, {
				timeout: 10000 // 10 segundos timeout
			});
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
			const data = await response.json();
			return data;
		} catch (error) {
			console.error(`Error obteniendo ${table}:`, error);
			// No mostrar notificación aquí, se maneja en el código llamante
			throw error;
		}
	},

	async save(table, items, retries = 2) {
		for (let i = 0; i <= retries; i++) {
			try {
				const response = await fetch(`${API_URL}/${table}`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(items)
				});
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				return await response.json();
			} catch (error) {
				if (i === retries) {
					console.error(`Error guardando ${table} después de ${retries + 1} intentos:`, error);
					throw error;
				}
				// Esperar antes de reintentar (500ms, 1000ms)
				await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
			}
		}
	},

	async update(table, id, item) {
		try {
			const response = await fetch(`${API_URL}/${table}/${id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(item)
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			return await response.json();
		} catch (error) {
			console.error(`Error actualizando ${table}/${id}:`, error);
			throw error;
		}
	},

	async delete(table, id) {
		try {
			const response = await fetch(`${API_URL}/${table}/${id}`, {
				method: 'DELETE'
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			return await response.json();
		} catch (error) {
			console.error(`Error eliminando ${table}/${id}:`, error);
			throw error;
		}
	}
};

// Utilidades generales
const Utils = {
	generateId() {
		return Date.now().toString(36) + Math.random().toString(36).substr(2);
	},

	formatCurrency(amount) {
		return new Intl.NumberFormat('es-CO', {
			style: 'currency',
			currency: 'COP',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(amount);
	},

	formatDate(date) {
		return new Intl.DateTimeFormat('es-MX', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		}).format(new Date(date));
	},

	getDateKey(date = new Date(), timeZone = APP_TIMEZONE) {
		return new Intl.DateTimeFormat('en-CA', {
			timeZone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		}).format(date);
	},

	getMonthKey(date = new Date(), timeZone = APP_TIMEZONE) {
		const parts = new Intl.DateTimeFormat('en-CA', {
			timeZone,
			year: 'numeric',
			month: '2-digit'
		}).formatToParts(date);
		const year = parts.find(p => p.type === 'year')?.value || '0000';
		const month = parts.find(p => p.type === 'month')?.value || '01';
		return `${year}-${month}`;
	},

	getLastMonthKey(timeZone = APP_TIMEZONE) {
		const now = new Date();
		now.setMonth(now.getMonth() - 1);
		return Utils.getMonthKey(now, timeZone);
	},

	getDateKeyFromISO(isoString, timeZone = APP_TIMEZONE) {
		if (!isoString) return '';
		return Utils.getDateKey(new Date(isoString), timeZone);
	},

	getMonthKeyFromISO(isoString, timeZone = APP_TIMEZONE) {
		if (!isoString) return '';
		return Utils.getMonthKey(new Date(isoString), timeZone);
	},

	formatDateKeyForChart(dateKey, timeZone = APP_TIMEZONE) {
		if (!dateKey) return '';
		const [year, month, day] = dateKey.split('-').map(Number);
		const anchor = new Date(Date.UTC(year, (month || 1) - 1, day || 1, 12, 0, 0));
		return new Intl.DateTimeFormat('es-MX', {
			timeZone,
			weekday: 'short',
			day: 'numeric'
		}).format(anchor);
	},

	showNotification(message, type = 'info') {
		console.log(`[${type.toUpperCase()}] ${message}`);
		// Solo mostrar alertas para errores críticos
		if (type === 'error') {
			alert(message);
		}
	}
};

// Registro del Service Worker
if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('/service-worker.js')
			.then(reg => console.log('✅ Service Worker registrado'))
			.catch(err => console.error('❌ Error en Service Worker:', err));
	});
}

// Detectar cambios en la conexión
window.addEventListener('online', () => {
	AppState.isOnline = true;
	console.log('✅ Conexión restaurada');
});

window.addEventListener('offline', () => {
	AppState.isOnline = false;
	console.warn('⚠️ Sin conexión al servidor');
});

// Cargar datos iniciales - Solo desde backend
async function loadInitialData() {
	try {
		AppState.menuItems = await API.getAll('menu_items');
		AppState.orders = await API.getAll('orders');
		AppState.transactions = await API.getAll('transactions');
		AppState.waiters = await API.getAll('waiters');

		// Intentar cargar cash_closures, si falla, usar array vacío
		try {
			AppState.cashClosures = await API.getAll('cash_closures');
		} catch (err) {
			console.warn('⚠️ Tabla cash_closures no disponible en el servidor');
			AppState.cashClosures = [];
		}

		const configArray = await API.getAll('config');
		AppState.config = configArray.length > 0 ? configArray[0] : {};
	} catch (error) {
		console.error('Error cargando datos iniciales:', error);
		throw error;
	}
}

// Inicializar datos de ejemplo si no existen
async function initializeDefaultData() {
	if (AppState.menuItems.length === 0) {
		// Si no hay datos, cargar ejemplos iniciales de LAZOS DE AMOR
		AppState.menuItems = [
			{
				id: Utils.generateId(),
				name: 'Bolso Macramé Crudo',
				description: 'Bolso tejido a mano en hilo de algodón color crudo. Diseño elegante y espacioso.',
				cost: 45000,
				price: 85000,
				category: 'Macramé',
				image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBk6smYy2Mm-f3m_jaZGjaNaTiCZk7WJoDuXJ2XvpQdVBqjbxeHZBapk_oryfTLJ_p3b0JBfZPYOh_vaiaa1kTS2QbuTlv8ZU53vJAftgMuP2RaKvPxvey4jmui8MtvGY2ubBrC1yvcbBoQx4uXHx47VbaLRfhQt42kq8jQTmyNkPDuGhjMYDWFIiygY9badWq5eGbfCeJUOMyqUaJTdUXDag9CIvqI35s6uGg9xciuIZccIxrN1j1YVvBC4FYScSLtAH502Y5jDmc',
				available: true
			},
			{
				id: Utils.generateId(),
				name: 'Cartera Zuncho Colorida',
				description: 'Cartera resistente tejida en zuncho con patrones geométricos vibrantes.',
				cost: 35000,
				price: 65000,
				category: 'Bolsos en Zuncho',
				image: 'zuncho_artesanal.png',
				available: true
			},
			{
				id: Utils.generateId(),
				name: 'Cesta Organizadora',
				description: 'Cesta tejida en trapillo ideal para organizar espacios con estilo.',
				cost: 25000,
				price: 45000,
				category: 'Tejidos Crochet',
				image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBBb22GOqiBV3DeTE7F8-8QgWOmKaEbZVPAUkwa1czfqVAN6wcTs7nDkuPXcNxPUhKZ5EhCdubA4EXwfnzccyYH2Vgn9cGljielLhFylJDi_m51lnyIxlWkVgpxdjGWyLjFSL1IAa0PwmRzEJDR8y5r8_BvC6QvJtH5Rz7z4ZtXgG8qK_l8J3bJ4Z5yL9XwQ9zH3jK5nM2P4rT8qVw6xY7uZ9aO1bC3dE5fG7hI9jL0mK2nO4pQ6sR8tU9vW1xY3zA5bC7d9eF1gH3jI5kL7mN9oP2rS',
				available: true
			}
		];
		await API.save('menu_items', AppState.menuItems);
	} else {
		// Migración: Añadir campo cost a productos existentes que no lo tengan
		let needsUpdate = false;
		AppState.menuItems.forEach(item => {
			if (item.cost === undefined) {
				item.cost = 0;
				needsUpdate = true;
			}
			// Migración: Convertir img único a array images
			if (item.img && !item.images) {
				item.images = [item.img];
				delete item.img;
				needsUpdate = true;
			}
			// Asegurar que images sea un array (por si acaso)
			if (!item.images || !Array.isArray(item.images)) {
				item.images = [];
				needsUpdate = true;
			}
			// Migración: Renombrar categorías
			if (item.category === 'Cuero Artesanal') {
				item.category = 'Cuero';
				needsUpdate = true;
			}
			if (item.category && item.category.toLowerCase().includes('trapillo')) {
				item.category = 'Tejidos Crochet';
				needsUpdate = true;
			}
		});
		if (needsUpdate) {
			await API.save('menu_items', AppState.menuItems);
		}
	}

	if (AppState.waiters.length === 0) {
		AppState.waiters = [
			{
				id: Utils.generateId(),
				name: 'Juan Pérez',
				active: true
			},
			{
				id: Utils.generateId(),
				name: 'María García',
				active: true
			}
		];
		await API.save('waiters', AppState.waiters);
	}
}

// Cargar cierres de caja
async function loadCashClosures() {
	return await API.getAll('cash_closures');
}

// Exportar para uso global
window.AppState = AppState;
window.API = API;
window.Utils = Utils;
window.Storage = Storage;
window.loadInitialData = loadInitialData;
window.initializeDefaultData = initializeDefaultData;
window.loadCashClosures = loadCashClosures;
window.APP_TIMEZONE = APP_TIMEZONE;
