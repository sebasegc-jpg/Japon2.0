// ===== Code.gs =====
// Apps Script del Sheet de Japón: lee pestañas (doGet) y guarda/edita/borra filas (doPost).
// [CAMBIO 15] Columna ID: cada fila tiene un identificador único (IT-, AL-, RE-, GA-).

var ID_PREFIX = { 'Itinerario': 'IT', 'Alojamiento': 'AL', 'Recomendaciones': 'RE', 'Gastos': 'GA' };

function doGet(e) {
  var sheetName = e.parameter.sheet || 'Itinerario';
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = doc.getSheetByName(sheetName);

  if (!sheet) {
    return replyJSON([]);
  }

  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return replyJSON([]);
  }

  // [CAMBIO 2] Zona horaria del propio Sheet (Argentina, Japón, etc.)
  var tz = doc.getSpreadsheetTimeZone();

  var headers = values[0];
  var idCol = columnaID(headers); // [CAMBIO 15] -1 si la pestaña no tiene columna ID
  var data = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var obj = {};
    var hasContent = false;

    for (var j = 0; j < headers.length; j++) {
      var headerKey = String(headers[j]).trim();
      if (headerKey !== '') {
        var val = row[j];
        // [CAMBIO 2] Si la celda es una fecha, la mandamos como texto dd/mm/aaaa
        if (esFecha(val)) {
          val = Utilities.formatDate(val, tz, 'dd/MM/yyyy');
        }
        obj[headerKey] = val;
        // [CAMBIO 15] La columna ID no cuenta como "contenido" (una fila con solo ID está vacía)
        if (j !== idCol && val !== '' && val !== null && val !== undefined) hasContent = true;
      }
    }
    if (hasContent) {
      // [CAMBIO 15] Fila sin ID (ya existente o escrita a mano): se le asigna uno
      if (idCol >= 0 && String(row[idCol]).trim() === '') {
        obj.ID = asignarID(sheet, sheetName, i + 1, idCol + 1);
      }
      data.push(obj);
    }
  }

  return replyJSON(data);
}

