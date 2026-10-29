// ===== itinerario.js =====
// Pestaña Itinerario: semanas, grilla horaria, detalle de eventos, formulario y guardado.
// [CAMBIO 16] Eventos y alojamientos se buscan, editan y borran por su ID.

let editingEventID = ''; // [CAMBIO 16] ID del evento que se está editando ('' = nuevo)

// [CAMBIO 16] Busca un evento. Con un solo dato es un ID; con tres, es la forma vieja (título, fecha, hora).
function findEvent(key, date, startHour) {
    if (date === undefined) {
        return localEvents.find(e => e.id && e.id === key) || null;
    }
    return localEvents.find(e => e.title === key && e.date === date &&
        (startHour === undefined || e.startHour === startHour)) || null;
}

// [CAMBIO 16] Busca un alojamiento por ID (o por nombre, como respaldo)
function findAccommodation(key) {
    return accommodationsData.find(a => a.id && a.id === key) ||
           accommodationsData.find(a => a.name === key) || null;
}

// [CAMBIO 16] Texto que va dentro de los onclick para identificar un evento:
// el ID si lo tiene; si no, título + fecha + hora (forma vieja).
function eventKeyArgs(ev) {
    if (ev.id) return `'${String(ev.id).replace(/'/g, "\\'")}'`;
    return `'${String(ev.title).replace(/'/g, "\\'")}', '${ev.date}', ${ev.startHour}`;
}

function calculateDuration() {
    const startDateVal = document.getElementById('ev-date').value;
    const startHourVal = parseInt(document.getElementById('ev-hour').value) || 0;
    let endDateVal = document.getElementById('ev-end-date').value || startDateVal;
    let endHourVal = parseInt(document.getElementById('ev-end-hour').value);

    if (isNaN(endHourVal)) endHourVal = startHourVal + 2;

    if (startDateVal && endDateVal) {
        const start = new Date(`${startDateVal}T${startHourVal.toString().padStart(2, '0')}:00:00`);
        const end = new Date(`${endDateVal}T${endHourVal.toString().padStart(2, '0')}:00:00`);

        const diffMs = end - start;
        if (diffMs > 0) {
            const diffHours = Math.round(diffMs / (1000 * 60 * 60));
            document.getElementById('ev-duration').value = diffHours;
        }
    }
}

function setWeek(weekNum) {
    currentWeek = weekNum;
    document.querySelectorAll('.week-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', idx === weekNum - 1);
    });
    renderHeaderDays();
    buildGrid(localEvents);
    scrollGridToFirstEvent(); // [CAMBIO 6]
}

// [CAMBIO 6] En celular, ubica la grilla en la hora del primer evento de la semana (o a las 8:00)
function scrollGridToFirstEvent() {
    if (!window.matchMedia('(max-width: 768px)').matches) return;
    const container = document.querySelector('.schedule-grid-container');
    const tbody = document.getElementById('grid-body');
    if (!container || !tbody || tbody.rows.length === 0) return;

    const weekISO = getDatesForCurrentWeek().map(d => formatDateToISO(d));
    let firstHour = null;
    localEvents.forEach(e => {
        if (e.startHour === null || e.startHour < 0 || e.startHour > 23) return;
        const d = parseDateStr(e.date);
        if (!d || !weekISO.includes(formatDateToISO(d))) return;
        if (firstHour === null || e.startHour < firstHour) firstHour = e.startHour;
    });
    if (firstHour === null) firstHour = 8;

    const targetRow = tbody.rows[firstHour];
    if (!targetRow) return;
    const thead = container.querySelector('thead');
    const headerH = thead ? thead.offsetHeight : 0;

    container.scrollTop = 0;
    const offset = targetRow.getBoundingClientRect().top - container.getBoundingClientRect().top - headerH;
    container.scrollTop = Math.max(0, offset);
}

