// ===== app.js =====
// Arranque de la aplicación, cambio de pestañas y temas de color. Es el último archivo que se carga.

// ===== [CAMBIO 21] TEMAS =====
const THEMES = ['pixel', 'torii', 'aiiro', 'sakura', 'matcha', 'clasico'];
const DEFAULT_THEME = 'pixel';

// Aplica un tema a la página y lo recuerda en este dispositivo
function applyTheme(name) {
    if (!THEMES.includes(name)) name = DEFAULT_THEME;
    document.documentElement.setAttribute('data-theme', name);
    try { localStorage.setItem('japon2_theme', name); } catch (e) {}
    document.querySelectorAll('.theme-chip').forEach(b => b.classList.toggle('active', b.dataset.theme === name));
}

// Muestra u oculta la fila de temas (botón 🎨)
function toggleThemePanel() {
    const p = document.getElementById('theme-panel');
    if (p) p.style.display = (p.style.display === 'flex') ? 'none' : 'flex';
}

// Elegir un tema: se aplica al instante y se guarda en Config para todos los dispositivos
async function chooseTheme(name) {
    applyTheme(name);
    toggleThemePanel();
    try {
        await saveConfigValue('Tema', name);
    } catch (e) {
        alert('No se pudo guardar el tema en el Sheet: ' + e.message);
    }
}

// Apenas carga la página: el último tema usado en este dispositivo (evita el parpadeo de colores)
(function () {
    let t = DEFAULT_THEME;
    try { t = localStorage.getItem('japon2_theme') || DEFAULT_THEME; } catch (e) {}
    applyTheme(t);
})();

function switchTab(tabId, evt) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    const target = document.getElementById(tabId);
    if (target) target.classList.add('active');
    if (evt && evt.currentTarget) {
        evt.currentTarget.classList.add('active');
    }

    if (tabId === 'gastos') {
        ensureTravelerNames();
        loadExpensesFromSheet();
    }
    if (tabId === 'transporte') {
        loadRecomendacionesFromSheet();
        setTimeout(() => {
            if (!leafletMap) initLeafletMap();
            else leafletMap.invalidateSize();
            renderTimeline();
            renderMapMarkers();
        }, 200);
    }
}

// [CAMBIO 19] Lápiz del encabezado: cambia el nombre del viaje y lo guarda en Config
async function editTripName() {
    const el = document.getElementById('trip-name');
    const actual = tripConfig.NombreViaje || (el ? el.innerText : '');
    const nuevo = prompt('Nombre del viaje:', actual);
    if (!nuevo || nuevo.trim() === '' || nuevo.trim() === actual) return;
    try {
        await saveConfigValue('NombreViaje', nuevo.trim());
        applyTripConfig();
    } catch (e) {
        alert('No se pudo guardar el nombre del viaje: ' + e.message);
    }
}

async function initApp() {
    autoDetectTripBounds();
    renderHeaderDays();
    buildGrid([]);

    fetchLiveExchangeRate();
    await loadTripConfig(); // [CAMBIO 19] nombre del viaje y viajeros desde el Sheet
    if (tripConfig.Tema) applyTheme(tripConfig.Tema); // [CAMBIO 21] tema guardado en Config
    await loadAccommodationsFromSheet();
    await loadEventsFromSheet();
    await loadRecomendacionesFromSheet();

    autoDetectTripBounds();
    renderHeaderDays();
    buildGrid(localEvents);
    scrollGridToFirstEvent(); // [CAMBIO 6]
}

document.addEventListener('DOMContentLoaded', initApp);
