// ===== config.js =====
// Configuración del viaje y estado global (URL del Apps Script, variables compartidas, subtes de la ciudad).
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

// RED DE SUBTES TRAZADA
const SUBWAY_LINES = {
    'Línea A': { color: '#00a0dd', coords: [[-34.6086, -58.3714], [-34.6089, -58.3806], [-34.6094, -58.3926], [-34.6099, -58.4069], [-34.6186, -58.4419], [-34.6234, -58.4697]] },
    'Línea B': { color: '#e60012', coords: [[-34.6030, -58.3701], [-34.6041, -58.3860], [-34.6046, -58.4116], [-34.5857, -58.4578], [-34.5739, -58.4792]] },
    'Línea C': { color: '#00569f', coords: [[-34.5916, -58.3743], [-34.6017, -58.3792], [-34.6272, -58.3808]] },
    'Línea D': { color: '#008066', coords: [[-34.6076, -58.3741], [-34.6048, -58.3831], [-34.5985, -58.3976], [-34.5878, -58.4101], [-34.5701, -58.4439], [-34.5556, -58.4550]] },
    'Línea H': { color: '#ffd400', coords: [[-34.5836, -58.3925], [-34.6041, -58.4055], [-34.6369, -58.4058]] }
};

const SUBWAY_NODES = [
    { name: "Subte D/A/Nodal Obelisco", coords: [-34.6048, -58.3831] },
    { name: "Subte A/H Plaza Miserere", coords: [-34.6099, -58.4069] },
    { name: "Subte D Congreso de Tucumán", coords: [-34.5556, -58.4550] },
    { name: "Subte B Federico Lacroze", coords: [-34.5857, -58.4578] },
    { name: "Subte C Retiro", coords: [-34.5916, -58.3743] },
    { name: "Subte C Constitución", coords: [-34.6272, -58.3808] }
];
