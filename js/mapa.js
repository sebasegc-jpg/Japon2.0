// ===== mapa.js =====
// Pestaña Mapa: Leaflet, pines, trayectos, filtros y cronología del viaje.

function renderTimeline() {
    const container = document.getElementById('timeline-list');
    if (!container) return;

    let combined = [];

    accommodationsData.forEach(a => {
        let dObj = parseDateStr(a.start);
        let timeSort = dObj ? dObj.getTime() : 0;
        let targetLoc = a.coords || a.mapUrl || a.name;
        let link = a.coords ? `https://www.google.com/maps/search/?api=1&query=${a.coords}` : (a.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.name)}`);

        combined.push({
            type: 'hotel',
            title: a.name,
            dateStr: formatDateStandard(a.start),
            sortValue: timeSort,
            details: `Hotel verificado hasta ${formatDateStandard(a.end)}`,
            link: link
        });
    });

    localEvents.forEach(e => {
        let dObj = parseDateStr(e.date);
        let hourOffset = (e.startHour !== null ? parseInt(e.startHour) : 0) * 3600000;
        let timeSort = dObj ? (dObj.getTime() + hourOffset) : 0;

        let targetLoc = e.coordsInicio || e.location || e.originLink || e.destLink || e.title;
        let link = e.coordsInicio ? `https://www.google.com/maps/search/?api=1&query=${e.coordsInicio}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(targetLoc)}`;
        let timeStr = e.startHour !== null ? `${e.startHour}:00 hs` : 'Hora pendiente';

        combined.push({
            type: e.type,
            icon: getEventIcon(e), // [CAMBIO 7]
            title: e.title,
            dateStr: formatDateStandard(e.date),
            sortValue: timeSort,
            details: `${timeStr} | ${e.details || ''}`,
            link: link
        });
    });

    combined.sort((a, b) => a.sortValue - b.sortValue);

    container.innerHTML = combined.map(item => {
        let icon = item.icon || (item.type === 'hotel' ? '🏨' : '📍'); // [CAMBIO 7]
        let mapsBtn = `<a href="${item.link}" target="_blank" style="color:var(--primary); font-weight:bold; font-size:0.75rem;">🗺 Abrir en Maps</a>`;

        return `
            <div class="timeline-item">
                <div class="timeline-date">${item.dateStr}</div>
                <h5>${icon} ${item.title}</h5>
                <p style="color:var(--text-muted); font-size:0.75rem; margin-bottom:4px;">${item.details}</p>
                ${mapsBtn}
            </div>`;
    }).join('');
}

function initLeafletMap() {
    if (leafletMap) return;

    leafletMap = L.map('leaflet-map').setView([-34.6037, -58.4100], 12);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri'
    }).addTo(leafletMap);

    // DIBUJAR LÍNEAS DE SUBTE
    for (let lineKey in SUBWAY_LINES) {
        let line = SUBWAY_LINES[lineKey];
        let poly = L.polyline(line.coords, { color: line.color, weight: 4, opacity: 0.8 }).addTo(leafletMap);
        poly.bindPopup(`<b>${lineKey}</b>`);
        mapSubwayLayers.push(poly);
    }

    // MARCADORES NODALES DE SUBTE
    SUBWAY_NODES.forEach(node => {
        let nodeMarker = L.circleMarker(node.coords, { radius: 5, fillColor: "#1e293b", color: "#ffffff", weight: 2, fillOpacity: 0.9 }).addTo(leafletMap);
        nodeMarker.bindPopup(`<b>🚇 Estación / Nodo Subte:</b> ${node.name}`);
        mapSubwayLayers.push(nodeMarker);
    });

    renderMapMarkers();
}

// [CAMBIO 8] Lee coordenadas "lat,lng". Ya NO busca por nombre en Nominatim:
// si un lugar no tiene coordenadas, no se dibuja y se avisa.
function parseCoords(text) {
    if (!text) return null;
    const m = String(text).trim().match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
    return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
}

