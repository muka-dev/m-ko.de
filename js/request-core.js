// Request builder: turns the form fields into a mail text, a JSON request and a mailto link.
// Pure functions, no DOM. Runs in the browser and in Node (tests). Nothing is sent from here.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RequestCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SERVICES = ['consulting', 'ai-check', 'production-check', 'ai-pentest', 'agent-review', 'other'];
  var LIMITS = { subject: 200, message: 1500, name: 100, email: 200, behalf: 200 };
  var MAILTO_MAX = 1800;
  // Assembled at run time so the address is not a plain string in the page source.
  var RECIPIENT = ['request', 'm-ko.de'];

  var LABELS = {
    en: { subject: 'Request', service: 'Service', about: 'Subject', message: 'Message', contact: 'Contact', requester: 'Sent by', agent: 'AI agent on behalf of', human: 'a person or company', size: 'Size estimate', scan: 'Scan digest', note: 'Prepared with the request assistant on m-ko.de. A responsible person confirms before anything is commissioned.', cut: '[shortened, please use "Copy text"]' },
    de: { subject: 'Anfrage', service: 'Leistung', about: 'Gegenstand', message: 'Nachricht', contact: 'Kontakt', requester: 'Gesendet von', agent: 'KI-Agent im Auftrag von', human: 'Mensch oder Unternehmen', size: 'Größenabschätzung', scan: 'Scan-Digest', note: 'Vorbereitet mit dem Anfrage-Assistenten auf m-ko.de. Ein Verantwortlicher bestätigt, bevor etwas beauftragt wird.', cut: '[gekürzt, bitte „Text kopieren“ nutzen]' },
    pt: { subject: 'Pedido', service: 'Serviço', about: 'Assunto', message: 'Mensagem', contact: 'Contacto', requester: 'Enviado por', agent: 'Agente de IA em nome de', human: 'pessoa ou empresa', size: 'Estimativa de tamanho', scan: 'Digest da análise', note: 'Preparado com o assistente de pedidos em m-ko.de. Um responsável confirma antes de qualquer encomenda.', cut: '[encurtado, use «Copiar texto»]' }
  };
  var SERVICE_NAMES = {
    en: { consulting: 'AI project or consulting', 'ai-check': 'AI check', 'production-check': 'Production check', 'ai-pentest': 'AI pentest', 'agent-review': 'Review for AI agents', other: 'Other' },
    de: { consulting: 'KI-Projekt oder Beratung', 'ai-check': 'KI-Check', 'production-check': 'Produktionscheck', 'ai-pentest': 'AI-Pentest', 'agent-review': 'Prüfung für KI-Agenten', other: 'Sonstiges' },
    pt: { consulting: 'Projeto de IA ou consultoria', 'ai-check': 'Verificação de IA', 'production-check': 'Verificação de produção', 'ai-pentest': 'Pentest de IA', 'agent-review': 'Revisão para agentes de IA', other: 'Outro' }
  };

  function clean(s, max) { return String(s == null ? '' : s).replace(/\r/g, '').trim().slice(0, max); }
  function oneLine(s, max) { return clean(s, max).replace(/\s+/g, ' '); }
  function validEmail(e) { return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(e); }

  // fields: { service, subject, message, name, email, agent (bool), behalf, size?, scan?, lang }
  function build(fields) {
    var f = fields || {};
    var lang = f.lang === 'de' || f.lang === 'pt' ? f.lang : 'en';
    var L = LABELS[lang];
    var errors = [];
    var service = SERVICES.indexOf(f.service) !== -1 ? f.service : '';
    var subject = oneLine(f.subject, LIMITS.subject);
    var message = clean(f.message, LIMITS.message);
    var name = oneLine(f.name, LIMITS.name);
    var email = oneLine(f.email, LIMITS.email);
    var agent = !!f.agent;
    var behalf = oneLine(f.behalf, LIMITS.behalf);
    if (!service) errors.push('service');
    if (!subject) errors.push('subject');
    if (!validEmail(email)) errors.push('email');
    if (agent && !behalf) errors.push('behalf');

    var json = {
      service: service, subject: subject, message: message,
      contact: { name: name, email: email },
      requester: agent ? { type: 'agent', on_behalf_of: behalf } : { type: 'human' },
      lang: lang, source: 'm-ko.de/request'
    };
    if (f.size) json.size = f.size;
    if (f.scan) json.scan = f.scan;

    var lines = [];
    lines.push(L.service + ': ' + SERVICE_NAMES[lang][service || 'other']);
    lines.push(L.about + ': ' + subject);
    lines.push(L.contact + ': ' + (name ? name + ' <' + email + '>' : email));
    lines.push(L.requester + ': ' + (agent ? L.agent + ' ' + behalf : L.human));
    if (message) { lines.push(''); lines.push(L.message + ':'); lines.push(message); }
    if (f.size) { lines.push(''); lines.push(L.size + ': ' + JSON.stringify(f.size)); }
    if (f.scan && f.scan.digest) lines.push(L.scan + ': ' + f.scan.digest.algorithm + ' ' + f.scan.digest.value + ' (' + f.scan.digest.files + ')');
    lines.push(''); lines.push(L.note);
    var text = lines.join('\n');
    var mailSubject = L.subject + ': ' + SERVICE_NAMES[lang][service || 'other'] + (subject ? ' – ' + subject.slice(0, 80) : '');

    var to = RECIPIENT[0] + '@' + RECIPIENT[1];
    var body = text;
    var cut = false;
    function url(b) { return 'mailto:' + to + '?subject=' + encodeURIComponent(mailSubject) + '&body=' + encodeURIComponent(b); }
    var link = url(body);
    while (link.length > MAILTO_MAX && body.length > 200) { body = body.slice(0, Math.floor(body.length * 0.8)); cut = true; link = url(body + '\n' + L.cut); }

    return { valid: errors.length === 0, errors: errors, json: json, text: text, subject: mailSubject, mailto: link, truncated: cut };
  }

  return { SERVICES: SERVICES, LIMITS: LIMITS, build: build };
});