function autoDetectTripBounds() {
    let allDates = [];
    localEvents.forEach(e => { let d = parseDateStr(e.date); if (d && !isNaN(d.getTime())) allDates.push(d); });
    accommodationsData.forEach(a => {
        let d1 = parseDateStr(a.start); if (d1 && !isNaN(d1.getTime())) allDates.push(d1);
        let d2 = parseDateStr(a.end); if (d2 && !isNaN(d2.getTime())) allDates.push(d2);
    });

    if (allDates.length > 0) {
        allDates.sort((a, b) => a - b);
        let earliest = new Date(allDates[0]);
        let latest = new Date(allDates[allDates.length - 1]);

        let dayIdx = (earliest.getDay() + 6) % 7;
        earliest.setDate(earliest.getDate() - dayIdx);
        START_DATE = earliest;

        let diffDays = Math.ceil((latest - earliest) / (1000 * 60 * 60 * 24)) + 1;
        totalWeeks = Math.max(1, Math.min(12, Math.ceil(diffDays / 7)));
    } else {
        let today = new Date();
        let dayIdx = (today.getDay() + 6) % 7;
        today.setDate(today.getDate() - dayIdx);
        START_DATE = today;
        totalWeeks = 2;
    }

    renderWeekButtons();
}

function renderWeekButtons() {
    const container = document.getElementById('week-selector-container');
    if (!container) return;

    let html = `<span style="font-size:0.85rem; font-weight:600;">Semana:</span>`;
    for (let w = 1; w <= totalWeeks; w++) {
        let wStart = new Date(START_DATE);
        wStart.setDate(wStart.getDate() + (w - 1) * 7);
        let wEnd = new Date(wStart);
        wEnd.setDate(wEnd.getDate() + 6);

        let labelStart = `${wStart.getDate().toString().padStart(2,'0')}/${(wStart.getMonth()+1).toString().padStart(2,'0')}`;
        let labelEnd = `${wEnd.getDate().toString().padStart(2,'0')}/${(wEnd.getMonth()+1).toString().padStart(2,'0')}`;

        let activeClass = (w === currentWeek) ? 'active' : '';
        // [CAMBIO 6] Texto largo para PC y corto para celular (el CSS decide cuál se ve)
        html += `<button class="week-btn ${activeClass}" onclick="setWeek(${w})"><span class="week-label-long">Semana ${w} (${labelStart} - ${labelEnd})</span><span class="week-label-short">S${w} · ${labelStart}–${labelEnd}</span></button>`;
    }
    container.innerHTML = html;
}

function getDatesForCurrentWeek() {
    if (!START_DATE) autoDetectTripBounds();
    let dates = [];
    let startOffset = (currentWeek - 1) * 7;
    for (let i = 0; i < 7; i++) {
        let d = new Date(START_DATE);
        d.setDate(d.getDate() + startOffset + i);
        dates.push(d);
    }
    return dates;
}

function populateLocationSelects() {
    const selects = ['ev-location-select', 'ev-origin-select', 'ev-dest-select'];
    let optionsHTML = `<option value="">-- Seleccionar de mis Lugares Guardados --</option>`;

    if (accommodationsData.length > 0) {
        optionsHTML += `<optgroup label="🏨 Alojamientos">`;
        accommodationsData.forEach(a => {
            let val = a.coords || a.mapUrl || a.name;
            optionsHTML += `<option value="${val}">🏨 ${a.name}</option>`;
        });
        optionsHTML += `</optgroup>`;
    }

    if (localEvents.length > 0) {
        optionsHTML += `<optgroup label="📅 Eventos / Lugares">`;
        let added = new Set();
        localEvents.forEach(e => {
            let loc = e.coordsInicio || e.location || e.title;
            if (loc && !added.has(loc)) {
                added.add(loc);
                optionsHTML += `<option value="${loc}">📍 ${e.title}</option>`;
            }
        });
        optionsHTML += `</optgroup>`;
    }

    if (recomendationsData.length > 0) {
        optionsHTML += `<optgroup label="💡 Recomendaciones Guardadas">`;
        recomendationsData.forEach(r => {
            let title = r.Titulo || r.title;
            let val = r.Coords || r.LinkGoogleMaps || r.Ubicacion || title;
            optionsHTML += `<option value="${val}">💡 ${title}</option>`;
        });
        optionsHTML += `</optgroup>`;
    }

    selects.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = optionsHTML;
    });
}