function doPost(e) {
  try {
    var item = JSON.parse(e.postData.contents);
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var sheetName = item.sheet || 'Itinerario';
    var sheet = doc.getSheetByName(sheetName);

    if (!sheet) {
      return ContentService.createTextOutput("Error: No se encontró la pestaña " + sheetName);
    }

    // RESOLUCIÓN DE COORDENADAS AUTOMÁTICA
    if (sheetName === 'Itinerario') {
      if (item.UbicacionInicio || item.location) {
        item.CoordsInicio = resolveGoogleMapsCoords(item.UbicacionInicio || item.location);
      }
      if (item.UbicacionFin || item.destLink) {
        item.CoordsFin = resolveGoogleMapsCoords(item.UbicacionFin || item.destLink);
      }
    } else if (sheetName === 'Alojamiento') {
      if (item.Direccion || item.location) {
        item.Coords = resolveGoogleMapsCoords(item.Direccion || item.location);
      }
    } else if (sheetName === 'Recomendaciones') {
      if (item.LinkGoogleMaps || item.Ubicacion) {
        item.Coords = resolveGoogleMapsCoords(item.LinkGoogleMaps || item.Ubicacion);
      }
    }

    var data = sheet.getDataRange().getValues();
    var headers = data.length > 0 ? data[0] : [];
    var idCol = columnaID(headers);              // [CAMBIO 15]
    var itemID = String(item.ID || '').trim();   // [CAMBIO 15]

    // ACCIÓN: ELIMINAR
    if (item.action === 'delete') {
      // [CAMBIO 15] Con ID: borra exactamente esa fila
      if (idCol >= 0 && itemID !== '') {
        var filaID = buscarFilaPorID(data, idCol, itemID);
        if (filaID > 0) {
          sheet.deleteRow(filaID);
          return ContentService.createTextOutput("Eliminado correctamente.");
        }
        return ContentService.createTextOutput("Registro no encontrado para eliminar.");
      }

      // Sin ID: como antes, por título
      var targetTitle = item.title || item.Titulo || item.Concepto || item.Nombre || '';
      var filaTitulo = buscarFilaPorTexto(data, headers, targetTitle);
      if (filaTitulo > 0) {
        sheet.deleteRow(filaTitulo);
        return ContentService.createTextOutput("Eliminado correctamente.");
      }
      return ContentService.createTextOutput("Registro no encontrado para eliminar.");
    }

    // ACCIÓN: EDITAR / GUARDAR
    var rowToUpdate = -1;

    if (idCol >= 0) {
      // [CAMBIO 15] Pestaña con ID
      if (itemID !== '') {
        rowToUpdate = buscarFilaPorID(data, idCol, itemID);       // edición exacta
      } else if (item.oldTitle) {
        rowToUpdate = buscarFilaPorTexto(data, headers, item.oldTitle); // web vieja editando por título
      }
      // Sin ID ni oldTitle: es un registro NUEVO (ya no pisa otro con el mismo nombre)
    } else {
      // Pestaña sin columna ID: como antes
      var oldTitle = item.oldTitle || item.title || item.Titulo || item.Concepto || item.Nombre || '';
      rowToUpdate = buscarFilaPorTexto(data, headers, oldTitle);
    }

    // Mapeo dinámico contra la Fila 1 de encabezados
    var newRow = [];
    for (var h = 0; h < headers.length; h++) {
      var key = String(headers[h]).trim();
      var value = item[key] !== undefined ? item[key] : (item[getFallbackKey(key)] !== undefined ? item[getFallbackKey(key)] : '');
      newRow.push(value);
    }

    // [CAMBIO 15] Si la fila queda sin ID: conserva el que tenía o crea uno nuevo
    if (idCol >= 0 && String(newRow[idCol]).trim() === '') {
      var idAnterior = rowToUpdate > 0 ? String(data[rowToUpdate - 1][idCol]).trim() : '';
      newRow[idCol] = idAnterior !== '' ? idAnterior : nuevoID(sheetName);
    }

    if (rowToUpdate > 0) {
      // Reemplaza la fila existente sin borrarla
      var range = sheet.getRange(rowToUpdate, 1, 1, newRow.length);
      range.setValues([newRow]);
      return ContentService.createTextOutput("Actualizado correctamente.");
    } else {
      // Agrega una fila nueva al final
      sheet.appendRow(newRow);
      return ContentService.createTextOutput("Guardado con éxito.");
    }

  } catch (err) {
    return ContentService.createTextOutput("Error en backend: " + err.message);
  }
}

// ===== [CAMBIO 15] AYUDANTES DE ID =====

// Posición de la columna "ID" en la fila 1 (o -1 si no existe)
function columnaID(headers) {
  for (var c = 0; c < headers.length; c++) {
    if (String(headers[c]).trim() === 'ID') return c;
  }
  return -1;
}

// ID nuevo con el prefijo de la pestaña. Ej: IT-a3f9c21b
function nuevoID(sheetName) {
  return (ID_PREFIX[sheetName] || 'XX') + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
}

// Fila del Sheet (base 1) que tiene ese ID, o -1
function buscarFilaPorID(data, idCol, id) {
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idCol]).trim() === String(id).trim()) return r + 1;
  }
  return -1;
}

// Como antes: fila (base 1) donde alguna celda es igual al texto buscado, o -1
function buscarFilaPorTexto(data, headers, texto) {
  if (!texto || String(texto).trim() === '') return -1;
  for (var r = 1; r < data.length; r++) {
    for (var col = 0; col < headers.length; col++) {
      if (String(data[r][col]).trim() === String(texto).trim()) return r + 1;
    }
  }
  return -1;
}

// Escribe un ID en una fila que no lo tiene. El "candado" evita que dos lecturas
// al mismo tiempo le pongan dos IDs distintos a la misma fila.
function asignarID(sheet, sheetName, fila, columna) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var celda = sheet.getRange(fila, columna);
    var actual = String(celda.getValue()).trim();
    if (actual !== '') return actual; // otra lectura ya lo asignó
    var id = nuevoID(sheetName);
    celda.setValue(id);
    return id;
  } catch (err) {
    Logger.log('No se pudo asignar ID: ' + err.toString());
    return '';
  } finally {
    lock.releaseLock();
  }
}

