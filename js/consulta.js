// Agente de consulta: antes POST /api/analizar (analyze() de agent.py).
// Recibe la pregunta y usa como filtros el estado y el contaminante seleccionados,
// igual que el modelo Question(question, estado, contaminante) de la versión en Python.
'use strict';
(() => {
  const form = document.getElementById('askForm');
  const input = document.getElementById('askInput');
  const out = document.getElementById('askAnswer');

  function currentPollutant() {
    if (currentView === 2) {
      const v = document.getElementById('municipalPollutant').value;
      return v === ALL_MUNICIPAL ? '' : v;
    }
    return document.getElementById('pollutant').value;
  }

  function ask(question) {
    question = question.trim();
    if (!question) { input.focus(); return; }
    const estado = document.getElementById('state').value;
    const contaminante = currentPollutant();
    const respuesta = Agente.analyze(question, estado, contaminante);
    out.replaceChildren();
    const q = document.createElement('p');
    q.className = 'answer-q';
    q.textContent = question;
    const filtros = [estado, contaminante].filter(Boolean);
    if (filtros.length) {
      const f = document.createElement('small');
      f.textContent = 'Filtros: ' + filtros.join(' · ');
      q.append(f);
    }
    const a = document.createElement('p');
    a.className = 'answer-a';
    a.textContent = respuesta;               // conserva saltos de línea (white-space: pre-line)
    out.append(q, a);
    out.hidden = false;
  }

  form.addEventListener('submit', e => { e.preventDefault(); ask(input.value); });
  document.querySelectorAll('#ask-agent .chip').forEach(chip =>
    chip.addEventListener('click', () => { input.value = chip.textContent; ask(chip.textContent); }));
})();
