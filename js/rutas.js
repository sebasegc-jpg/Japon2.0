// ===== rutas.js =====
// Medios de transporte, hoteles por noche, escalas y "Cómo llegar" (links de Google Maps).

// ===== [CAMBIO 7] MEDIOS DE TRANSPORTE, HOTELES POR NOCHE Y RUTAS =====

const MEDIO_ICONS = {
    'Avión': '✈️', 'Tren': '🚄', 'Colectivo': '🚌', 'Subte/Metro': '🚇', 'Uber/Auto': '🚕',
    'Barco': '🚢', 'Ferry': '⛴️', 'Bicicleta': '🚲', 'A pie': '🚶'
};
// Modo de Google Maps para el recorrido del trayecto (null = no tiene sentido, ej. avión)
const MEDIO_TRAVELMODE = {
    'Avión': null, 'Barco': null, 'Ferry': null,
    'Tren': 'transit', 'Colectivo': 'transit', 'Subte/Metro': 'transit',
    'Uber/Auto': 'driving', 'Bicicleta': 'bicycling', 'A pie': 'walking'
};

// Medio de un evento. Si está vacío y el título dice "vuelo", se toma como Avión.
function getMedio(ev) {
    if (!ev || ev.type !== 'transporte') return '';
    if (ev.medio && MEDIO_ICONS[ev.medio] !== undefined) return ev.medio;
    if (/vuelo/i.test(ev.title || '')) return 'Avión';
    return '';
}

function getEventIcon(ev) {
    if (ev.type === 'transporte') return MEDIO_ICONS[getMedio(ev)] || '🚌';
    if (ev.type === 'show') return '🎸';
    if (ev.type === 'sleep') return '🏨';
    return '📍';
}

// Hotel donde dormiste la noche ANTERIOR a esta fecha (check-in antes de hoy, check-out hoy o después)
function getHotelSleptBefore(dateStr) {
    const t = parseDateStr(dateStr);
    if (!t) return null;
    const td = dayOnly(t);
    return accommodationsData.find(a => {
        const s = parseDateStr(a.start), e = parseDateStr(a.end);
        return s && e && dayOnly(s) < td && dayOnly(e) >= td;
    }) || null;
}

// Hotel donde dormís la noche de esta fecha (check-in hoy o antes, check-out después de hoy)
function getHotelSleepingOn(dateStr) {
    const t = parseDateStr(dateStr);
    if (!t) return null;
    const td = dayOnly(t);
    return accommodationsData.find(a => {
        const s = parseDateStr(a.start), e = parseDateStr(a.end);
        return s && e && dayOnly(s) <= td && dayOnly(e) > td;
    }) || null;
}