function handleLocationSelectChange(selectId, inputId) {
    const sel = document.getElementById(selectId);
    const inp = document.getElementById(inputId);
    if (sel && inp && sel.value) {
        inp.value = sel.value;
    }
}

function renderHeaderDays() {
    const headerRow = document.getElementById('table-header-days');
    if (!headerRow) return;
    const dates = getDatesForCurrentWeek();
    const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    let html = `<th class="time-col">Hora</th>`;
    dates.forEach(d => {
        let dayIdx = (d.getDay() + 6) % 7;
        let formattedDate = `${dayNames[dayIdx]} ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;

        let acc = accommodationsData.find(a => {
            let startObj = parseDateStr(a.start);
            let endObj = parseDateStr(a.end);
            if (!startObj || !endObj) return false;

            let target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            let s = new Date(startObj.getFullYear(), startObj.getMonth(), startObj.getDate());
            let e = new Date(endObj.getFullYear(), endObj.getMonth(), endObj.getDate());
            return target >= s && target <= e;
        });

        let stayHTML = '<div class="day-stay">Sin asignar</div>';
        if (acc) {
            const safeKey = String(acc.id || acc.name).replace(/'/g, "\\'"); // [CAMBIO 16]
            stayHTML = `<div class="day-stay" onclick="showModalByTitle('${safeKey}')">🏨 ${acc.name}</div>`;
        }

        html += `<th><div class="day-header"><div class="day-date">${formattedDate}</div>${stayHTML}</div></th>`;
    });
    headerRow.innerHTML = html;
}

function renderPendingEvents(pendingEvents) {
    const container = document.getElementById('pending-container');
    const list = document.getElementById('pending-grid-list');
    if (!container || !list) return;

    if (pendingEvents.length === 0) {
        container.style.display = 'none';
        list.innerHTML = '';
        return;
    }

    container.style.display = 'block';
    list.innerHTML = pendingEvents.map(ev => {
        return `
            <div class="pending-card">
                <div class="pending-title">📍 ${ev.title}</div>
                <div class="pending-meta">Fecha: ${ev.date || 'Sin fecha'} | Hora: Pendiente</div>
                <button class="pending-btn" onclick="editPendingEvent(${eventKeyArgs(ev)})">
                    ✏️ Asignar Hora / Editar
                </button>
            </div>
        `;
    }).join('');
}

// [CAMBIO 16] Recibe el ID (o la forma vieja: título, fecha, hora)
function editPendingEvent(key, date, startHour) {
    const ev = findEvent(key, date, startHour);
    if (!ev) return;
    currentModalEventObj = ev;
    editEventModal();
}

function buildGrid(events = []) {
    const tbody = document.getElementById('grid-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const validEvents = events.filter(e => e.startHour !== null && e.startHour >= 0 && e.startHour <= 23);
    const pendingEvents = events.filter(e => e.startHour === null || e.startHour < 0 || e.startHour > 23);

    renderPendingEvents(pendingEvents);

    const dates = getDatesForCurrentWeek();
    let occupiedCells = Array.from({ length: 24 }, () => Array(7).fill(false));

    dates.forEach((d, dayIdx) => {
        let currentDateISO = formatDateToISO(d);

        validEvents.forEach(e => {
            let evStartDate = parseDateStr(e.date);
            if (!evStartDate) return;

            let evStartISO = formatDateToISO(evStartDate);
            let rawDuration = parseInt(e.durationHours) || 1;

            if (evStartISO === currentDateISO) {
                let startH = e.startHour;
                let endH = Math.min(24, startH + rawDuration);
                for (let h = startH; h < endH; h++) {
                    occupiedCells[h][dayIdx] = true;
                }
            }
        });
    });

    for (let hour = 0; hour < 24; hour++) {
        const tr = document.createElement('tr');
        let rowHTML = `<td class="time-col">${hour.toString().padStart(2, '0')}:00</td>`;

        for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
            let d = dates[dayIdx];
            let currentDateISO = formatDateToISO(d);

            const evStart = validEvents.find(e => {
                let evDateObj = parseDateStr(e.date);
                return evDateObj && formatDateToISO(evDateObj) === currentDateISO && e.startHour === hour;
            });

            if (evStart) {
                const rawDuration = parseInt(evStart.durationHours) || 1;
                let visualSpan = Math.min(rawDuration, 24 - hour);

                let locText = evStart.type === 'transporte' ? 'Traslado / Vuelo' : (evStart.location || '');
                let icon = getEventIcon(evStart); // [CAMBIO 7]

                rowHTML += `<td rowspan="${visualSpan}" style="padding:1px; vertical-align:top; height:${visualSpan * 38}px;">
                    <div class="event-block event-${evStart.type || 'actividad'}" onclick="showModalByObject(${eventKeyArgs(evStart)})">
                        <div class="event-title-line">${icon} ${evStart.title}</div>
                        <div class="event-subtitle-line">${rawDuration}h totales ${locText ? '| ' + locText : ''}</div>
                    </div>
                </td>`;
            } else {
                if (!occupiedCells[hour][dayIdx]) {
                    rowHTML += `<td></td>`;
                }
            }
        }
        tr.innerHTML = rowHTML;
        tbody.appendChild(tr);
    }
}

// [CAMBIO 16] Recibe el ID del alojamiento (o el nombre, como respaldo)
function showModalByTitle(key) {
    let acc = findAccommodation(key);
    if (acc) {
        const safeKey = String(acc.id || acc.name).replace(/'/g, "\\'");
        let mapsUrl = acc.coords ? `https://www.google.com/maps/search/?api=1&query=${acc.coords}` : (acc.mapUrl || 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(acc.name));
        document.getElementById('modalTitle').innerText = acc.name;
        document.getElementById('modalBody').innerHTML = `
            <p><b>Ubicación:</b> ${acc.name}</p>
            <p><b>Estadía:</b> ${acc.start} hasta ${acc.end}</p>
            <div style="margin-top:1rem;">
                <a href="${mapsUrl}" target="_blank" style="color:var(--primary); font-weight:bold; text-decoration:underline;">
                    🗺️ Abrir ubicación en Google Maps
                </a>
            </div>
            <div style="margin-top:15px;">
                <button onclick="editAccommodationModal('${safeKey}')" style="background:#0284c7; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight:bold;">
                    ✏️ Editar Alojamiento
                </button>
            </div>
        `;
        document.getElementById('eventModal').style.display = 'flex';
    }
}

// [CAMBIO 4] Abre el formulario de edición cargado con los datos del alojamiento
// [CAMBIO 16] Recibe el ID (o el nombre, como respaldo)
function editAccommodationModal(key) {
    const acc = findAccommodation(key);
    if (!acc) return;
    editingAccommodation = acc;
    editingEventID = ''; // [CAMBIO 16] no se está editando un evento del itinerario

    populateLocationSelects();
    closeModal('eventModal');
    document.getElementById('addEventForm').reset();
    document.getElementById('modalFormHeaderTitle').innerText = "Editar Alojamiento";

    document.getElementById('ev-old-title').value = acc.name;
    document.getElementById('ev-old-date').value = acc.start;

    document.getElementById('ev-title').value = acc.name;
    document.getElementById('ev-date').value = formatDateToISO(parseDateStr(acc.start));
    document.getElementById('ev-end-date').value = formatDateToISO(parseDateStr(acc.end));
    document.getElementById('ev-hour').value = acc.checkInHour !== null ? acc.checkInHour : 14;
    document.getElementById('ev-end-hour').value = acc.checkOutHour !== null ? acc.checkOutHour : 10;
    document.getElementById('ev-duration').value = 1;

    // El tipo queda fijo en "Alojamiento" para no mover el hotel a otra pestaña por error
    const typeSelect = document.getElementById('ev-type');
    typeSelect.value = 'sleep';
    typeSelect.disabled = true;

    document.getElementById('ev-booking-code').value = acc.bookingLink || '';
    document.getElementById('ev-location').value = acc.direccion || '';
    document.getElementById('ev-cost').value = '';
    document.getElementById('ev-details').value = acc.detalles || ''; // se conservan los detalles del hotel

    toggleLocationFields();
    document.getElementById('addModal').style.display = 'flex';
}

// [CAMBIO 16] Recibe el ID (o la forma vieja: título, fecha, hora)
function showModalByObject(key, date, startHour) {
    const ev = findEvent(key, date, startHour);
    if (!ev) return;

    currentModalEventObj = ev;
    document.getElementById('modalTitle').innerText = ev.title;

    let bookingHTML = ev.bookingCode ? `<p style="background:#fef3c7; color:#92400e; padding:4px 8px; border-radius:4px; font-weight:bold; font-size:0.85rem; margin-bottom:8px;">🎟 Entrada/Ticket: ${ev.bookingCode}</p>` : '';

    let routeHTML = '';
    if (ev.type === 'transporte') {
        let origCoords = ev.coordsInicio || ev.originLink;
        let destCoords = ev.coordsFin || ev.destLink;

        let origBtn = origCoords ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(origCoords)}" target="_blank" style="display:inline-block; background:#2563eb; color:white; padding:4px 8px; border-radius:4px; font-weight:bold; text-decoration:none; font-size:0.75rem;">📍 Punto de Partida</a>` : '';
        let destBtn = destCoords ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destCoords)}" target="_blank" style="display:inline-block; background:#0284c7; color:white; padding:4px 8px; border-radius:4px; text-decoration:none; font-size:0.75rem; margin-left:6px;">📍 Punto de Arribo</a>` : '';

        // [CAMBIO 7] Medio, escalas y rutas hacia/desde los alojamientos
        const medio = getMedio(ev);
        const medioHTML = medio ? `<p style="margin-bottom:6px;"><b>Medio:</b> ${MEDIO_ICONS[medio]} ${medio}</p>` : `<p style="margin-bottom:6px; color:#b45309;"><b>Medio:</b> sin definir (Editar → elegir medio)</p>`;

        const legs = getTicketLegs(ev);
        const legIdx = legs.indexOf(ev);
        const isFirstLeg = legIdx <= 0;
        const isLastLeg = legIdx === -1 || legIdx === legs.length - 1;
        let legsHTML = '';
        if (legs.length > 1) {
            legsHTML = `<div style="margin-bottom:8px; padding:6px 8px; background:#fef3c7; border-radius:4px; font-size:0.8rem; color:#92400e;">
                🔗 <b>Mismo ticket — tramo ${legIdx + 1} de ${legs.length}:</b><br>
                ${legs.map((l, i) => `${i === legIdx ? '<b>' : ''}${i + 1}. ${getEventIcon(l)} ${l.title} (${formatDateStandard(l.date)} ${l.startHour !== null ? l.startHour + ':00' : ''})${i === legIdx ? '</b>' : ''}`).join('<br>')}
            </div>`;
        }

        let chainBtns = [];
        // Ir a la salida: desde el hotel donde dormiste la noche anterior (solo en el primer tramo)
        if (isFirstLeg && ev.coordsInicio) {
            const hotelBefore = getHotelSleptBefore(ev.date);
            if (hotelBefore && hotelBefore.coords) {
                chainBtns.push(routeButton(buildDirectionsUrl(hotelBefore.coords, ev.coordsInicio, 'transit'), `🏨➡️ Ir a la salida (desde ${hotelBefore.name})`, '#2563eb'));
            }
        }
        // Recorrido del trayecto (no aplica a avión, barco o ferry)
        const mode = medio ? MEDIO_TRAVELMODE[medio] : 'transit';
        if (mode && ev.coordsInicio && ev.coordsFin) {
            chainBtns.push(routeButton(buildDirectionsUrl(ev.coordsInicio, ev.coordsFin, mode), `${MEDIO_ICONS[medio] || '🧭'} Recorrido del trayecto`, '#16a34a'));
        }
        // De la llegada al alojamiento (solo en el último tramo; en escalas se avisa la conexión)
        if (isLastLeg && ev.coordsFin) {
            const hotelAfter = getHotelSleepingOn(ev.endDate || ev.date);
            if (hotelAfter && hotelAfter.coords) {
                chainBtns.push(routeButton(buildDirectionsUrl(ev.coordsFin, hotelAfter.coords, 'transit'), `➡️🏨 De la llegada a ${hotelAfter.name}`, '#0284c7'));
            }
        } else if (!isLastLeg) {
            const nextLeg = legs[legIdx + 1];
            chainBtns.push(`<span style="font-size:0.8rem; color:#92400e; font-weight:bold;">🔁 Escala: sigue con "${nextLeg.title}"</span>`);
        }

        const chainHTML = chainBtns.length > 0
            ? `<p style="font-weight:bold; color:#1e40af; margin:10px 0 6px 0;">🧭 Cómo llegar:</p><div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">${chainBtns.join('')}</div>`
            : '';

        routeHTML = `
            <div style="margin: 0.8rem 0; padding: 0.8rem; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; font-size: 0.85rem;">
                ${medioHTML}
                ${legsHTML}
                <p style="font-weight:bold; color:#1e40af; margin-bottom:6px;">🚉 Terminales y Puntos de Encuentro:</p>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    ${origBtn}
                    ${destBtn}
                </div>
                ${chainHTML}
            </div>`;
    } else {
        let loc = ev.coordsInicio || ev.location || ev.title;
        let locLink = `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}" target="_blank" style="color:#1d4ed8; text-decoration:underline;">📍 Abrir Ubicación</a>`;

        // [CAMBIO 12] Cómo llegar con la cadena del día
        routeHTML = `<p><b>Ubicación:</b> ${locLink}</p>` + buildHowToGetThereHTML(ev);
    }

    let arrivalInfo = (ev.endDate) ? `<p><b>Llegada / Fin:</b> ${ev.endDate} ${ev.endHour || 0}:00hs</p>` : '';

    document.getElementById('modalBody').innerHTML = `
        ${bookingHTML}
        <p><b>Salida / Inicio:</b> ${ev.date} ${ev.startHour !== null ? ev.startHour : 'Pendiente'}:00hs</p>
        ${arrivalInfo}
        <p><b>Duración:</b> ${ev.durationHours} horas</p>
        <p><b>Costo estimado:</b> ${ev.cost ? '$' + ev.cost + ' ARS' : 'Gratis / N/A'}</p>
        ${routeHTML}

        <hr style="margin: 0.8rem 0; border:0; border-top: 1px solid var(--border);">
        <p><b>Notas & Consejos:</b></p>
        <p>${ev.details || 'Sin detalles adicionales.'}</p>

        <div style="margin-top:15px; display:flex; justify-content:space-between; gap:0.5rem;">
            <button onclick="editEventModal()" style="background:#0284c7; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight:bold;">
                ✏️ Editar Evento
            </button>
            <button onclick="deleteEvent(${eventKeyArgs(ev)})" style="background:#ef4444; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight:bold;">
                🗑 Eliminar Evento
            </button>
        </div>
    `;

    document.getElementById('eventModal').style.display = 'flex';
}

