// Size estimate for the review of AI components. Runs in the browser only; nothing is sent anywhere.
(function () {
  'use strict';
  var form = document.getElementById('sizer');
  var out = document.getElementById('sizer-result');
  if (!form || !out) return;

  var CLASSES = ['S', 'M', 'L', 'XL'];
  var PRICE = { S: 390, M: 890, L: 2200, XL: 4500 };

  // Each option: value = class index it points to.
  var FACTORS = [
    { id: 'actions', label: { en: 'Number of actions or tools', de: 'Anzahl Aktionen oder Tools', pt: 'Número de ações ou ferramentas' },
      opts: [
        ['1 to 3', '1 bis 3', '1 a 3'], ['4 to 8', '4 bis 8', '4 a 8'], ['9 to 15', '9 bis 15', '9 a 15'], ['more than 15', 'mehr als 15', 'mais de 15']] },
    { id: 'rights', label: { en: 'What it may do', de: 'Was es darf', pt: 'O que pode fazer' },
      opts: [
        ['read only', 'nur lesen', 'só ler'],
        ['write or send in one system', 'in einem System schreiben oder senden', 'escrever ou enviar num sistema'],
        ['money, deletion, access rights or public posts', 'Geld, Löschen, Zugriffsrechte oder öffentliche Beiträge', 'dinheiro, eliminação, direitos de acesso ou publicações públicas'],
        ['effects across organisations through other agents', 'Wirkung über Organisationen hinweg durch andere Agenten', 'efeitos entre organizações através de outros agentes']] },
    { id: 'systems', label: { en: 'Connected systems', de: 'Angebundene Systeme', pt: 'Sistemas ligados' },
      opts: [
        ['1', '1', '1'], ['2 or 3', '2 oder 3', '2 ou 3'], ['4 or 5', '4 oder 5', '4 ou 5'], ['more than 5', 'mehr als 5', 'mais de 5']] },
    { id: 'data', label: { en: 'Data', de: 'Daten', pt: 'Dados' },
      opts: [
        ['no personal data', 'keine personenbezogenen Daten', 'sem dados pessoais'],
        ['personal or customer data of one organisation', 'personenbezogene oder Kundendaten einer Organisation', 'dados pessoais ou de clientes de uma organização'],
        ['sensitive data, or data of several organisations', 'sensible Daten oder Daten mehrerer Organisationen', 'dados sensíveis ou de várias organizações'],
        ['sensitive data of several organisations', 'sensible Daten mehrerer Organisationen', 'dados sensíveis de várias organizações']] },
    { id: 'autonomy', label: { en: 'Autonomy', de: 'Eigenständigkeit', pt: 'Autonomia' },
      opts: [
        ['a person confirms each step', 'ein Mensch bestätigt jeden Schritt', 'uma pessoa confirma cada passo'],
        ['a person confirms risky steps', 'ein Mensch bestätigt riskante Schritte', 'uma pessoa confirma os passos de risco'],
        ['runs unattended', 'läuft ohne Aufsicht', 'funciona sem supervisão'],
        ['calls other agents on its own', 'ruft selbstständig andere Agenten auf', 'chama outros agentes por conta própria']] }
  ];
  var LINES = { en: 'Lines of code and configuration (approx.)', de: 'Zeilen Code und Konfiguration (ca.)', pt: 'Linhas de código e configuração (aprox.)' };
  var TXT = {
    en: { cls: 'Class', price: 'Guide price', launch: 'Launch offer (half)', from: 'from', note: 'A guide, not an offer. The final price is fixed after a short look at the component.', surcharge: 'incl. surcharge for volume', json: 'For the request:' },
    de: { cls: 'Klasse', price: 'Richtpreis', launch: 'Startangebot (halb)', from: 'ab', note: 'Ein Richtwert, kein Angebot. Verbindlich wird der Preis nach einem kurzen Blick auf die Komponente.', surcharge: 'inkl. Aufschlag für den Umfang', json: 'Für die Anfrage:' },
    pt: { cls: 'Classe', price: 'Preço de referência', launch: 'Oferta de lançamento (metade)', from: 'desde', note: 'Uma referência, não uma proposta. O preço final fica definido depois de uma breve análise do componente.', surcharge: 'incl. acréscimo pelo volume', json: 'Para o pedido:' }
  };
  var KEYS = { rights: ['read', 'write', 'money-deletion-access', 'chains'], data: ['none', 'personal-one-org', 'sensitive-or-several-orgs', 'sensitive-several-orgs'], autonomy: ['confirms-each-step', 'confirms-risky-steps', 'unattended', 'chains-agents'] };

  function lang() {
    var l = document.documentElement.getAttribute('lang');
    return l === 'de' || l === 'pt' ? l : 'en';
  }
  function idx(l) { return l === 'de' ? 1 : l === 'pt' ? 2 : 0; }
  function money(n, l) {
    var s = String(Math.round(n / 10) * 10).replace(/\B(?=(\d{3})+(?!\d))/g, l === 'en' ? ',' : l === 'de' ? '.' : ' ');
    return l === 'en' ? '€' + s : s + ' €';
  }

  function build() {
    var l = lang(), i = idx(l), saved = {};
    Array.prototype.forEach.call(form.elements, function (el) { if (el.name) saved[el.name] = el.value; });
    var html = FACTORS.map(function (f) {
      var opts = f.opts.map(function (o, n) {
        return '<option value="' + n + '"' + (String(saved[f.id] || 0) === String(n) ? ' selected' : '') + '>' + o[i] + '</option>';
      }).join('');
      return '<label class="sizer__row"><span>' + f.label[l] + '</span><select name="' + f.id + '">' + opts + '</select></label>';
    }).join('');
    html += '<label class="sizer__row"><span>' + LINES[l] + '</span><input type="number" name="lines" min="0" step="100" inputmode="numeric" value="' + (saved.lines || 500) + '"></label>';
    form.innerHTML = html;
    update();
  }

  function update() {
    var l = lang(), t = TXT[l];
    var cls = 0, v = {};
    FACTORS.forEach(function (f) {
      var n = parseInt(form.elements[f.id].value, 10) || 0;
      v[f.id] = n;
      if (n > cls) cls = n;
    });
    var lines = Math.max(0, parseInt(form.elements.lines.value, 10) || 0);
    var factor = lines > 20000 ? 1.5 : lines > 5000 ? 1.25 : 1;
    var price = PRICE[CLASSES[cls]] * factor;
    var req = {
      actions: [3, 8, 15, '>15'][v.actions], rights: KEYS.rights[v.rights],
      systems: [1, 3, 5, '>5'][v.systems], data: KEYS.data[v.data],
      autonomy: KEYS.autonomy[v.autonomy], lines: lines
    };
    out.innerHTML =
      '<p class="sizer__class"><span>' + t.cls + '</span> <strong>' + CLASSES[cls] + '</strong></p>' +
      '<p class="sizer__price">' + t.price + ': ' + t.from + ' ' + money(price, l) + (factor > 1 ? ' (' + t.surcharge + ')' : '') + '<br>' +
      t.launch + ': ' + t.from + ' ' + money(price / 2, l) + '</p>' +
      '<p class="offer__note">' + t.note + '</p>' +
      '<p class="offer__note">' + t.json + '</p>' +
      '<pre class="code" tabindex="0"><code>' + JSON.stringify({ size: req }, null, 2).replace(/</g, '&lt;') + '</code></pre>';
  }

  form.addEventListener('input', update);
  form.addEventListener('change', update);
  document.addEventListener('langchange', build);
  build();
})();
