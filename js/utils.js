// ===== utils.js =====
// Utilidades generales: fechas (dd/mm/aaaa), formato de texto y cerrar ventanas.

function formatMarkdown(text) {
    if (!text) return '';
    let formatted = String(text)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^### (.*$)/gim, '<h4 style="margin: 0.6rem 0 0.3rem 0; color: var(--primary);">$1</h4>')
        .replace(/^## (.*$)/gim, '<h3 style="margin: 0.8rem 0 0.4rem 0; color: var(--primary);">$1</h3>')
        .replace(/^\* (.*$)/gim, '<li>$1</li>')
        .replace(/^(1\.|2\.|3\.|4\.|5\.) (.*$)/gim, '<li>$2</li>');

    if (formatted.includes('<li>')) {
        formatted = formatted.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
    }
    return formatted.replace(/\n/g, '<br>');
}

// PARSEO STRICTO DD/MM/YYYY
function parseDateStr(rawDate) {
    if (!rawDate) return null;
    let clean = String(rawDate).split('T')[0].split(' ')[0].replace(/^"|"$/g, '').trim();
    if (clean.includes('/')) {
        let parts = clean.split('/');
        if (parts.length === 3) return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    } else if (clean.includes('-')) {
        let parts = clean.split('-');
        if (parts.length === 3) return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    return null;
}

function formatDateToISO(d) {
    if (!d || isNaN(d.getTime())) return '';
    let year = d.getFullYear();
    let month = (d.getMonth() + 1).toString().padStart(2, '0');
    let day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateStandard(rawDate) {
    let d = parseDateStr(rawDate);
    if (!d || isNaN(d.getTime())) return rawDate || '';
    let day = ("0" + d.getDate()).slice(-2);
    let month = ("0" + (d.getMonth() + 1)).slice(-2);
    let year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

// [CAMBIO 4] Lee una hora (0-23) de una celda. Si la celda tiene una fecha u otra cosa, devuelve null.
function parseHourCell(v) {
    if (v === undefined || v === null || v === '') return null;
    if (String(v).indexOf('/') !== -1) return null; // es una fecha, no una hora
    const n = parseInt(v);
    return (!isNaN(n) && n >= 0 && n <= 23) ? n : null;
}

// Fecha sin hora, para comparar días
function dayOnly(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

// ===== [CAMBIO 12] CADENA DEL DÍA PARA ACTIVIDADES =====

// Mismo día (compara solo la fecha)
function sameDay(a, b) {
    const da = parseDateStr(a), db = parseDateStr(b);
    return !!(da && db && formatDateToISO(da) === formatDateToISO(db));
}

function closeModal(modalId) { document.getElementById(modalId).style.display = 'none'; }