// ===== Helpers útiles integrados =====
function replyJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// [CAMBIO 2] Devuelve true si el valor es una fecha válida (forma segura de detectarlo)
function esFecha(val) {
  return Object.prototype.toString.call(val) === '[object Date]' && !isNaN(val.getTime());
}

function formatDateStandard(d) {
  var day = ("0" + d.getDate()).slice(-2);
  var month = ("0" + (d.getMonth() + 1)).slice(-2);
  var year = d.getFullYear();
  return day + "/" + month + "/" + year;
}

function getFallbackKey(key) {
  var map = {
    'Titulo': 'title', 'Tipo': 'type', 'FechaInicio': 'date', 'HoraInicio': 'startHour',
    'UbicacionInicio': 'location', 'CoordsInicio': 'CoordsInicio',
    'FechaFin': 'endDate', 'HoraFin': 'endHour', 'UbicacionFin': 'destLink', 'CoordsFin': 'CoordsFin',
    'Costo': 'cost', 'Detalles': 'details', 'Duracion': 'durationHours',
    'CodigoReserva': 'bookingCode', 'Nombre': 'title', 'Ciudad': 'location',
    'CheckIn': 'startHour', 'CheckOut': 'endHour', 'LinkReserva': 'bookingCode',
    'Direccion': 'location', 'Coords': 'Coords',
    'Concepto': 'title', 'Monto_ARS': 'cost', 'Monto_Dlr': 'cost'
  };
  return map[key] || key;
}

// Expande links cortos de Google Maps leyendo el encabezado Location (sin seguir redirecciones solas)
// [CAMBIO 3] Si el link no trae coordenadas (links compartidos desde la app del celular),
// usa el nombre/dirección del lugar y lo consulta en el geocodificador de Apps Script.
function resolveGoogleMapsCoords(urlOrText) {
  if (!urlOrText || typeof urlOrText !== 'string') return "";

  // 1. Si ya viene como "lat,lng"
  var directMatch = urlOrText.match(/^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/);
  if (directMatch) return directMatch[1] + "," + directMatch[2];

  // 2. Primer link del texto
  var urlMatch = urlOrText.match(/https?:\/\/[^\s]+/);
  if (!urlMatch) return "";

  var currentUrl = urlMatch[0];

  // 3. Si el link ya es largo y trae coordenadas, no hace falta pedir nada
  var coordsDirectas = extraerCoordsDeTexto(currentUrl);
  if (coordsDirectas) return coordsDirectas;

  var nombreLugar = extraerNombreLugar(currentUrl);

  var options = {
    followRedirects: false,
    muteHttpExceptions: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  };

  try {
    // 4. Hasta 5 saltos de redirección, leyendo Location en cada uno
    for (var hop = 0; hop < 5; hop++) {
      var resp = UrlFetchApp.fetch(currentUrl, options);
      var headers = resp.getHeaders();
      var location = headers['Location'] || headers['location'] || '';

      var coords = extraerCoordsDeTexto(location);
      if (coords) return coords;

      // Guardamos el nombre del lugar si la redirección lo trae (plan B)
      var nombre = extraerNombreLugar(location);
      if (nombre) nombreLugar = nombre;

      if (!location) {
        // Sin redirección: buscamos en el contenido de la página
        var coordsPagina = extraerCoordsDeTexto(resp.getContentText());
        if (coordsPagina) return coordsPagina;
        break;
      }
      currentUrl = location;
    }
  } catch (e) {
    Logger.log("Error resolviendo coordenadas: " + e.toString());
  }

  // 5. Plan B: geocodificar por nombre/dirección del lugar
  if (nombreLugar) {
    return geocodificarNombre(nombreLugar);
  }

  return "";
}

// Busca coordenadas dentro de un texto o URL de Google Maps.
// [CAMBIO 5] Prioriza !3d!4d (punto exacto del lugar) sobre @ (centro de la pantalla).
function extraerCoordsDeTexto(texto) {
  if (!texto) return "";
  var t = String(texto);
  var m = t.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ||
          t.match(/query=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/) ||
          t.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  return m ? m[1] + "," + m[2] : "";
}

