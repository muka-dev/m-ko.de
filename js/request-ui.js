// Request assistant: form, preview and the ways to send. Everything runs in the browser.
(function () {
  'use strict';
  var C = window.RequestCore;
  var root = document.getElementById('request-app');
  if (!C || !root) return;

  var T = {
    en: {
      service: 'Service', who: 'Who is asking?', human: 'A person or company', agent: 'An AI agent on behalf of a responsible person',
      behalf: 'Person or company the agent acts for', subject: 'What is it about? (topic, app, component or repository)', message: 'Anything I should know? (short)',
      name: 'Your name (optional)', email: 'Email address for the reply', attach: 'Attach the size estimate and scan result from this browser',
      preview: 'Your request', open: 'Open in mail program', copy: 'Copy text', json: 'Download as JSON', send: 'Send directly', copied: 'Copied.',
      sent: 'Received. Reference:', sentNote: 'A responsible person confirms by email before anything is commissioned.', failed: 'Sending failed:', fix: 'Please check:',
      errors: { service: 'service', subject: 'what it is about', email: 'a valid email address', behalf: 'who the agent acts for' },
      cut: 'The mail link was shortened because mail programs limit its length. Please use "Copy text" for the full request.',
      noSecrets: 'Please do not send keys, passwords or credentials, only descriptions.'
    },
    de: {
      service: 'Leistung', who: 'Wer fragt an?', human: 'Ein Mensch oder Unternehmen', agent: 'Ein KI-Agent im Auftrag einer verantwortlichen Person',
      behalf: 'Person oder Unternehmen, für die der Agent handelt', subject: 'Worum geht es? (Thema, App, Komponente oder Repository)', message: 'Was sollte ich wissen? (kurz)',
      name: 'Name (optional)', email: 'E-Mail-Adresse für die Antwort', attach: 'Größenabschätzung und Scan-Ergebnis aus diesem Browser anhängen',
      preview: 'Die Anfrage', open: 'Im Mailprogramm öffnen', copy: 'Text kopieren', json: 'Als JSON herunterladen', send: 'Direkt senden', copied: 'Kopiert.',
      sent: 'Eingegangen. Referenz:', sentNote: 'Ein Verantwortlicher bestätigt per E-Mail, bevor etwas beauftragt wird.', failed: 'Senden fehlgeschlagen:', fix: 'Bitte prüfen:',
      errors: { service: 'Leistung', subject: 'worum es geht', email: 'eine gültige E-Mail-Adresse', behalf: 'für wen der Agent handelt' },
      cut: 'Der Mail-Link wurde gekürzt, weil Mailprogramme seine Länge begrenzen. Für die vollständige Anfrage bitte „Text kopieren“ nutzen.',
      noSecrets: 'Bitte keine Schlüssel, Passwörter oder Zugangsdaten senden, nur Beschreibungen.'
    },
    pt: {
      service: 'Serviço', who: 'Quem faz o pedido?', human: 'Uma pessoa ou empresa', agent: 'Um agente de IA em nome de uma pessoa responsável',
      behalf: 'Pessoa ou empresa em nome da qual o agente atua', subject: 'De que se trata? (tema, app, componente ou repositório)', message: 'Algo que eu deva saber? (curto)',
      name: 'Nome (opcional)', email: 'Endereço de email para a resposta', attach: 'Anexar a estimativa de tamanho e o resultado da análise deste browser',
      preview: 'O pedido', open: 'Abrir no programa de email', copy: 'Copiar texto', json: 'Descarregar como JSON', send: 'Enviar diretamente', copied: 'Copiado.',
      sent: 'Recebido. Referência:', sentNote: 'Um responsável confirma por email antes de qualquer encomenda.', failed: 'O envio falhou:', fix: 'Por favor verifique:',
      errors: { service: 'o serviço', subject: 'de que se trata', email: 'um email válido', behalf: 'em nome de quem o agente atua' },
      cut: 'A ligação de email foi encurtada porque os programas de email limitam o seu comprimento. Use «Copiar texto» para o pedido completo.',
      noSecrets: 'Por favor, não enviem chaves, palavras-passe nem credenciais, apenas descrições.'
    }
  };
  var SERVICES = { en: { 'ai-adoption': 'AI adoption', 'interim': 'Interim IT lead', 'production-check': 'Production check', 'security-review': 'AI security review', 'agent-review': 'Review for AI agents', 'other': 'Other' },
    de: { 'ai-adoption': 'KI-Einführung', 'interim': 'IT-Leitung auf Zeit', 'production-check': 'Produktionscheck', 'security-review': 'KI-Sicherheitsreview', 'agent-review': 'Prüfung für KI-Agenten', 'other': 'Sonstiges' },
    pt: { 'ai-adoption': 'Adoção de IA', 'interim': 'Direção de TI interina', 'production-check': 'Verificação de produção', 'security-review': 'Revisão de segurança de IA', 'agent-review': 'Revisão para agentes de IA', 'other': 'Outro' } };

  var state = { service: '', agent: false, behalf: '', subject: '', message: '', name: '', email: '', attach: true, website: '' };
  var endpoint = false;
  var params = new URLSearchParams(location.search);
  var wanted = (C.LEGACY && C.LEGACY[params.get('service')]) || params.get('service');
  if (C.SERVICES.indexOf(wanted) !== -1) state.service = wanted;
  if (params.get('agent') === '1') state.agent = true;

  function lang() { var l = document.documentElement.getAttribute('lang'); return l === 'de' || l === 'pt' ? l : 'en'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function stored(key) { try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (e) { return null; } }
  function attachment() {
    var scan = stored('mko-scan'), est = stored('mko-size');
    if (scan && scan.size) return { size: scan.size, scan: scan.scan };
    if (est && est.size) return { size: est.size };
    return null;
  }
  function fields() {
    var a = state.attach ? attachment() : null;
    return { service: state.service, subject: state.subject, message: state.message, name: state.name, email: state.email, agent: state.agent, behalf: state.behalf,
      size: a && a.size, scan: a && a.scan, lang: lang() };
  }

  function buildForm() {
    var t = T[lang()], s = SERVICES[lang()];
    var opts = '<option value="">–</option>' + C.SERVICES.map(function (k) { return '<option value="' + k + '"' + (state.service === k ? ' selected' : '') + '>' + s[k] + '</option>'; }).join('');
    var a = attachment();
    root.querySelector('[data-form]').innerHTML =
      '<label class="req__row"><span>' + t.service + '</span><select name="service">' + opts + '</select></label>' +
      '<label class="req__row"><span>' + t.who + '</span><select name="agent"><option value="0"' + (state.agent ? '' : ' selected') + '>' + t.human + '</option><option value="1"' + (state.agent ? ' selected' : '') + '>' + t.agent + '</option></select></label>' +
      '<label class="req__row" data-behalf' + (state.agent ? '' : ' hidden') + '><span>' + t.behalf + '</span><input name="behalf" maxlength="200" value="' + esc(state.behalf) + '"></label>' +
      '<label class="req__row"><span>' + t.subject + '</span><input name="subject" maxlength="200" value="' + esc(state.subject) + '"></label>' +
      '<label class="req__row"><span>' + t.message + '</span><textarea name="message" rows="4" maxlength="1500">' + esc(state.message) + '</textarea></label>' +
      '<label class="req__row"><span>' + t.name + '</span><input name="name" maxlength="100" autocomplete="name" value="' + esc(state.name) + '"></label>' +
      '<label class="req__row"><span>' + t.email + '</span><input name="email" type="email" maxlength="200" autocomplete="email" value="' + esc(state.email) + '"></label>' +
      '<label class="req__row req__trap" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off" value=""></label>' +
      (a ? '<label class="req__check"><input type="checkbox" name="attach"' + (state.attach ? ' checked' : '') + '> <span>' + t.attach + '</span></label>' : '') +
      '<p class="offer__note">' + t.noSecrets + '</p>';
    render();
  }

  function render() {
    var t = T[lang()], r = C.build(fields());
    var out = root.querySelector('[data-out]');
    var filled = state.service || state.subject || state.email;
    if (!filled) { out.innerHTML = ''; return; }
    var errs = r.valid ? '' : '<p class="offer__note">' + t.fix + ' ' + r.errors.map(function (e) { return t.errors[e]; }).join(', ') + '</p>';
    out.innerHTML = '<h3>' + t.preview + '</h3><pre class="code" tabindex="0"><code>' + esc(r.text) + '</code></pre>' + errs +
      '<div class="req__actions">' +
      '<a class="btn" data-open href="' + esc(r.mailto) + '"' + (r.valid ? '' : ' aria-disabled="true"') + '>' + t.open + '</a>' +
      '<button class="btn btn--ghost" type="button" data-copy>' + t.copy + '</button>' +
      '<button class="btn btn--ghost" type="button" data-json>' + t.json + '</button>' +
      (endpoint ? '<button class="btn btn--ghost" type="button" data-send>' + t.send + '</button>' : '') + '</div>' +
      (r.truncated ? '<p class="offer__note">' + t.cut + '</p>' : '') + '<p class="offer__note" data-status aria-live="polite"></p>';
  }

  function status(msg) { var s = root.querySelector('[data-status]'); if (s) s.textContent = msg; }

  root.addEventListener('input', function (e) {
    var n = e.target.name; if (!n) return;
    if (n === 'attach') state.attach = e.target.checked;
    else if (n === 'agent') { state.agent = e.target.value === '1'; var b = root.querySelector('[data-behalf]'); if (b) b.hidden = !state.agent; }
    else state[n] = e.target.value;
    render();
  });
  root.addEventListener('click', function (e) {
    var t = T[lang()], r = C.build(fields());
    if (e.target.closest('[data-open]') && !r.valid) { e.preventDefault(); status(t.fix + ' ' + r.errors.map(function (k) { return t.errors[k]; }).join(', ')); }
    if (e.target.closest('[data-copy]')) {
      var done = function () { status(t.copied); };
      if (navigator.clipboard) navigator.clipboard.writeText(r.text).then(done, function () { status(''); }); else status('');
    }
    if (e.target.closest('[data-json]')) {
      var url = URL.createObjectURL(new Blob([JSON.stringify(r.json, null, 2)], { type: 'application/json' }));
      var a = document.createElement('a'); a.href = url; a.download = 'request.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    }
    if (e.target.closest('[data-send]')) {
      if (!r.valid) { status(t.fix + ' ' + r.errors.map(function (k) { return t.errors[k]; }).join(', ')); return; }
      var body = r.json; body.website = state.website;
      fetch('/agents/request.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (res) { return res.json().then(function (j) { return { ok: res.ok, j: j }; }); })
        .then(function (x) { status(x.ok ? t.sent + ' ' + x.j.ref + '. ' + t.sentNote : t.failed + ' ' + (x.j.error || '')); })
        .catch(function (err) { status(t.failed + ' ' + err.message); });
    }
  });
  document.addEventListener('langchange', buildForm);

  // Show "Send directly" only when the server endpoint exists and is switched on.
  fetch('/agents/request.php?status', { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) { if (j && j.enabled) { endpoint = true; render(); } })
    .catch(function () {});

  buildForm();
})();
