// ===== gastos.js =====
// Pestaña Gastos: viajeros, conversor ARS/USD, balance y registro de gastos.

function ensureTravelerNames() {
    if (!traveler1 || !traveler2) {
        let p1 = prompt("Ingresá el Nombre del Viajero 1:", traveler1 || "Lukitas");
        let p2 = prompt("Ingresá el Nombre del Viajero 2:", traveler2 || "Acompañante");
        traveler1 = p1 || "Lukitas";
        traveler2 = p2 || "Acompañante";
        localStorage.setItem('caba_lukitas_traveler1', traveler1);
        localStorage.setItem('caba_lukitas_traveler2', traveler2);
    }
    updateTravelerLabels();
}

async function fetchLiveExchangeRate() {
    try {
        const res = await fetch('https://dolarapi.com/v1/dolares/blue');
        const data = await res.json();
        if (data && data.venta) {
            ARS_USD_RATE = parseFloat(data.venta);
            const ind = document.getElementById('rate-indicator');
            if (ind) ind.innerText = `Dólar Blue en Vivo: 1 USD = $${ARS_USD_RATE.toFixed(2)} ARS`;
        }
    } catch(e) {
        console.warn("Usando tasa base ARS/USD.");
    }
}

function convertCurrency(source) {
    const arsInput = document.getElementById('calc-ars');
    const usdInput = document.getElementById('calc-usd');
    if (!arsInput || !usdInput) return;

    if (source === 'ars') {
        const val = parseFloat(arsInput.value);
        usdInput.value = isNaN(val) ? '' : (val / ARS_USD_RATE).toFixed(2);
    } else {
        const val = parseFloat(usdInput.value);
        arsInput.value = isNaN(val) ? '' : Math.round(val * ARS_USD_RATE);
    }
}

function updateTravelerLabels() {
    const selectPayer = document.getElementById('exp-payer');
    const lblP1 = document.getElementById('lbl-p1');
    const lblP2 = document.getElementById('lbl-p2');

    const p1Name = traveler1 || "Lukitas";
    const p2Name = traveler2 || "Acompañante";

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
}

function resetTravelers() {
    const p1 = prompt("Nombre del Viajero 1:", traveler1 || "Lukitas");
    const p2 = prompt("Nombre del Viajero 2:", traveler2 || "Acompañante");
    if (p1) { traveler1 = p1; localStorage.setItem('caba_lukitas_traveler1', p1); }
    if (p2) { traveler2 = p2; localStorage.setItem('caba_lukitas_traveler2', p2); }
    updateTravelerLabels();
    loadExpensesFromSheet();
}