// [CAMBIO 3] Saca el nombre/dirección del lugar de una URL de Google Maps.
// Ej: .../maps/place/Abasto+Shopping,+Av.+Corrientes+3247,.../data=...  ->  "Abasto Shopping, Av. Corrientes 3247, ..."
// También entiende links del tipo ...?q=Nombre+del+lugar
function extraerNombreLugar(url) {
  if (!url) return "";
  var u = String(url);
  var crudo = "";

  var mPlace = u.match(/\/maps\/place\/([^\/?]+)/);
  if (mPlace) {
    crudo = mPlace[1];
  } else {
    var mQ = u.match(/[?&]q=([^&]+)/);
    if (mQ) crudo = mQ[1];
  }
  if (!crudo) return "";

  var limpio = crudo.replace(/\+/g, ' ');
  try {
    limpio = decodeURIComponent(limpio);
  } catch (e) {
    // si no se puede decodificar, usamos el texto tal cual
  }
  return limpio.trim();
}

// [CAMBIO 3] Pide coordenadas al geocodificador incorporado de Apps Script (gratis, sin clave)
function geocodificarNombre(nombre) {
  try {
    var resp = Maps.newGeocoder().geocode(nombre);
    if (resp && resp.status === 'OK' && resp.results && resp.results.length > 0) {
      var loc = resp.results[0].geometry.location;
      return loc.lat + "," + loc.lng;
    }
    Logger.log('Geocoder sin resultados para: "' + nombre + '" (estado: ' + (resp ? resp.status : 'sin respuesta') + ')');
  } catch (e) {
    Logger.log('Error en geocoder: ' + e.toString());
  }
  return "";
}

// Prueba de diagnóstico: NO escribe en el Sheet
function probarCoords() {
  var link = 'https://maps.app.goo.gl/Pf9BvmsjKartN9SR7';
  Logger.log('Coordenadas detectadas: ' + resolveGoogleMapsCoords(link));
}

// Diagnóstico: muestra cada salto de redirección de un link y busca coordenadas en varios formatos.
// NO escribe en el Sheet.
function diagnosticarLink() {
  var link = 'https://maps.app.goo.gl/phY1r4YLacR9Jeiq5';
  var options = {
    followRedirects: false,
    muteHttpExceptions: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  };
  var url = link;
  var nombreLugar = extraerNombreLugar(link);

  buscarPatron(link, 'En el link original @', /@(-?\d+\.\d+),(-?\d+\.\d+)/);
  buscarPatron(link, 'En el link original !3d!4d', /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);

  for (var hop = 0; hop < 6; hop++) {
    var resp = UrlFetchApp.fetch(url, options);
    var headers = resp.getHeaders();
    var location = headers['Location'] || headers['location'] || '';
    Logger.log('Salto ' + hop + ' | código ' + resp.getResponseCode() + ' | Location: ' + location);

    if (location) {
      buscarPatron(location, 'Salto ' + hop + ' @', /@(-?\d+\.\d+),(-?\d+\.\d+)/);
      buscarPatron(location, 'Salto ' + hop + ' !3d!4d', /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
      var nombre = extraerNombreLugar(location);
      if (nombre) nombreLugar = nombre;
    } else {
      var texto = resp.getContentText();
      Logger.log('--- Buscando dentro de la página ---');
      buscarPatron(texto, 'Página center=', /center=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/);
      buscarPatron(texto, 'Página markers=', /markers=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/);
      buscarPatron(texto, 'Página !3d!4d', /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
      buscarPatron(texto, 'Página [null,null,lat,lng]', /\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/);
      buscarPatron(texto, 'Página @lat,lng', /@(-?\d+\.\d+),(-?\d+\.\d+)/);
      break;
    }
    url = location;
  }

  Logger.log('Nombre del lugar detectado: "' + nombreLugar + '"');
  if (nombreLugar) {
    Logger.log('Resultado del geocodificador (plan B): "' + geocodificarNombre(nombreLugar) + '"');
  }
  Logger.log('Resultado final de resolveGoogleMapsCoords: "' + resolveGoogleMapsCoords(link) + '"');
}

// Ayudante del diagnóstico: busca un patrón y muestra lo que encontró
function buscarPatron(texto, etiqueta, regex) {
  var m = String(texto).match(regex);
  Logger.log(etiqueta + ': ' + (m ? m[1] + ',' + m[2] : '(no encontrado)'));
}
