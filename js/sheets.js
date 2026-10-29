// ===== sheets.js =====
// Lectura de datos desde Google Sheets (alojamientos e itinerario) y recarga completa.
// [CAMBIO 16] Cada alojamiento y evento guarda su ID (columna ID del Sheet).

async function loadAccommodationsFromSheet() {
    try {
        const res = await fetch(`${SCRIPT_URL}?sheet=Alojamiento`);
        const data = await res.json();
        if (Array.isArray(data)) {
            accommodationsData = data.map(r => {
                const id = String(r.ID || '').trim(); // [CAMBIO 16]
                const name = r.Nombre || r.title || '';
                const start = r.FechaInicio || r.CheckIn || '';
                const end = r.FechaFin || r.CheckOut || '';
                const mapUrl = r.Direccion || r.LinkReserva || '';
                const coords = r.Coords || '';
                // [CAMBIO 4] Datos extra para poder editar el alojamiento
                const direccion = r.Direccion || '';
                const city = r.Ciudad || '';
                const bookingLink = r.LinkReserva || '';
                const checkInHour = parseHourCell(r.CheckIn);
                const checkOutHour = parseHourCell(r.CheckOut);
                const detalles = r.Detalles || '';
                return { id, name, start, end, mapUrl, coords, direccion, city, bookingLink, checkInHour, checkOutHour, detalles };
            }).filter(a => a.name !== '');
        }
    } catch (e) {
        console.error("Error al cargar alojamientos:", e);
    }
}

async function loadEventsFromSheet() {
    try {
        const res = await fetch(`${SCRIPT_URL}?sheet=Itinerario`);
        const data = await res.json();

        if (Array.isArray(data)) {
            localEvents = data.map(row => {
                const id = String(row.ID || '').trim(); // [CAMBIO 16]
                const title = row.Titulo || row.title || '';
                const date = row.FechaInicio || row.Dia || '';
                const rawStart = row.HoraInicio;
                const startHour = (rawStart !== "" && rawStart !== null && rawStart !== undefined && !isNaN(parseInt(rawStart))) ? parseInt(rawStart) : null;
                const durationHours = parseInt(row.Duracion) || 1;
                const type = row.Tipo || 'actividad';
                const location = row.UbicacionInicio || row.Ubicacion || '';
                const coordsInicio = row.CoordsInicio || '';
                const coordsFin = row.CoordsFin || '';
                const cost = row.Costo || '';
                const details = row.Detalles || '';
                const bookingCode = row.CodigoReserva || '';
                const originLink = row.UbicacionInicio || '';
                const destLink = row.UbicacionFin || '';
                const endDate = row.FechaFin || date;
                const endHour = row.HoraFin !== undefined && row.HoraFin !== "" ? parseInt(row.HoraFin) : (startHour !== null ? startHour : 0);

                const medio = String(row.Medio || '').trim(); // [CAMBIO 7]

                return { id, title, date, startHour, durationHours, type, location, coordsInicio, coordsFin, cost, details, bookingCode, originLink, destLink, endDate, endHour, medio };
            }).filter(e => e.title !== '');
        }
    } catch (error) {
        console.error('Error al cargar eventos:', error);
    }
}

// [CAMBIO 1] Vuelve a leer alojamientos e itinerario desde el Sheet y redibuja todo.
// Así los datos en memoria quedan iguales al Sheet (incluidas las coordenadas).
async function reloadTripData() {
    await loadAccommodationsFromSheet();
    await loadEventsFromSheet();
    autoDetectTripBounds();
    renderHeaderDays();
    buildGrid(localEvents);
    if (leafletMap) {
        renderTimeline();
        renderMapMarkers();
    }
}