function openAddModal() {
    populateLocationSelects();
    editingAccommodation = null; // [CAMBIO 4]
    editingEventID = '';         // [CAMBIO 16] evento nuevo
    document.getElementById('ev-type').disabled = false; // [CAMBIO 4]
    document.getElementById('modalFormHeaderTitle').innerText = "Añadir Nueva Actividad";
    document.getElementById('addEventForm').reset();
    document.getElementById('ev-old-title').value = "";
    document.getElementById('ev-old-date').value = "";
    toggleLocationFields();
    document.getElementById('addModal').style.display = 'flex';
}

function editEventModal() {
    if (!currentModalEventObj) return;
    const ev = currentModalEventObj;

    populateLocationSelects();
    editingAccommodation = null; // [CAMBIO 4]
    editingEventID = ev.id || ''; // [CAMBIO 16]
    document.getElementById('ev-type').disabled = false; // [CAMBIO 4]
    closeModal('eventModal');
    document.getElementById('modalFormHeaderTitle').innerText = "Editar Actividad / Evento";

    document.getElementById('ev-old-title').value = ev.title;
    document.getElementById('ev-old-date').value = ev.date;

    document.getElementById('ev-title').value = ev.title;
    document.getElementById('ev-date').value = formatDateToISO(parseDateStr(ev.date));
    document.getElementById('ev-hour').value = ev.startHour !== null ? ev.startHour : 8;
    document.getElementById('ev-end-date').value = formatDateToISO(parseDateStr(ev.endDate || ev.date));
    document.getElementById('ev-end-hour').value = ev.endHour !== null ? ev.endHour : 10;
    document.getElementById('ev-duration').value = ev.durationHours || 2;
    document.getElementById('ev-type').value = ev.type || 'actividad';
    document.getElementById('ev-booking-code').value = ev.bookingCode || '';
    document.getElementById('ev-location').value = ev.location || '';
    document.getElementById('ev-origin-link').value = ev.originLink || '';
    document.getElementById('ev-dest-link').value = ev.destLink || '';
    document.getElementById('ev-medio').value = getMedio(ev); // [CAMBIO 7] los viejos con "vuelo" vienen como Avión
    document.getElementById('ev-cost').value = ev.cost || '';
    document.getElementById('ev-details').value = ev.details || '';

    toggleLocationFields();
    document.getElementById('addModal').style.display = 'flex';
}