function popupBtn(url, label, color) {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="display:inline-block; background:${color}; color:white; padding:4px 8px; border-radius:4px; text-decoration:none; font-size:0.75rem; font-weight:bold;">${label}</a>`;
}

function showMissingWarning(missing) {
    const box = document.getElementById('map-missing-warning');
    if (!box) return;
    if (missing.length === 0) {
        box.style.display = 'none';
        box.innerHTML = '';
        return;
    }
    box.style.display = 'block';
    box.innerHTML = `⚠️ <b>${missing.length} lugar(es) sin ubicar en el mapa:</b> ${missing.join(', ')}.<br>
        Para ubicarlos: abrí el evento o alojamiento → <b>Editar</b> → pegá un link de Google Maps → <b>Guardar</b>. En recomendaciones, completá <b>Coords</b> en el Sheet.`;
}

// [CAMBIO 7 + 8] Dibuja los pines solo con coordenadas guardadas.
// Transportes: pin de salida y de llegada unidos por línea punteada.
function renderMapMarkers(categoryFilter = currentMapFilter) {
    if (!leafletMap) return;

    mapMarkers.forEach(m => leafletMap.removeLayer(m));
    mapMarkers = [];
    const missing = [];

    // 1. ALOJAMIENTOS
    if (categoryFilter === 'all' || categoryFilter === 'hotel') {
        for (const acc of accommodationsData) {
            const coords = parseCoords(acc.coords);
            if (!coords) { missing.push(`🏨 ${acc.name}`); continue; }
            const marker = L.marker(coords).addTo(leafletMap);
            marker.bindPopup(`
                <div style="font-family:Inter, sans-serif;">
                    <h4 style="margin:0 0 4px 0; color:#1e40af;">🏨 ${acc.name}</h4>
                    <p style="font-size:0.8rem; color:#475569; margin-bottom:8px;">Alojamiento (${acc.start} - ${acc.end})</p>
                    ${popupBtn(`https://www.google.com/maps/search/?api=1&query=${acc.coords}`, '🧭 Abrir en Google Maps', '#2563eb')}
                </div>
            `);
            mapMarkers.push(marker);
        }
    }

    // 2. ITINERARIO
    if (categoryFilter === 'all' || categoryFilter === 'itinerario') {
        for (const ev of localEvents) {
            if (ev.type === 'sleep') continue;
            const icon = getEventIcon(ev);
            const when = `${ev.date} (${ev.startHour !== null ? ev.startHour + ':00hs' : 'Pendiente'})`;

            if (ev.type === 'transporte') {
                const start = parseCoords(ev.coordsInicio);
                const end = parseCoords(ev.coordsFin);
                if (!start && !end) { missing.push(`${icon} ${ev.title}`); continue; }

                if (start) {
                    const m1 = L.marker(start).addTo(leafletMap);
                    m1.bindPopup(`
                        <div style="font-family:Inter, sans-serif;">
                            <h4 style="margin:0 0 4px 0; color:#1e293b;">${icon} ${ev.title}</h4>
                            <p style="font-size:0.8rem; color:#475569; margin-bottom:8px;">🛫 Salida · ${when}</p>
                            ${popupBtn(`https://www.google.com/maps/search/?api=1&query=${ev.coordsInicio}`, '🧭 Abrir en Maps', '#2563eb')}
                        </div>
                    `);
                    mapMarkers.push(m1);
                }
                if (end) {
                    const m2 = L.marker(end).addTo(leafletMap);
                    m2.bindPopup(`
                        <div style="font-family:Inter, sans-serif;">
                            <h4 style="margin:0 0 4px 0; color:#1e293b;">${icon} ${ev.title}</h4>
                            <p style="font-size:0.8rem; color:#475569; margin-bottom:8px;">🛬 Llegada · ${ev.endDate || ev.date} (${ev.endHour !== null && ev.endHour !== undefined ? ev.endHour + ':00hs' : ''})</p>
                            ${popupBtn(`https://www.google.com/maps/search/?api=1&query=${ev.coordsFin}`, '🧭 Abrir en Maps', '#2563eb')}
                        </div>
                    `);
                    mapMarkers.push(m2);
                }
                if (start && end && showTripLines) { // [CAMBIO 9]
                    const line = L.polyline([start, end], { color: '#16a34a', weight: 3, opacity: 0.8, dashArray: '8, 8' }).addTo(leafletMap);
                    line.bindPopup(`<b>${icon} ${ev.title}</b><br>${when}`);
                    mapMarkers.push(line);
                }
                continue;
            }

            const coords = parseCoords(ev.coordsInicio);
            if (!coords) { missing.push(`${icon} ${ev.title}`); continue; }
            const marker = L.marker(coords).addTo(leafletMap);
            const routeFromHotelUrl = getHotelRouteUrl(ev.coordsInicio, ev.date);
            marker.bindPopup(`
                <div style="font-family:Inter, sans-serif;">
                    <h4 style="margin:0 0 4px 0; color:#1e293b;">${icon} ${ev.title}</h4>
                    <p style="font-size:0.8rem; color:#475569; margin-bottom:8px;">${when}</p>
                    <div style="display:flex; gap:4px; flex-wrap:wrap;">
                        ${popupBtn(`https://www.google.com/maps/search/?api=1&query=${ev.coordsInicio}`, '🧭 Abrir en Maps', '#2563eb')}
                        ${popupBtn(routeFromHotelUrl, '🚗 Ruta desde Hotel', '#0284c7')}
                    </div>
                </div>
            `);
            mapMarkers.push(marker);
        }
    }

    // 3. RECOMENDACIONES
    if (categoryFilter === 'all' || categoryFilter === 'recom') {
        for (const rec of recomendationsData) {
            const title = rec.Titulo || rec.title || 'Recomendación';
            const coords = parseCoords(rec.Coords);
            if (!coords) { missing.push(`💡 ${title}`); continue; }
            const marker = L.marker(coords).addTo(leafletMap);
            const routeFromHotelUrl = getHotelRouteUrl(rec.Coords, rec.FechaTentativa || '');
            marker.bindPopup(`
                <div style="font-family:Inter, sans-serif;">
                    <h4 style="margin:0 0 4px 0; color:#0284c7;">💡 ${title}</h4>
                    <p style="font-size:0.8rem; color:#475569; margin-bottom:8px;">${rec.Tipo || 'Recomendación'}</p>
                    <div style="display:flex; gap:4px; flex-wrap:wrap;">
                        ${popupBtn(`https://www.google.com/maps/search/?api=1&query=${rec.Coords}`, '🧭 Abrir en Maps', '#0284c7')}
                        ${popupBtn(routeFromHotelUrl, '🚗 Ruta desde Hotel', '#2563eb')}
                    </div>
                </div>
            `);
            mapMarkers.push(marker);
        }
    }

    showMissingWarning(missing);
}

function filterMapMarkers(cat, evt) {
    if (!leafletMap) initLeafletMap();
    // [CAMBIO 9] el botón Trayectos no se apaga al cambiar de filtro
    document.querySelectorAll('.zone-filters .filter-btn:not(.trip-toggle)').forEach(btn => btn.classList.remove('active'));
    if (evt && evt.currentTarget) evt.currentTarget.classList.add('active');
    currentMapFilter = cat;
    renderMapMarkers(cat);
}

// [CAMBIO 9] Prende/apaga las líneas de salida → llegada de los transportes
function toggleTripLines(evt) {
    if (!leafletMap) initLeafletMap();
    showTripLines = !showTripLines;
    if (evt && evt.currentTarget) evt.currentTarget.classList.toggle('active', showTripLines);
    renderMapMarkers();
}
