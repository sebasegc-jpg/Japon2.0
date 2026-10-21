// ===== gastos.js =====
// Pestaña Gastos: viajeros, conversor ¥ / USD / ARS, balance y registro de gastos.
// [CAMBIO 12] Tres monedas: cada gasto guarda Monto_JPY, Monto_Dlr y Monto_ARS
// (convertidos con la cotización del día en que se cargó) y la Moneda original.
// El balance se muestra en la moneda elegida en el desplegable.

const CURRENCIES = ['JPY', 'USD', 'ARS'];
const SHEET_COL = { JPY: 'Monto_JPY', USD: 'Monto_Dlr', ARS: 'Monto_ARS' };

function p1Default() { return traveler1 || "Sebas"; }
function p2Default() { return traveler2 || "Hil"; }

// ---------- Conversión de monedas (todo pasa por el dólar) ----------
function toUSD(amount, cur) {
    if (cur === 'JPY') return amount / JPY_USD_RATE;
    if (cur === 'ARS') return amount / ARS_USD_RATE;
    return amount;
}

function fromUSD(usd, cur) {
    if (cur === 'JPY') return usd * JPY_USD_RATE;
    if (cur === 'ARS') return usd * ARS_USD_RATE;
    return usd;
}

function convertAmount(amount, from, to) {
    return fromUSD(toUSD(amount, from), to);
}

function formatMoney(amount, cur) {
    const n = Number(amount) || 0;
    if (cur === 'JPY') return '¥' + Math.round(n).toLocaleString('es-AR');
    if (cur === 'USD') return 'US$ ' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return '$' + Math.round(n).toLocaleString('es-AR') + ' ARS';
}

// Monto de un gasto en la moneda pedida: usa el valor guardado en el Sheet;
// si falta (gastos viejos), lo convierte desde otra moneda con la cotización actual.
function expenseAmountIn(exp, cur) {
    const stored = parseFloat(exp[SHEET_COL[cur]]);
    if (stored > 0) return stored;
    for (const other of CURRENCIES) {
        const v = parseFloat(exp[SHEET_COL[other]]);
        if (v > 0) return convertAmount(v, other, cur);
    }
    return 0;
}

// Moneda en la que se cargó el gasto (columna Moneda; si no está, la adivina)
function expenseOriginalCurrency(exp) {
    if (CURRENCIES.includes(exp.Moneda)) return exp.Moneda;
    for (const c of CURRENCIES) {
        if (parseFloat(exp[SHEET_COL[c]]) > 0) return c;
    }
    return 'JPY';
}

// ---------- Viajeros ----------
function ensureTravelerNames() {
    if (!traveler1 || !traveler2) {
        let p1 = prompt("Ingresá el Nombre del Viajero 1:", traveler1 || "Sebas");
        let p2 = prompt("Ingresá el Nombre del Viajero 2:", traveler2 || "Hil");
        traveler1 = p1 || "Sebas";
        traveler2 = p2 || "Hil";
        localStorage.setItem('japon2_traveler1', traveler1);
        localStorage.setItem('japon2_traveler2', traveler2);
    }
    updateTravelerLabels();
}

function updateTravelerLabels() {
    const selectPayer = document.getElementById('exp-payer');
    const lblP1 = document.getElementById('lbl-p1');
    const lblP2 = document.getElementById('lbl-p2');

    const p1Name = p1Default();
    const p2Name = p2Default();

    if (selectPayer) {
        selectPayer.innerHTML = `
            <option value="p1">${p1Name}</option>
            <option value="p2">${p2Name}</option>
        `;
    }
    if (lblP1) lblP1.innerText = `Total Pagado por ${p1Name}:`;
    if (lblP2) lblP2.innerText = `Total Pagado por ${p2Name}:`;

    // [CAMBIO 11] Opciones de división con los nombres de los viajeros
    const splitSel = document.getElementById('exp-split');
    if (splitSel) {
        splitSel.options[1].text = `Solo de ${p1Name} (no se divide)`;
        splitSel.options[2].text = `Solo de ${p2Name} (no se divide)`;
    }

    // [CAMBIO 12] El desplegable del balance muestra la moneda elegida
    const balSel = document.getElementById('balance-currency');
    if (balSel) balSel.value = balanceCurrency;
}

function resetTravelers() {
    const p1 = prompt("Nombre del Viajero 1:", p1Default());
    const p2 = prompt("Nombre del Viajero 2:", p2Default());
    if (p1) { traveler1 = p1; localStorage.setItem('japon2_traveler1', p1); }
    if (p2) { traveler2 = p2; localStorage.setItem('japon2_traveler2', p2); }
    updateTravelerLabels();
    renderExpenses();
}

