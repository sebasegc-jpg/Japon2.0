// ===== recomendaciones.js =====
// Recomendaciones: lista, agregar, editar, eliminar y pasar al itinerario.

async function loadRecomendacionesFromSheet() {
    const container = document.getElementById('recom-container');
    try {
        const res = await fetch(`${SCRIPT_URL}?sheet=Recomendaciones`);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
            recomendationsData = data;
            container.innerHTML = data.map((item, recIdx) => {
                const title = item.Titulo || item.title || 'Recomendación';
                const tipo = item.Tipo || 'Recomendación';
                const ubicacion = item.Ubicacion || '';
                const coords = item.Coords || '';

                const targetLoc = coords || item.LinkGoogleMaps || ubicacion;
                const mapsUrl = coords ? `https://www.google.com/maps/search/?api=1&query=${coords}` : (item.LinkGoogleMaps || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ubicacion)}`);
                const routeFromHotelUrl = getHotelRouteUrl(targetLoc, item.FechaTentativa || '');

                const rawDetails = item.Detalles || '';
                const formattedBody = formatMarkdown(rawDetails);

                const safeTitle = title.replace(/'/g, "\\'");
                const safeLoc = targetLoc.replace(/'/g, "\\'");
                const safeDet = rawDetails.replace(/'/g, "\\'").replace(/\n/g, ' ');

                let mapsBtn = mapsUrl ? `<a href="${mapsUrl}" target="_blank" style="color:var(--primary); font-weight:bold; margin-right:10px;">🗺️ Ver en Maps</a>` : '';
                let hotelRouteBtn = targetLoc ? `<a href="${routeFromHotelUrl}" target="_blank" style="background:#0284c7; color:white; padding:4px 8px; border-radius:4px; font-weight:bold; text-decoration:none; margin-right:10px;">🚗 Ruta desde Hotel</a>` : '';

                return `
                    <details class="compact-item">
                        <summary class="compact-summary">
                            <span class="summary-title">📍 ${title} (${tipo})</span>
                            <span class="summary-badge">Ver detalle</span>
                        </summary>
                        <div class="compact-content">
                            ${formattedBody}
                            <div style="margin-top:0.8rem; display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
                                ${mapsBtn}
                                ${hotelRouteBtn}
                                <button onclick="promoteToItinerary('${safeTitle}', '${safeLoc}', '${safeDet}')" style="background:var(--primary); color:white; border:none; padding:4px 8px; border-radius:4px; font-weight:bold; cursor:pointer;">
                                    ➕ Pasar al Itinerario
                                </button>
                                <!-- [CAMBIO 10] Editar / Eliminar recomendación -->
                                <button onclick="editRecom(${recIdx})" style="background:#0284c7; color:white; border:none; padding:4px 8px; border-radius:4px; font-weight:bold; cursor:pointer;">
                                    ✏️ Editar
                                </button>
                                <button onclick="deleteRecom(${recIdx})" style="background:#ef4444; color:white; border:none; padding:4px 8px; border-radius:4px; font-weight:bold; cursor:pointer;">
                                    🗑 Eliminar
                                </button>
                            </div>
                        </div>
                    </details>
                `;
            }).join('');
        } else {
            container.innerHTML = `<p style="color:var(--text-muted);">No hay recomendaciones guardadas en Sheets aún.</p>`;
        }
    } catch(e) {
        container.innerHTML = `<p style="color:var(--text-muted);">Error al cargar recomendaciones.</p>`;
    }
}

function openAddRecomModal() {
    // [CAMBIO 10] Formulario limpio en modo "agregar"
    document.getElementById('recomForm').reset();
    document.getElementById('rec-old-title').value = '';
    document.getElementById('recomModalTitle').innerText = '➕ Agregar Nueva Recomendación / Lugar';
    document.getElementById('recomModal').style.display = 'flex';
}

// [CAMBIO 10] Abre el formulario cargado con los datos de la recomendación
function editRecom(idx) {
    const rec = recomendationsData[idx];
    if (!rec) return;
    const title = rec.Titulo || rec.title || '';

    document.getElementById('recomForm').reset();
    document.getElementById('recomModalTitle').innerText = '✏️ Editar Recomendación';
    document.getElementById('rec-old-title').value = title;
    document.getElementById('rec-title').value = title;

    // Si el tipo guardado no está en la lista, se agrega para no perderlo
    const typeSel = document.getElementById('rec-type');
    const tipo = rec.Tipo || '';
    if (tipo && !Array.from(typeSel.options).some(o => o.value === tipo)) {
        typeSel.add(new Option(tipo, tipo));
    }
    if (tipo) typeSel.value = tipo;

    document.getElementById('rec-date').value = rec.FechaTentativa ? formatDateToISO(parseDateStr(rec.FechaTentativa)) : '';
    document.getElementById('rec-location').value = rec.Ubicacion || '';
    // Si no tiene link pero sí coordenadas (cargadas a mano), se usan las coordenadas
    // para que al guardar no se pierdan.
    document.getElementById('rec-link').value = rec.LinkGoogleMaps || rec.Coords || '';
    document.getElementById('rec-details').value = rec.Detalles || '';

    document.getElementById('recomModal').style.display = 'flex';
}

// [CAMBIO 10] Elimina la recomendación y recarga la lista y el mapa
async function deleteRecom(idx) {
    const rec = recomendationsData[idx];
    if (!rec) return;
    const title = rec.Titulo || rec.title || '';
    if (!confirm(`¿Seguro que querés eliminar la recomendación "${title}"?`)) return;

    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'delete', sheet: 'Recomendaciones', title: title })
        });
        const msg = await res.text();
        if (msg.startsWith('Error')) throw new Error(msg);
        await loadRecomendacionesFromSheet();
        if (leafletMap) renderMapMarkers();
    } catch (err) {
        alert('No se pudo eliminar la recomendación: ' + err.message);
    }
}

// [CAMBIO 10] Guarda (nueva o editada), espera al Sheet y recarga lista y mapa
async function saveRecomForm(e) {
    e.preventDefault();
    const recomData = {
        sheet: 'Recomendaciones',
        Titulo: document.getElementById('rec-title').value,
        Tipo: document.getElementById('rec-type').value,
        FechaTentativa: formatDateStandard(document.getElementById('rec-date').value),
        Ubicacion: document.getElementById('rec-location').value,
        LinkGoogleMaps: document.getElementById('rec-link').value,
        Detalles: document.getElementById('rec-details').value,
        oldTitle: document.getElementById('rec-old-title').value
    };

    const submitBtn = e.submitter || document.querySelector('#recomForm button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerText : '';
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = '⏳ Guardando...'; }

    try {
        const res = await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify(recomData) });
        const msg = await res.text();
        if (msg.startsWith('Error')) throw new Error(msg);

        await loadRecomendacionesFromSheet();
        if (leafletMap) renderMapMarkers();
        closeModal('recomModal');
        document.getElementById('recomForm').reset();
        document.getElementById('rec-old-title').value = '';
    } catch (err) {
        alert('No se pudo guardar la recomendación: ' + err.message);
    } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = originalBtnText; }
    }
}

function promoteToItinerary(title, location, details) {
    openAddModal();
    document.getElementById('ev-title').value = title;
    document.getElementById('ev-location').value = location;
    document.getElementById('ev-details').value = details;
}
