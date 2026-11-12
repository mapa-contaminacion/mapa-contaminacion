// Agente de contaminantes RETC 2024 — versión 100% JavaScript (antes agent.py).
// Toda la lógica corre en el navegador; no requiere servidor, PHP ni Python.
'use strict';

const Agente = (() => {
  let ROWS = [];

  // Igual que clean() de Python: minúsculas y sin acentos.
  const clean = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // Conversión estricta tipo float() de Python: '' o texto inválido => NaN.
  function toNum(v) {
    if (typeof v === 'number') return v;
    const t = String(v ?? '').trim();
    if (!t) return NaN;
    if (/^[+-]?inf(inity)?$/i.test(t)) return t.startsWith('-') ? -Infinity : Infinity;
    return /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t) ? Number(t) : NaN;
  }
  const validEmission = v => Number.isFinite(v) && v >= 0;
  // Redondeo idéntico al de Python (round() y '{:,.2f}'): se redondea el valor binario
  // exacto del número y, solo en empates exactos (…5 sin más dígitos), al dígito par.
  // toFixed() ya trabaja sobre el valor exacto; solo hay que corregir los empates.
  function pyFixed(v, d) {
    v = Number(v);
    if (!Number.isFinite(v)) return String(v);
    const a = Math.abs(v);
    if (a >= 1e21) return (v < 0 ? '-' : '') + a.toFixed(0);
    let out = a.toFixed(d);                          // redondeo exacto, empates hacia arriba
    const exact = a.toFixed(Math.min(100, d + 60));  // expansión decimal (exacta para estos datos)
    const [ip, fp = ''] = exact.split('.');
    const tail = fp.slice(d);
    if (/^50*$/.test(tail)) {                        // empate exacto: Python redondea al par
      const truncated = d ? ip + '.' + fp.slice(0, d) : ip;
      const lastDigit = Number(truncated[truncated.length - 1]);
      if (lastDigit % 2 === 0) out = truncated;
    }
    if (Number(out) === 0) return out;               // sin "-0"
    return (v < 0 ? '-' : '') + out;
  }
  const round = (v, d) => Number(pyFixed(v, d));
  // Igual que '{:,.2f}' de Python: separador de miles con coma y punto decimal.
  const fmt = (v, d = 2) => {
    const [i, f] = pyFixed(v, d).split('.');
    const sign = i.startsWith('-') ? '-' : '';
    const grouped = i.replace('-', '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return sign + grouped + (f !== undefined ? '.' + f : '');
  };
  // Igual que sum() de Python 3.12+: suma compensada de Neumaier.
  function pySum(values) {
    let s = 0, c = 0;
    for (const x of values) {
      const t = s + x;
      c += Math.abs(s) >= Math.abs(x) ? (s - t) + x : (x - t) + s;
      s = t;
    }
    return c && Number.isFinite(c) ? s + c : s;
  }
  const siteKey = r => r.nra || [r.establecimiento, r.latitud, r.longitud].join('|');
  const textOf = (r, keys) => clean(keys.map(k => String(r[k] ?? '')).join(' '));

  // Equivalente a get_rows(): solo filas con coordenadas válidas dentro de México.
  function setRows(rawRows) {
    ROWS = [];
    for (const row of rawRows) {
      const lat = toNum(row.latitud), lon = toNum(row.longitud);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      if (!(lat >= 14 && lat <= 33 && lon >= -119 && lon <= -86)) continue;
      const r = {};
      for (const k in row) r[k] = row[k] == null ? '' : String(row[k]);
      r.latitud = lat; r.longitud = lon;
      ROWS.push(r);
    }
    return ROWS;
  }
  const getRows = () => ROWS;

  function analyze(question, estado = '', contaminante = '') {
    let rows = getRows();
    if (!rows.length) return 'Todavía no hay registros georreferenciados. Agrega filas verificadas al archivo data/contaminantes.csv y recarga el navegador.';
    if (estado) rows = rows.filter(r => r.estado === estado);
    if (contaminante) rows = rows.filter(r => r.contaminante === contaminante);
    const q = clean(question);
    const contaminants = [...new Set(rows.map(r => r.contaminante).filter(Boolean))].sort();
    const matched = contaminants.filter(x => q.includes(clean(x)));
    if (matched.length) rows = rows.filter(r => r.contaminante === matched[0]);
    if (!rows.length) return 'No hay registros para los filtros seleccionados.';
    if (q.includes('cuant') || q.includes('numero') || q.includes('total de')) return `Hay ${rows.length} registros georreferenciados que cumplen los filtros.`;
    const units = new Set(rows.map(r => (r.unidad || '').trim()));
    const substances = new Set(rows.map(r => (r.contaminante || '').trim()));
    if (['mas', 'mayor', 'ranking', 'top'].some(w => q.includes(w)) && (units.size !== 1 || substances.size !== 1))
      return 'Para comparar emisiones, selecciona un solo contaminante y una unidad homogénea. Los registros actuales mezclan sustancias o unidades.';
    const bySite = ['gasolinera', 'establecimiento', 'fuente'].some(w => q.includes(w));
    const totals = new Map();
    for (const r of rows) {
      const v = toNum(r.emision);
      if (!validEmission(v)) continue;
      const key = bySite ? (r.establecimiento || '') : (r.estado || '');
      totals.set(key, (totals.get(key) || 0) + v);
    }
    if (totals.size && units.size === 1 && substances.size === 1) {
      const order = [...totals].sort((a, b) => b[1] - a[1]).slice(0, 5);
      return 'Mayores emisiones reportadas de ' + [...substances][0] + ' (' + [...units][0] + '):\n' +
        order.map(([k, v], i) => `${i + 1}. ${k}: ${fmt(v)}`).join('\n') +
        '\nComparación de registros cargados; no implica concentración ambiental.';
    }
    return `Se encontraron ${rows.length} registros. Contaminantes presentes: ` + (contaminants.slice(0, 12).join(', ') || 'no informados') + '. Selecciona un contaminante y unidad para comparar cantidades.';
  }

  // Antes /api/resumen: comparación de una sola sustancia y una unidad.
  function automaticSummary(contaminante = '', estado = '', sector = '', buscar = '') {
    const search = clean(buscar);
    const rows = getRows().filter(r =>
      (!contaminante || r.contaminante === contaminante) &&
      (!estado || r.estado === estado) &&
      (!sector || r.sector === sector) &&
      (!search || textOf(r, ['establecimiento', 'municipio', 'estado', 'sector']).includes(search)));
    const establishments = new Set(rows.map(siteKey)).size;
    const out = { registros: rows.length, establecimientos: establishments, contaminante, estado, sector,
      ranking_estados: [], ranking_municipios: [], unidad: '', total: null, mensaje: '' };
    if (!rows.length) {
      out.mensaje = 'No hay registros para esta selección. Cambia los filtros para explorar otras zonas.';
      return out;
    }
    if (!contaminante) {
      out.mensaje = `Se muestran ${rows.length.toLocaleString('es-MX')} registros de emisiones al aire correspondientes a ${establishments.toLocaleString('es-MX')} establecimientos. Selecciona un contaminante para identificar dónde se reportan mayores cantidades; no es válido sumar sustancias distintas.`;
      return out;
    }
    const units = new Set(rows.map(r => (r.unidad || '').trim()).filter(Boolean).map(clean));
    if (units.size !== 1) {
      out.mensaje = 'Las unidades son diferentes o faltan unidades. No se comparan las cantidades hasta homologarlas.';
      return out;
    }
    const unit = (rows[0].unidad || '').trim();
    const stateTotals = new Map(), munTotals = new Map();
    let valid = 0;
    for (const r of rows) {
      const v = toNum(r.emision);
      if (!validEmission(v)) continue;
      valid++;
      const st = r.estado || 'Sin estado', mu = r.municipio || 'Sin municipio';
      stateTotals.set(st, (stateTotals.get(st) || 0) + v);
      const key = st + '\u0000' + mu;
      munTotals.set(key, (munTotals.get(key) || 0) + v);
    }
    const total = pySum(stateTotals.values());
    const pct = v => total ? round(v / total * 100, 2) : 0;
    const byValue = (a, b) => b[1] - a[1];
    Object.assign(out, {
      unidad: unit, total, registros_validos: valid,
      ranking_estados: [...stateTotals].sort(byValue).slice(0, 8).map(([k, v]) => ({ nombre: k, valor: round(v, 5), porcentaje: pct(v) })),
      ranking_municipios: [...munTotals].sort(byValue).slice(0, 8).map(([k, v]) => {
        const [st, mu] = k.split('\u0000');
        return { estado: st, municipio: mu, valor: round(v, 5), porcentaje: pct(v) };
      })
    });
    if (!total) {
      out.mensaje = `Hay ${valid} registros de ${contaminante}, pero no se reportan cantidades positivas para esta selección.`;
    } else if (stateTotals.size) {
      const [winner, wv] = [...stateTotals].sort(byValue)[0];
      const [mk, mv] = [...munTotals].sort(byValue)[0];
      const [mst, mmu] = mk.split('\u0000');
      const area = estado ? `en ${estado}` : 'en México';
      out.mensaje = `Para ${contaminante}, el mayor total de emisiones reportadas ${area} se registra en ` +
        `${winner}: ${fmt(wv)} ${unit} (${pyFixed(wv / total * 100, 1)}% del total filtrado). ` +
        `Entre los municipios destaca ${mmu} (${mst}), con ${fmt(mv)} ${unit}. ` +
        'Se compara cantidad de emisiones declaradas, NO concentración en el aire ni riesgo para la salud.';
    }
    return out;
  }

  // Antes /api/sector: ranking de sustancias por número de establecimientos.
  function sectorDashboard(estado = '', sector = '', buscar = '') {
    const q = clean(buscar);
    const rows = getRows().filter(r =>
      (!estado || r.estado === estado) && (!sector || r.sector === sector) &&
      (!q || textOf(r, ['establecimiento', 'municipio', 'estado', 'sector']).includes(q)));
    const bySub = new Map(), allSites = new Set();
    for (const r of rows) {
      const key = siteKey(r);
      allSites.add(key);
      const sub = r.contaminante || 'Sin identificar';
      if (!bySub.has(sub)) bySub.set(sub, { nombre: sub, sitios: new Set(), registros: 0, unidades: new Set(), total: 0 });
      const d = bySub.get(sub);
      d.sitios.add(key); d.registros++; d.unidades.add((r.unidad || '').trim());
      const v = toNum(r.emision);
      if (validEmission(v)) d.total += v;
    }
    const ranking = [...bySub.values()].map(d => ({
      nombre: d.nombre, establecimientos: d.sitios.size, registros: d.registros,
      total: d.unidades.size === 1 && !d.unidades.has('') ? round(d.total, 3) : null,
      unidad: d.unidades.size === 1 ? [...d.unidades][0] : 'Unidades diferentes',
      cobertura_pct: allSites.size ? round(100 * d.sitios.size / allSites.size, 1) : 0
    }));
    ranking.sort((a, b) => b.establecimientos - a.establecimientos || b.registros - a.registros || (a.nombre < b.nombre ? -1 : a.nombre > b.nombre ? 1 : 0));
    return {
      establecimientos: allSites.size, registros: rows.length, sustancias: ranking.length,
      ranking: ranking.slice(0, 30),
      medios: [
        { nombre: 'Aire', disponible: true, registros: rows.length },
        { nombre: 'Agua', disponible: false, registros: null },
        { nombre: 'Suelo', disponible: false, registros: null },
        { nombre: 'Transferencias', disponible: false, registros: null }
      ]
    };
  }

  // Antes /api/health
  const health = () => ({ ok: true, registros: getRows().length });

  return { clean, toNum, setRows, getRows, analyze, automaticSummary, sectorDashboard, health };
})();