// ---------- Cotizaciones en vivo ----------
async function fetchLiveExchangeRate() {
    try {
        const res = await fetch('https://dolarapi.com/v1/dolares/blue');
        const data = await res.json();
        if (data && data.venta) ARS_USD_RATE = parseFloat(data.venta);
    } catch (e) {
        console.warn("Usando tasa base ARS/USD.");
    }
    try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await res.json();
        if (data && data.rates && data.rates.JPY) JPY_USD_RATE = parseFloat(data.rates.JPY);
    } catch (e) {
        console.warn("Usando tasa base JPY/USD.");
    }
    updateRateIndicator();
}

function updateRateIndicator() {
    const ind = document.getElementById('rate-indicator');
    if (ind) {
        ind.innerText = `1 USD = ¥${JPY_USD_RATE.toFixed(2)} | 1 USD = $${Math.round(ARS_USD_RATE).toLocaleString('es-AR')} ARS (blue)`;
    }
}

// Conversor rápido: al escribir en una moneda, completa las otras dos
function convertCurrency(source) {
    const inputs = {
        JPY: document.getElementById('calc-jpy'),
        USD: document.getElementById('calc-usd'),
        ARS: document.getElementById('calc-ars')
    };
    if (!inputs.JPY || !inputs.USD || !inputs.ARS) return;

    const from = String(source).toUpperCase();
    const val = parseFloat(inputs[from].value);

    CURRENCIES.forEach(cur => {
        if (cur === from) return;
        if (isNaN(val)) { inputs[cur].value = ''; return; }
        const conv = convertAmount(val, from, cur);
        inputs[cur].value = cur === 'USD' ? conv.toFixed(2) : Math.round(conv);
    });
}

// [CAMBIO 12] Cambio de moneda del balance (no vuelve a pedir datos al Sheet)
function changeBalanceCurrency() {
    const sel = document.getElementById('balance-currency');
    if (!sel) return;
    balanceCurrency = sel.value;
    try { localStorage.setItem('japon2_balance_currency', balanceCurrency); } catch (e) {}
    renderExpenses();
}

// ---------- Leer y mostrar gastos ----------
async function loadExpensesFromSheet() {
    updateTravelerLabels();
    try {
        const res = await fetch(`${SCRIPT_URL}?sheet=Gastos`);
        const expenses = await res.json();
        rawExpenses = Array.isArray(expenses) ? expenses : [];
        renderExpenses();
    } catch (e) {
        console.error("Error al cargar gastos:", e);
    }
}