function toggleLocationFields() {
    const type = document.getElementById('ev-type').value;
    document.getElementById('single-location-group').style.display = type === 'transporte' ? 'none' : 'block';
    document.getElementById('transport-location-group').style.display = type === 'transporte' ? 'flex' : 'none';
}

// [CAMBIO 1] saveEvent ahora espera la respuesta del Sheet y recarga los datos.
async function saveEvent(e) {
    e.preventDefault();
    const type = document.getElementById('ev-type').value;

    const oldTitle = document.getElementById('ev-old-title').value;
    const oldDate = document.getElementById('ev-old-date').value;

    let targetSheet = "Itinerario";
    if (type === 'sleep') {
        targetSheet = "Alojamiento";
    }

    // [CAMBIO 16] ID de lo que se edita: alojamiento o evento ('' = nuevo).
    // Si un evento cambia a tipo Alojamiento, va a otra pestaña: se guarda como alojamiento nuevo.
    let recordID = '';
    if (type === 'sleep') {
        recordID = editingAccommodation ? (editingAccommodation.id || '') : '';
    } else if (!editingAccommodation) {
        recordID = editingEventID;
    }

    let startDateVal = document.getElementById('ev-date').value;
    let endDateVal = document.getElementById('ev-end-date').value || startDateVal;

    const formattedStartDate = formatDateStandard(startDateVal);
    const formattedEndDate = formatDateStandard(endDateVal);

    let startH = parseInt(document.getElementById('ev-hour').value) || 0;
    let durH = parseInt(document.getElementById('ev-duration').value) || 1;
    let endHVal = document.getElementById('ev-end-hour').value;
    let endH = (endHVal !== "") ? parseInt(endHVal) : Math.min(23, startH + durH);

    const newEv = {
        sheet: targetSheet,
        ID: recordID, // [CAMBIO 16]
        Titulo: document.getElementById('ev-title').value,
        Tipo: type,
        FechaInicio: formattedStartDate,
        HoraInicio: startH,
        FechaFin: formattedEndDate,
        HoraFin: endH,
        Duracion: durH,
        CodigoReserva: document.getElementById('ev-booking-code').value,
        UbicacionInicio: type === 'transporte' ? document.getElementById('ev-origin-link').value : document.getElementById('ev-location').value,
        UbicacionFin: type === 'transporte' ? document.getElementById('ev-dest-link').value : '',
        Medio: type === 'transporte' ? document.getElementById('ev-medio').value : '', // [CAMBIO 7]
        Costo: document.getElementById('ev-cost').value,
        Detalles: document.getElementById('ev-details').value,
        oldTitle: oldTitle,
        oldDate: oldDate
    };

    if (type === 'sleep') {
        newEv.Nombre = newEv.Titulo;
        // [CAMBIO 4] Si se edita un alojamiento, se conserva su ciudad
        // [CAMBIO 16] Alojamiento nuevo: Ciudad vacía (antes decía 'CABA')
        newEv.Ciudad = (editingAccommodation && editingAccommodation.city) ? editingAccommodation.city : '';
        newEv.CheckIn = newEv.HoraInicio;
        newEv.CheckOut = newEv.HoraFin;
        newEv.LinkReserva = newEv.CodigoReserva;
        newEv.Direccion = newEv.UbicacionInicio;
        // [CAMBIO 4] Si no hay dirección, no borrar las coordenadas que ya tenía
        if (editingAccommodation && !newEv.Direccion && editingAccommodation.coords) {
            newEv.Coords = editingAccommodation.coords;
        }
    }

    // Botón en modo "Guardando..." para evitar doble clic
    const submitBtn = e.submitter || document.querySelector('#addEventForm button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerText : '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = '⏳ Guardando...';
    }

    try {
        const res = await fetch(SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify(newEv)
        });

        // El Apps Script responde con un texto. Si empieza con "Error", avisamos.
        let msg = '';
        try { msg = await res.text(); } catch (readErr) { msg = ''; }
        if (msg.startsWith('Error')) {
            throw new Error(msg);
        }
        console.log(`Guardado en Google Sheets (${targetSheet}): ${msg}`);

        // Releer todo desde el Sheet (trae las coordenadas resueltas)
        await reloadTripData();

        closeModal('addModal');
        document.getElementById('addEventForm').reset();
        editingAccommodation = null; // [CAMBIO 4]
        editingEventID = '';         // [CAMBIO 16]
        document.getElementById('ev-type').disabled = false; // [CAMBIO 4]
    } catch (err) {
        alert('No se pudo guardar el evento: ' + err.message);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = originalBtnText;
        }
    }
}

// [CAMBIO 16] Recibe el ID (o la forma vieja: título, fecha, hora)
async function deleteEvent(key, date, startHour) {
    const ev = findEvent(key, date, startHour);
    if (!ev) return;
    if (!confirm(`¿Estás seguro de que deseas eliminar "${ev.title}"?`)) return;

    localEvents = localEvents.filter(e => e !== ev);
    autoDetectTripBounds();
    renderHeaderDays();
    buildGrid(localEvents);
    closeModal('eventModal');

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'delete',
                sheet: 'Itinerario',
                ID: ev.id || '',   // [CAMBIO 16] borra exactamente esta fila
                title: ev.title,   // respaldo si no tuviera ID
                date: ev.date
            })
        });
    } catch (err) {
        alert('Error al sincronizar borrado.');
    }
}