// Link de Google Maps con origen y destino en coordenadas
function buildDirectionsUrl(origin, destination, mode) {
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=${mode || 'transit'}`;
}

// Tramos con el mismo código de reserva (vuelos con escala), ordenados por fecha y hora
function getTicketLegs(ev) {
    const code = String(ev.bookingCode || '').trim().toLowerCase();
    if (!code) return [ev];
    const legs = localEvents.filter(e => e.type === 'transporte' && String(e.bookingCode || '').trim().toLowerCase() === code);
    const sortKey = e => { const d = parseDateStr(e.date); return (d ? d.getTime() : 0) + (e.startHour || 0) * 3600000; };
    legs.sort((a, b) => sortKey(a) - sortKey(b));
    return legs.length > 0 ? legs : [ev];
}

function routeButton(url, label, color) {
    return `<a href="${url}" target="_blank" style="display:inline-block; background:${color}; color:white; padding:6px 10px; border-radius:4px; font-weight:bold; text-decoration:none; font-size:0.78rem;">${label}</a>`;
}

// Lo que pasó justo antes de este evento, el mismo día.
// Devuelve { label, coords } o null. Si fue un transporte, toma su punto de llegada.
function getPreviousStop(ev) {
    if (ev.startHour === null) return null;
    let best = null, bestHour = -1;
    localEvents.forEach(e => {
        if (e === ev || e.type === 'sleep') return;
        if (e.type === 'transporte') {
            const arrDate = e.endDate || e.date;
            const arrHour = (e.endHour !== null && e.endHour !== undefined && !isNaN(e.endHour)) ? e.endHour : e.startHour;
            if (arrHour === null || !sameDay(arrDate, ev.date) || arrHour > ev.startHour) return;
            if (arrHour >= bestHour && e.coordsFin) {
                bestHour = arrHour;
                best = { label: `${getEventIcon(e)} llegada de "${e.title}"`, coords: e.coordsFin, isTransport: true };
            }
        } else {
            if (e.startHour === null || !sameDay(e.date, ev.date) || e.startHour >= ev.startHour) return;
            if (e.startHour >= bestHour && e.coordsInicio) {
                bestHour = e.startHour;
                best = { label: `${getEventIcon(e)} ${e.title}`, coords: e.coordsInicio, isTransport: false };
            }
        }
    });
    return best;
}

// ¿Hubo un transporte que llegó este día antes del evento? (para saber si ya cambiaste de hotel)
function arrivedByTransportToday(ev) {
    return localEvents.some(e => e.type === 'transporte' && sameDay(e.endDate || e.date, ev.date) &&
        (ev.startHour === null || (e.endHour !== null && e.endHour <= ev.startHour)));
}

// Alojamiento "de referencia" para ese momento del día
function getHotelForEvent(ev) {
    const before = getHotelSleptBefore(ev.date);
    const tonight = getHotelSleepingOn(ev.date);
    if (arrivedByTransportToday(ev)) return tonight || before;
    return before || tonight;
}

// ¿Es lo último del día? (no hay otro evento ni transporte más tarde ese mismo día)
function isLastOfDay(ev) {
    if (ev.startHour === null) return false;
    return !localEvents.some(e => e !== ev && e.type !== 'sleep' && e.startHour !== null &&
        sameDay(e.date, ev.date) && e.startHour > ev.startHour);
}

// Todos los lugares guardados con coordenadas, para el desplegable "Otro lugar"
function buildPlacesOptions(excludeCoords) {
    let html = '<option value="">-- Elegir otro lugar guardado --</option>';
    const seen = new Set([excludeCoords]);
    const add = (coords, label) => {
        if (!coords || seen.has(coords)) return;
        seen.add(coords);
        html += `<option value="${coords}">${label}</option>`;
    };
    html += '<optgroup label="🏨 Alojamientos">';
    accommodationsData.forEach(a => add(a.coords, `🏨 ${a.name}`));
    html += '</optgroup><optgroup label="📅 Itinerario">';
    localEvents.forEach(e => {
        if (e.type === 'sleep') return;
        if (e.type === 'transporte') {
            add(e.coordsInicio, `${getEventIcon(e)} ${e.title} (salida)`);
            add(e.coordsFin, `${getEventIcon(e)} ${e.title} (llegada)`);
        } else {
            add(e.coordsInicio, `${getEventIcon(e)} ${e.title}`);
        }
    });
    html += '</optgroup><optgroup label="💡 Recomendaciones">';
    recomendationsData.forEach(r => add(r.Coords, `💡 ${r.Titulo || r.title || ''}`));
    html += '</optgroup>';
    return html;
}

// Abre la ruta desde el lugar elegido en el desplegable
function openRouteFromSelect(destCoords) {
    const sel = document.getElementById('route-origin-select');
    if (!sel || !sel.value) { alert('Elegí un lugar de salida.'); return; }
    window.open(buildDirectionsUrl(sel.value, destCoords, 'transit'), '_blank');
}

// Arma la sección "Cómo llegar" de una actividad o show
function buildHowToGetThereHTML(ev) {
    const dest = ev.coordsInicio;
    const box = inner => `<div style="margin: 0.8rem 0; padding: 0.8rem; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; font-size: 0.85rem;">
        <p style="font-weight:bold; color:#1e40af; margin-bottom:6px;">🧭 Cómo llegar:</p>${inner}</div>`;

    if (!dest) {
        return box(`<p style="color:#b45309;">Este evento no tiene coordenadas. Editalo y pegá un link de Google Maps para ver rutas.</p>`);
    }

    const btns = [];
    const prev = getPreviousStop(ev);
    if (prev && prev.coords !== dest) {
        btns.push(routeButton(buildDirectionsUrl(prev.coords, dest, 'transit'), `Desde ${prev.label}`, '#16a34a'));
    }
    const hotel = getHotelForEvent(ev);
    if (hotel && hotel.coords && hotel.coords !== dest) {
        btns.push(routeButton(buildDirectionsUrl(hotel.coords, dest, 'transit'), `🏨 Desde ${hotel.name}`, '#2563eb'));
    }

    let backHTML = '';
    if (isLastOfDay(ev)) {
        const tonight = getHotelSleepingOn(ev.date);
        if (tonight && tonight.coords && tonight.coords !== dest) {
            backHTML = `<div style="margin-top:8px;">${routeButton(buildDirectionsUrl(dest, tonight.coords, 'transit'), `🌙 Volver a ${tonight.name}`, '#7c3aed')}</div>`;
        }
    }

    const quick = btns.length > 0
        ? `<div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px;">${btns.join('')}</div>`
        : '';

    const other = `<div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
            <select id="route-origin-select" style="flex:1; min-width:180px; padding:0.35rem; border:1px solid var(--border); border-radius:4px; font-size:0.8rem;">${buildPlacesOptions(dest)}</select>
            <button onclick="openRouteFromSelect('${dest}')" style="background:#0284c7; color:white; border:none; padding:6px 10px; border-radius:4px; font-weight:bold; font-size:0.78rem; cursor:pointer;">🧭 Abrir ruta</button>
        </div>`;

    return box(quick + other + backHTML);
}

function getHotelForDate(dateStr) {
    if (!accommodationsData || accommodationsData.length === 0) return null;
    let targetObj = parseDateStr(dateStr);
    if (!targetObj) return accommodationsData[0];

    let found = accommodationsData.find(a => {
        let sObj = parseDateStr(a.start);
        let eObj = parseDateStr(a.end);
        if (!sObj || !eObj) return false;
        let t = new Date(targetObj.getFullYear(), targetObj.getMonth(), targetObj.getDate());
        let s = new Date(sObj.getFullYear(), sObj.getMonth(), sObj.getDate());
        let e = new Date(eObj.getFullYear(), eObj.getMonth(), eObj.getDate());
        return t >= s && t <= e;
    });

    return found || accommodationsData[0];
}

function getHotelRouteUrl(destAddressOrCoords, targetDateStr) {
    let hotel = getHotelForDate(targetDateStr);
    let origin = (hotel && hotel.coords) ? hotel.coords : (hotel ? (hotel.mapUrl || hotel.name) : 'Buenos Aires');
    let destination = destAddressOrCoords || 'Buenos Aires';
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=transit`;
}