function renderExpenses() {
    const cur = balanceCurrency;
    const p1Name = p1Default();
    const p2Name = p2Default();

    let paidP1 = 0;   // lo que pagó Viajero 1
    let paidP2 = 0;   // lo que pagó Viajero 2
    let shareP1 = 0;  // [CAMBIO 11] lo que le correspondía pagar a Viajero 1

    const tbody = document.getElementById('expense-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (rawExpenses.length > 0) {
        rawExpenses.forEach(exp => {
            const amount = expenseAmountIn(exp, cur);
            const payer = exp.PagadoPor || '';

            if (payer === 'p1' || payer === p1Name) {
                paidP1 += amount;
            } else if (payer === 'p2' || payer === p2Name) {
                paidP2 += amount;
            }

            const split = exp.DivididoPor || 'both';
            if (split === 'p1_only') {
                shareP1 += amount;          // todo es de Viajero 1
            } else if (split === 'p2_only') {
                shareP1 += 0;               // todo es de Viajero 2
            } else {
                shareP1 += amount / 2;      // compartido 50/50
            }
            const splitLabel = split === 'p1_only' ? `solo ${p1Name}` : (split === 'p2_only' ? `solo ${p2Name}` : 'compartido');

            // La moneda en que se cargó el gasto se muestra en negrita
            const orig = expenseOriginalCurrency(exp);
            const cell = c => {
                const txt = formatMoney(expenseAmountIn(exp, c), c);
                return c === orig ? `<b>${txt}</b>` : txt;
            };

            const safeConcept = String(exp.Concepto || '').replace(/'/g, "\\'");
            const safeDate = String(exp.Fecha || '').replace(/'/g, "\\'");

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${exp.Fecha || ''}</td>
                <td><b>${exp.Concepto || ''}</b></td>
                <td>${cell('JPY')}</td>
                <td>${cell('USD')}</td>
                <td>${cell('ARS')}</td>
                <td>${payer}<br><span style="font-size:0.72rem; color:var(--text-muted);">${splitLabel}</span></td>
                <td>${exp.Categoria || ''}</td>
                <td>
                    <button onclick="editExpenseRow('${safeConcept}', '${safeDate}')" style="background:#0284c7; color:white; border:none; padding:2px 6px; border-radius:3px; cursor:pointer; font-weight:bold;">✏️</button>
                    <button onclick="deleteExpenseRow('${safeConcept}', '${safeDate}')" style="background:#ef4444; color:white; border:none; padding:2px 6px; border-radius:3px; cursor:pointer; font-weight:bold;">🗑</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } else {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted);">No hay gastos registrados.</td></tr>`;
    }

    document.getElementById('total-p1-usd').innerText = formatMoney(paidP1, cur);
    document.getElementById('total-p2-usd').innerText = formatMoney(paidP2, cur);
    document.getElementById('total-trip-usd').innerText = formatMoney(paidP1 + paidP2, cur);

    // Saldo = lo que pagó Viajero 1 menos lo que le correspondía pagar.
    // Positivo: Viajero 2 le debe a Viajero 1. Negativo: al revés.
    const settlementText = document.getElementById('settlement-text');
    const balance = paidP1 - shareP1;
    const minDiff = { JPY: 50, USD: 0.5, ARS: 500 }[cur];  // diferencias chicas = saldado
    if (Math.abs(balance) < minDiff) {
        settlementText.innerText = "Cuentas saldadas";
    } else if (balance > 0) {
        settlementText.innerText = `${p2Name} le debe ${formatMoney(balance, cur)} a ${p1Name}`;
    } else {
        settlementText.innerText = `${p1Name} le debe ${formatMoney(Math.abs(balance), cur)} a ${p2Name}`;
    }
}

// ---------- Editar, borrar y guardar ----------
function editExpenseRow(concept, date) {
    const exp = rawExpenses.find(e => String(e.Concepto) === concept && String(e.Fecha) === date);
    if (!exp) return;

    document.getElementById('exp-old-concept').value = exp.Concepto;
    document.getElementById('exp-old-date').value = exp.Fecha;

    const orig = expenseOriginalCurrency(exp);
    const origAmount = expenseAmountIn(exp, orig);

    document.getElementById('exp-date').value = formatDateToISO(parseDateStr(exp.Fecha));
    document.getElementById('exp-concept').value = exp.Concepto;
    document.getElementById('exp-currency').value = orig;
    document.getElementById('exp-amount').value = orig === 'USD' ? origAmount.toFixed(2) : Math.round(origAmount);
    document.getElementById('exp-payer').value = (exp.PagadoPor === p1Default()) ? 'p1' : 'p2';
    document.getElementById('exp-category').value = exp.Categoria || 'Entradas';
    document.getElementById('exp-split').value = exp.DivididoPor || 'both';

    document.getElementById('expense-form-title').innerText = "✏️ Editar Gasto";
}

async function deleteExpenseRow(concept, date) {
    if (!confirm(`¿Estás seguro de eliminar el gasto "${concept}"?`)) return;

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'delete',
                sheet: 'Gastos',
                title: concept,
                date: date
            })
        });
        loadExpensesFromSheet();
    } catch (err) {
        alert("Error al eliminar el gasto.");
    }
}

function saveExpenseForm(e) {
    e.preventDefault();
    const currency = document.getElementById('exp-currency').value;
    const rawAmount = parseFloat(document.getElementById('exp-amount').value) || 0;

    // [CAMBIO 12] Calcula el monto en las tres monedas con la cotización de hoy
    const amounts = {};
    CURRENCIES.forEach(c => {
        amounts[c] = (c === currency) ? rawAmount : convertAmount(rawAmount, currency, c);
    });

    const p1Name = p1Default();
    const p2Name = p2Default();

    const oldConcept = document.getElementById('exp-old-concept').value;
    const oldDate = document.getElementById('exp-old-date').value;

    const expenseData = {
        sheet: 'Gastos',
        Fecha: formatDateStandard(document.getElementById('exp-date').value),
        Concepto: document.getElementById('exp-concept').value,
        Monto_ARS: Math.round(amounts.ARS),
        Monto_Dlr: amounts.USD.toFixed(2),
        Monto_JPY: Math.round(amounts.JPY),
        Moneda: currency,
        PagadoPor: document.getElementById('exp-payer').value === 'p1' ? p1Name : p2Name,
        Categoria: document.getElementById('exp-category').value,
        DivididoPor: document.getElementById('exp-split').value,
        oldTitle: oldConcept,
        oldDate: oldDate
    };

    fetch(SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify(expenseData)
    }).then(() => {
        loadExpensesFromSheet();
        document.getElementById('expense-form').reset();
        document.getElementById('exp-old-concept').value = "";
        document.getElementById('exp-old-date').value = "";
        document.getElementById('expense-form-title').innerText = "➕ Registrar Gasto";
    });
}
