// ===== config.js =====
// Configuración del viaje y estado global (URL del Apps Script, variables compartidas, red Shinkansen).
// Es el primer archivo que se carga: los demás usan estas variables.

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycby-4FwNlzBYgzqx59HByDFoTuIW_0VXU1OR0LyzMVJLzcYn1Pu48e8-MJBaJ2ytFpjT/exec";
let ARS_USD_RATE = 1250;
let JPY_USD_RATE = 150;         // [CAMBIO 12] yenes por dólar (se actualiza en vivo)
let balanceCurrency = localStorage.getItem('japon2_balance_currency') || 'JPY'; // [CAMBIO 12] moneda del balance

let START_DATE = null;
let currentWeek = 1;
let totalWeeks = 2;
let localEvents = [];
let accommodationsData = [];
let recomendationsData = [];
let rawExpenses = [];

let traveler1 = localStorage.getItem('japon2_traveler1') || '';
let traveler2 = localStorage.getItem('japon2_traveler2') || '';

let currentModalEventObj = null;
let editingAccommodation = null; // [CAMBIO 4] alojamiento que se está editando (o null)
let leafletMap = null;
let mapMarkers = [];
let mapSubwayLayers = [];
let showTripLines = false;      // [CAMBIO 9] líneas de trayectos ocultas de entrada
let currentMapFilter = 'all';   // [CAMBIO 9] recuerda el filtro elegido

// [CAMBIO 13] Los subtes de Buenos Aires se quitaron.
// Quedan definidos pero vacíos, por si algún otro archivo todavía los nombra.
const SUBWAY_LINES = {};
const SUBWAY_NODES = [];

// [CAMBIO 13] RED SHINKANSEN (estaciones principales; el trazado entre estaciones es aproximado)
let shinkansenLayers = [];
let showShinkansen = false;     // oculta de entrada, se prende con el botón 🚄

// Cada estación: [nombre, latitud, longitud]
const SHINKANSEN_LINES = {
    'Tokaido': {
        color: '#1d4ed8',
        route: 'Tokio – Nagoya – Kioto – Shin-Osaka',
        stations: [
            ['Tokio', 35.6812, 139.7671], ['Shinagawa', 35.6285, 139.7387], ['Shin-Yokohama', 35.5075, 139.6175],
            ['Odawara', 35.2564, 139.1552], ['Atami', 35.1037, 139.0779], ['Mishima', 35.1263, 138.9110],
            ['Shizuoka', 34.9716, 138.3890], ['Hamamatsu', 34.7038, 137.7348], ['Toyohashi', 34.7628, 137.3820],
            ['Nagoya', 35.1709, 136.8815], ['Gifu-Hashima', 35.3155, 136.6857], ['Maibara', 35.3146, 136.2900],
            ['Kioto', 34.9858, 135.7588], ['Shin-Osaka', 34.7335, 135.5003]
        ]
    },
    'Sanyo': {
        color: '#0891b2',
        route: 'Shin-Osaka – Okayama – Hiroshima – Hakata (Fukuoka)',
        stations: [
            ['Shin-Osaka', 34.7335, 135.5003], ['Shin-Kobe', 34.7066, 135.1955], ['Himeji', 34.8269, 134.6907],
            ['Okayama', 34.6664, 133.9180], ['Fukuyama', 34.4893, 133.3622], ['Hiroshima', 34.3976, 132.4755],
            ['Shin-Yamaguchi', 34.0928, 131.3961], ['Kokura', 33.8869, 130.8826], ['Hakata', 33.5897, 130.4207]
        ]
    },
    'Tohoku': {
        color: '#059669',
        route: 'Tokio – Sendai – Morioka – Shin-Aomori',
        stations: [
            ['Tokio', 35.6812, 139.7671], ['Ueno', 35.7138, 139.7773], ['Omiya', 35.9063, 139.6240],
            ['Utsunomiya', 36.5590, 139.8985], ['Koriyama', 37.3983, 140.3887], ['Fukushima', 37.7545, 140.4592],
            ['Sendai', 38.2601, 140.8822], ['Morioka', 39.7016, 141.1365], ['Hachinohe', 40.5090, 141.4313],
            ['Shin-Aomori', 40.8274, 140.6935]
        ]
    },
    'Joetsu': {
        color: '#ea580c',
        route: 'Tokio – Omiya – Takasaki – Niigata (comparte vías con Tohoku hasta Omiya)',
        stations: [
            ['Omiya', 35.9063, 139.6240], ['Takasaki', 36.3225, 139.0128], ['Echigo-Yuzawa', 36.9357, 138.8094],
            ['Nagaoka', 37.4473, 138.8517], ['Niigata', 37.9121, 139.0610]
        ]
    },
    'Hokuriku': {
        color: '#c026d3',
        route: 'Tokio – Takasaki – Nagano – Kanazawa – Tsuruga (comparte vías con Joetsu hasta Takasaki)',
        stations: [
            ['Takasaki', 36.3225, 139.0128], ['Karuizawa', 36.3428, 138.6352], ['Nagano', 36.6431, 138.1887],
            ['Toyama', 36.7013, 137.2130], ['Kanazawa', 36.5780, 136.6478], ['Fukui', 36.0623, 136.2233],
            ['Tsuruga', 35.6455, 136.0756]
        ]
    },
    'Kyushu': {
        color: '#dc2626',
        route: 'Hakata – Kumamoto – Kagoshima-Chuo',
        stations: [
            ['Hakata', 33.5897, 130.4207], ['Kurume', 33.3200, 130.4997], ['Kumamoto', 32.7900, 130.6888],
            ['Kagoshima-Chuo', 31.5838, 130.5414]
        ]
    },
    'Hokkaido': {
        color: '#65a30d',
        route: 'Shin-Aomori – túnel Seikan – Shin-Hakodate-Hokuto',
        stations: [
            ['Shin-Aomori', 40.8274, 140.6935], ['Okutsugaru-Imabetsu', 41.1453, 140.5155],
            ['Kikonai', 41.6791, 140.4359], ['Shin-Hakodate-Hokuto', 41.9045, 140.6487]
        ]
    }
};
