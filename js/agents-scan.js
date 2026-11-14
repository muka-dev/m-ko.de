// Folder scan for the AI component review. Everything runs in the browser; nothing is uploaded.
(function () {
  'use strict';
  var S = window.AgentScanner;
  var box = document.getElementById('scan-box');
  if (!S || !box) return;
  var input = document.getElementById('scan-input');
  var drop = document.getElementById('scan-drop');
  var status = document.getElementById('scan-status');
  var out = document.getElementById('scan-result');
  var last = null;

  var TXT = {
    en: { reading: 'Reading', of: 'of', files: 'files', none: 'No files found.', error: 'The scan failed:', cls: 'Class', digest: 'Digest (SHA-256 over', digestEnd: 'files)', skipped: 'not read', evidence: 'Where it found this', use: 'Use in the estimate above', forReq: 'For the request:', notes: 'To check by hand', actions: 'Actions', rights: 'Rights', systems: 'Systems', data: 'Data', autonomy: 'Autonomy', lines: 'Lines' },
    de: { reading: 'Lese', of: 'von', files: 'Dateien', none: 'Keine Dateien gefunden.', error: 'Der Scan ist fehlgeschlagen:', cls: 'Klasse', digest: 'Digest (SHA-256 über', digestEnd: 'Dateien)', skipped: 'nicht gelesen', evidence: 'Fundstellen', use: 'In die Abschätzung oben übernehmen', forReq: 'Für die Anfrage:', notes: 'Von Hand zu prüfen', actions: 'Aktionen', rights: 'Rechte', systems: 'Systeme', data: 'Daten', autonomy: 'Eigenständigkeit', lines: 'Zeilen' },
    pt: { reading: 'A ler', of: 'de', files: 'ficheiros', none: 'Nenhum ficheiro encontrado.', error: 'A verificação falhou:', cls: 'Classe', digest: 'Digest (SHA-256 sobre', digestEnd: 'ficheiros)', skipped: 'não lidos', evidence: 'Onde foi encontrado', use: 'Usar na estimativa acima', forReq: 'Para o pedido:', notes: 'A verificar manualmente', actions: 'Ações', rights: 'Permissões', systems: 'Sistemas', data: 'Dados', autonomy: 'Autonomia', lines: 'Linhas' }
  };
  var NOTES = {
    'No approval step found although the component can change things. Counted as unattended; correct by hand if a person confirms each step.': {
      de: 'Kein Freigabeschritt gefunden, obwohl die Komponente etwas verändern kann. Als „läuft ohne Aufsicht“ gezählt; von Hand korrigieren, falls ein Mensch jeden Schritt bestätigt.',
      pt: 'Nenhum passo de aprovação encontrado, embora o componente possa alterar coisas. Contado como sem supervisão; corrigir manualmente se uma pessoa confirmar cada passo.' },
    'No tools or skills recognised. The count of actions needs checking by hand.': {
      de: 'Keine Tools oder Skills erkannt. Die Zahl der Aktionen muss von Hand geprüft werden.',
      pt: 'Nenhuma ferramenta ou skill reconhecida. O número de ações tem de ser verificado manualmente.' },
    '"Data of several organisations" cannot be detected. Set it by hand if it applies.': {
      de: '„Daten mehrerer Organisationen“ lassen sich nicht erkennen. Von Hand setzen, falls es zutrifft.',
      pt: '«Dados de várias organizações» não podem ser detetados. Definir manualmente, se se aplicar.' }
  };
  function note(n) { var l = lang(); return (NOTES[n] && NOTES[n][l]) || n; }
  function lang() { var l = document.documentElement.getAttribute('lang'); return l === 'de' || l === 'pt' ? l : 'en'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function readEntries(reader) {
    return new Promise(function (resolve, reject) {
      var all = [];
      (function next() {
        reader.readEntries(function (batch) {
          if (!batch.length) return resolve(all);
          all = all.concat(Array.prototype.slice.call(batch));
          next();
        }, reject);
      })();
    });
  }
  function walk(entry, path, acc) {
    if (entry.isFile) {
      return new Promise(function (res, rej) { entry.file(function (f) { acc.push({ path: path, file: f }); res(); }, rej); });
    }
    if (S.plan(path + '/_', 0).reason === 'ignored folder') { acc.push({ path: path + '/_', file: { size: 0, skip: true } }); return Promise.resolve(); }
    return readEntries(entry.createReader()).then(function (children) {
      return children.reduce(function (p, c) { return p.then(function () { return walk(c, path + '/' + c.name, acc); }); }, Promise.resolve());
    });
  }

  function toInputs(items) { // items: [{ path, file }]
    var t = TXT[lang()], done = 0;
    var inputs = [];
    function step(i) {
      if (i >= items.length) return Promise.resolve(inputs);
      var it = items[i];
      status.textContent = t.reading + ' ' + (i + 1) + ' ' + t.of + ' ' + items.length + ' ' + t.files + ' …';
      var pl = S.plan(it.path, it.file.size);
      if (!pl.read) { inputs.push({ path: it.path, bytes: new Uint8Array(0), size: it.file.size }); return step(i + 1); }
      return it.file.arrayBuffer().then(function (buf) { inputs.push({ path: it.path, bytes: new Uint8Array(buf) }); return step(i + 1); });
    }
    return step(0);
  }

  function run(items) {
    out.innerHTML = '';
    if (!items.length) { status.textContent = TXT[lang()].none; return; }
    toInputs(items).then(S.scan).then(function (r) {
      last = r; status.textContent = '';
      try { sessionStorage.setItem('mko-scan', JSON.stringify({ size: r.size, scan: { scanner: r.scanner, digest: r.digest } })); } catch (e) { /* storage not available */ } render(); document.dispatchEvent(new CustomEvent('scanresult', { detail: r }));
    }).catch(function (e) { status.textContent = TXT[lang()].error + ' ' + e.message; });
  }

  function list(title, rows) {
    if (!rows.length) return '';
    return '<li><strong>' + esc(title) + '</strong><ul>' + rows.map(function (r) { return '<li>' + r + '</li>'; }).join('') + '</ul></li>';
  }
  function ev(rows) { return rows.map(function (e) { return typeof e === 'string' ? '<code>' + esc(e) + '</code>' : '<code>' + esc(e.file) + ':' + e.line + '</code> ' + esc(e.text); }); }

  function render() {
    if (!last) return;
    var t = TXT[lang()], r = last, s = r.size;
    var req = { size: s, scan: { scanner: r.scanner, digest: r.digest } };
    out.innerHTML =
      '<p class="sizer__class"><span>' + t.cls + '</span> <strong>' + r.class + '</strong></p>' +
      '<ul class="scanfacts"><li>' + t.actions + ': ' + s.actions + '</li><li>' + t.rights + ': ' + esc(s.rights) + '</li><li>' + t.systems + ': ' + s.systems + '</li><li>' + t.data + ': ' + esc(s.data) + '</li><li>' + t.autonomy + ': ' + esc(s.autonomy) + '</li><li>' + t.lines + ': ' + s.lines + '</li></ul>' +
      '<p class="offer__note">' + t.digest + ' ' + r.digest.files + ' ' + t.digestEnd + ': <code class="digest">' + r.digest.value + '</code>; ' + r.skipped.count + ' ' + t.skipped + '</p>' +
      (r.notes.length ? '<p class="offer__note"><strong>' + t.notes + ':</strong> ' + r.notes.map(function (n) { return esc(note(n)); }).join(' ') + '</p>' : '') +
      '<details class="scanev"><summary>' + t.evidence + '</summary><ul>' +
        list(t.actions, ev(r.evidence.actions)) + list(t.rights, ev(r.evidence.rights)) + list(t.systems, ev(r.evidence.systems)) +
        list(t.data, ev(r.evidence.data)) + list(t.autonomy, ev(r.evidence.autonomy)) + '</ul></details>' +
      '<p class="offer__note">' + t.forReq + '</p><pre class="code" tabindex="0"><code>' + esc(JSON.stringify(req, null, 2)) + '</code></pre>';
  }

  input.addEventListener('change', function () {
    var files = Array.prototype.slice.call(input.files || []);
    run(files.map(function (f) { return { path: f.webkitRelativePath || f.name, file: f }; }));
  });
  ['dragenter', 'dragover'].forEach(function (n) { drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.add('is-over'); }); });
  ['dragleave', 'drop'].forEach(function (n) { drop.addEventListener(n, function () { drop.classList.remove('is-over'); }); });
  drop.addEventListener('drop', function (e) {
    e.preventDefault();
    var items = Array.prototype.slice.call(e.dataTransfer.items || []);
    var entries = items.map(function (i) { return i.webkitGetAsEntry && i.webkitGetAsEntry(); }).filter(Boolean);
    if (!entries.length) { run(Array.prototype.slice.call(e.dataTransfer.files || []).map(function (f) { return { path: f.name, file: f }; })); return; }
    var acc = [];
    entries.reduce(function (p, en) { return p.then(function () { return walk(en, en.name, acc); }); }, Promise.resolve())
      .then(function () { run(acc.filter(function (a) { return !a.file.skip; })); })
      .catch(function (err) { status.textContent = TXT[lang()].error + ' ' + err.message; });
  });
  document.addEventListener('langchange', render);
})();