async function loadExpensesFromSheet() {
    updateTravelerLabels();
    try {
        const res = await fetch(`${SCRIPT_URL}?sheet=Gastos`);
        const expenses = await res.json();
        rawExpenses = Array.isArray(expenses) ? expenses : [];

        let totalP1USD = 0;
        let totalP2USD = 0;
        let totalP1ARS = 0;
        let totalP2ARS = 0;
        // [CAMBIO 11] Cuánto le corresponde pagar a Viajero 1 según "¿Cómo se divide?"
        let shareP1ARS = 0;

        const p1Name = traveler1 || "Lukitas";
        const p2Name = traveler2 || "Acompañante";

        const tbody = document.getElementById('expense-table-body');
        tbody.innerHTML = '';

        if (rawExpenses.length > 0) {
            rawExpenses.forEach(exp => {
                let amountARS = parseFloat(exp.Monto_ARS || 0);
                let amountUSD = parseFloat(exp.Monto_Dlr || 0);

                if (amountUSD === 0 && amountARS > 0) amountUSD = amountARS / ARS_USD_RATE;
                if (amountARS === 0 && amountUSD > 0) amountARS = amountUSD * ARS_USD_RATE;

                let payer = exp.PagadoPor || '';

                if (payer === 'p1' || payer === p1Name || payer === 'Lukitas') {
                    totalP1USD += amountUSD;
                    totalP1ARS += amountARS;
                } else if (payer === 'p2' || payer === p2Name) {
                    totalP2USD += amountUSD;
                    totalP2ARS += amountARS;
                }

                // [CAMBIO 11] Parte que le toca a Viajero 1 en este gasto
                const split = exp.DivididoPor || 'both';
                if (split === 'p1_only') {
                    shareP1ARS += amountARS;          // todo es de Viajero 1
                } else if (split === 'p2_only') {
                    shareP1ARS += 0;                  // todo es de Viajero 2
                } else {
                    shareP1ARS += amountARS / 2;      // compartido 50/50
                }
                const splitLabel = split === 'p1_only' ? `solo ${p1Name}` : (split === 'p2_only' ? `solo ${p2Name}` : 'compartido');

                const safeConcept = String(exp.Concepto || '').replace(/'/g, "\\'");
                const safeDate = String(exp.Fecha || '').replace(/'/g, "\\'");

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${exp.Fecha || ''}</td>
                    <td><b>${exp.Concepto || ''}</b></td>
                    <td>$${Math.round(amountARS).toLocaleString('es-AR')} ARS</td>
                    <td>$${amountUSD.toFixed(2)} USD</td>
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
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">No hay gastos registrados.</td></tr>`;
        }

        document.getElementById('total-p1-usd').innerText = `$${totalP1USD.toFixed(2)} USD ($${Math.round(totalP1ARS).toLocaleString('es-AR')} ARS)`;
        document.getElementById('total-p2-usd').innerText = `$${totalP2USD.toFixed(2)} USD ($${Math.round(totalP2ARS).toLocaleString('es-AR')} ARS)`;
        document.getElementById('total-trip-usd').innerText = `$${(totalP1USD + totalP2USD).toFixed(2)} USD`;

        const settlementText = document.getElementById('settlement-text');
        // [CAMBIO 11] Saldo = lo que pagó Viajero 1 menos lo que le correspondía pagar.
        // Positivo: Viajero 2 le debe a Viajero 1. Negativo: al revés.
        const balanceARS = totalP1ARS - shareP1ARS;
        if (Math.abs(balanceARS) < 10) {
            settlementText.innerText = "Cuentas saldadas (0 ARS)";
        } else if (balanceARS > 0) {
            settlementText.innerText = `${p2Name} le debe $${Math.round(balanceARS).toLocaleString('es-AR')} ARS a ${p1Name}`;
        } else {
            settlementText.innerText = `${p1Name} le debe $${Math.round(Math.abs(balanceARS)).toLocaleString('es-AR')} ARS a ${p2Name}`;
        }
    } catch (e) {
        console.error("Error al cargar gastos:", e);
    }
}

function editExpenseRow(concept, date) {
    const exp = rawExpenses.find(e => String(e.Concepto) === concept && String(e.Fecha) === date);
    if (!exp) return;

    document.getElementById('exp-old-concept').value = exp.Concepto;
    document.getElementById('exp-old-date').value = exp.Fecha;

    document.getElementById('exp-date').value = formatDateToISO(parseDateStr(exp.Fecha));
    document.getElementById('exp-concept').value = exp.Concepto;
    document.getElementById('exp-currency').value = exp.Monto_Dlr ? 'USD' : 'ARS';
    document.getElementById('exp-amount').value = exp.Monto_Dlr ? exp.Monto_Dlr : exp.Monto_ARS;
    document.getElementById('exp-payer').value = (exp.PagadoPor === traveler1 || exp.PagadoPor === 'Lukitas') ? 'p1' : 'p2';
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

    const amountARS = currency === 'ARS' ? rawAmount : rawAmount * ARS_USD_RATE;
    const amountUSD = currency === 'USD' ? rawAmount : rawAmount / ARS_USD_RATE;

    const p1Name = traveler1 || "Lukitas";
    const p2Name = traveler2 || "Acompañante";

    const oldConcept = document.getElementById('exp-old-concept').value;
    const oldDate = document.getElementById('exp-old-date').value;

    const expenseData = {
        sheet: 'Gastos',
        Fecha: formatDateStandard(document.getElementById('exp-date').value),
        Concepto: document.getElementById('exp-concept').value,
        Monto_ARS: Math.round(amountARS),
        Monto_Dlr: amountUSD.toFixed(2),
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
