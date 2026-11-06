// ===== app.js =====
// Arranque de la aplicación y cambio de pestañas. Es el último archivo que se carga.

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
    await loadAccommodationsFromSheet();
    await loadEventsFromSheet();
    await loadRecomendacionesFromSheet();

    autoDetectTripBounds();
    renderHeaderDays();
    buildGrid(localEvents);
    scrollGridToFirstEvent(); // [CAMBIO 6]
}

document.addEventListener('DOMContentLoaded', initApp);
