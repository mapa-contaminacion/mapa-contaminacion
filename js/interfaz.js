// Interfaz móvil: hoja inferior deslizable, leyenda compacta y cierre automático
// del panel al elegir un elemento que se muestra en el mapa.
'use strict';
(() => {
  const sheet = document.getElementById('sidebar');
  const grip = document.getElementById('sheetGrip');
  const toggle = document.getElementById('sheetToggle');
  const body = sheet.querySelector('.sheet-body');
  const legend = document.getElementById('munLegend');
  const mobile = window.matchMedia('(max-width: 899px)');
  const STATES = ['peek', 'half', 'full'];

  const setState = s => {
    sheet.dataset.state = s;
    toggle.setAttribute('aria-expanded', String(s !== 'peek'));
    if (s === 'peek') body.scrollTop = 0;
  };
  setState('peek');

  // Toque en la cabecera (o Enter en la barra): alterna entre posiciones.
  const cycle = () => {
    const i = STATES.indexOf(sheet.dataset.state);
    setState(i === STATES.length - 1 ? 'peek' : STATES[i + 1]);
  };
  toggle.addEventListener('click', e => { if (mobile.matches && e.detail === 0) cycle(); });

  // Arrastre con el dedo (o ratón) desde la cabecera de la hoja.
  let startY = 0, startOffset = 0, dragging = false, dragMoved = false, lastY = 0, lastT = 0, velocity = 0;
  const offsetFor = s => {
    const h = sheet.offsetHeight;
    const peek = parseFloat(getComputedStyle(sheet).getPropertyValue('--peek')) || 188;
    return s === 'full' ? 0 : s === 'half' ? h * 0.46 : h - peek;
  };
  const currentOffset = () => new DOMMatrixReadOnly(getComputedStyle(sheet).transform).m42;

  grip.addEventListener('pointerdown', e => {
    if (!mobile.matches || e.button > 0) return;
    dragging = true; dragMoved = false;
    startY = lastY = e.clientY; lastT = performance.now(); velocity = 0;
    startOffset = currentOffset();
    grip.setPointerCapture(e.pointerId);
  });
  grip.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dy = e.clientY - startY;
    if (!dragMoved && Math.abs(dy) < 6) return;
    if (!dragMoved) { dragMoved = true; sheet.classList.add('dragging'); }
    const now = performance.now();
    velocity = (e.clientY - lastY) / Math.max(1, now - lastT);
    lastY = e.clientY; lastT = now;
    const max = offsetFor('peek');
    let y = startOffset + dy;
    if (y < 0) y = y * 0.25;                       // resistencia arriba
    if (y > max) y = max + (y - max) * 0.25;        // resistencia abajo
    sheet.style.transform = `translateY(${y}px)`;
  });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    if (!dragMoved) { cycle(); return; }
    sheet.classList.remove('dragging');
    const y = currentOffset();
    sheet.style.transform = '';
    let target;
    if (Math.abs(velocity) > 0.5) {
      // Gesto rápido: avanza una posición en la dirección del movimiento.
      const i = STATES.indexOf(nearest(y));
      target = velocity > 0 ? STATES[Math.max(0, i - 1)] : STATES[Math.min(2, i + 1)];
      if (velocity > 0 && y > offsetFor('half')) target = 'peek';
      if (velocity < 0 && y < offsetFor('half')) target = 'full';
    } else target = nearest(y);
    setState(target);
    setTimeout(() => { dragMoved = false; }, 0);
  };
  const nearest = y => STATES.reduce((a, s) => Math.abs(offsetFor(s) - y) < Math.abs(offsetFor(a) - y) ? s : a, 'peek');
  grip.addEventListener('pointerup', endDrag);
  grip.addEventListener('pointercancel', endDrag);

  // Al empezar a escribir o filtrar con la hoja cerrada, se abre a media altura.
  sheet.addEventListener('focusin', e => {
    if (mobile.matches && sheet.dataset.state === 'peek' && e.target.matches('input,select')) setState('half');
  });

  // Elegir una fuente o un territorio de los rankings mueve el mapa: bajamos la hoja para verlo.
  sheet.addEventListener('click', e => {
    if (!mobile.matches) return;
    if (e.target.closest('.poll-item, #agentStates button, #agentCities button, #munStateRank button, #munCityRank button, #sectorRank button, #extent')) setState('peek');
  }, true); // captura: el ranking se redibuja al hacer clic, así que se evalúa antes

  // Tocar el mapa con la hoja abierta la baja.
  document.getElementById('mapArea').addEventListener('pointerdown', e => {
    if (mobile.matches && sheet.dataset.state === 'full' && !e.target.closest('#viewBar,#munLegend')) setState('half');
  });

  // Leyenda municipal: compacta en móvil, se despliega al tocarla.
  const toggleLegend = () => { if (mobile.matches) legend.classList.toggle('open'); };
  legend.addEventListener('click', toggleLegend);
  legend.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleLegend(); } });

  // En celular, mientras el popup del municipio está abierto se oculta el recuadro
  // #municipioInfo (muestra lo mismo) para no tapar el mapa.
  const info = document.getElementById('municipioInfo');
  let hooked = false;
  const hookPopups = () => {
    if (hooked || typeof municipalMap === 'undefined' || !municipalMap) return;
    hooked = true;
    municipalMap.on('popupopen', () => info.classList.add('popup-open'));
    municipalMap.on('popupclose', () => info.classList.remove('popup-open'));
  };
  document.getElementById('viewMunicipios').addEventListener('click', () => setTimeout(hookPopups, 0));

  mobile.addEventListener('change', () => { setState('peek'); sheet.style.transform = ''; legend.classList.remove('open'); });
})();
