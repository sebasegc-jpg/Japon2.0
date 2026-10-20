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

async function initApp() {
    autoDetectTripBounds();
    renderHeaderDays();
    buildGrid([]);

    fetchLiveExchangeRate();
    await loadAccommodationsFromSheet();
    await loadEventsFromSheet();
    await loadRecomendacionesFromSheet();

    autoDetectTripBounds();
    renderHeaderDays();
    buildGrid(localEvents);
    scrollGridToFirstEvent(); // [CAMBIO 6]
}

document.addEventListener('DOMContentLoaded', initApp);
