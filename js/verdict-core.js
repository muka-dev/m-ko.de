// "Darf die KI das?" The verdict logic: keywords in, one of the three levels out.
// Pure functions, no DOM. Runs in the browser and in Node (tests). A joke with rules, not advice.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AiVerdict = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LEVELS = ['alone', 'approval', 'never'];

  // Stems, matched at the start of a word. Order of precedence: never > approval > alone.
  var STEMS = {
    never: ['passwor', 'kennwort', 'zugangsdat', 'schlüssel', 'private key', 'secret', 'token', 'credential', 'senha', 'palavra-passe', 'chave privada',
      'entlass', 'feuer', 'fire ', 'despedir', 'unterschreib', 'sign the', 'sign a', 'assinar', 'diagnos', 'medizin', 'medical', 'médic',
      'rechtsberatung', 'legal advice', 'steuererkl', 'tax return', 'impostos'],
    approval: ['lösch', 'entfern', 'delete', 'remove', 'apag', 'elimin', 'überweis', 'zahl', 'bezahl', 'erstatt', 'pay', 'refund', 'transfer', 'pagar', 'reembols',
      'buch', 'bestell', 'order', 'book', 'encomend', 'reserv', 'veröffentlich', 'publish', 'post', 'publicar', 'absend', 'sende', 'schick', 'verschick', 'send', 'enviar',
      'antwort', 'beantwort', 'reply', 'respond', 'answer', 'kund', 'customer', 'cliente', 'deploy', 'überschreib', 'overwrit', 'preis', 'price', 'preço',
      'kündig', 'cancel', 'rechnung stell', 'invoice', 'fatur'],
    alone: ['les', 'lies', 'read', 'ler ', 'such', 'search', 'procur', 'zusammenfass', 'summar', 'resum', 'entwirf', 'entwurf', 'draft', 'rascunho',
      'sortier', 'sort', 'organiz', 'ordn', 'übersetz', 'translat', 'traduz', 'recherch', 'research', 'vorschlag', 'vorschlä', 'suggest', 'sugest',
      'erklär', 'explain', 'explic', 'prüf', 'check', 'review', 'rever', 'formatier', 'format', 'erinner', 'remind', 'lembr', 'kalender', 'calendar']
  };
  var BUMP = ['ohne rückfrage', 'ohne nachfrage', 'ohne fragen', 'ohne bestätigung', 'automatisch', 'without asking', 'without confirmation', 'automatically', 'sem perguntar', 'sem confirmação', 'automaticamente'];
  var ALL = ['alle', 'alles', 'komplett', 'all ', 'everything', 'every ', 'todos', 'todas', 'tudo'];

  var QUIPS = {
    alone: {
      en: ['Granted. This is exactly what AI was invented for: lots of text, few consequences.',
           'Allowed. If something goes wrong, it will at worst be down to the human\'s coffee level.',
           'Cleared. Reading, sorting, summarising: nobody needs to be pulled out of a meeting for that.',
           'Permitted. A human may still look over it, out of curiosity.'],
      de: ['Genehmigt. Genau dafür wurde KI erfunden: viel Text, wenig Folgen.',
           'Erlaubt. Geht etwas schief, liegt es höchstens am Kaffeepegel des Menschen.',
           'Freigegeben. Lesen, sortieren, zusammenfassen: dafür muss niemand aus dem Meeting geholt werden.',
           'Darf sie. Ein Mensch darf trotzdem gern mal draufschauen, aus Neugier.'],
      pt: ['Aprovado. Foi para isto que a IA foi inventada: muito texto, poucas consequências.',
           'Permitido. Se algo correr mal, será quando muito culpa do nível de café do humano.',
           'Liberado. Ler, ordenar, resumir: ninguém precisa de sair da reunião por isso.',
           'Pode. Um humano pode na mesma dar uma vista de olhos, por curiosidade.'] },
    approval: {
      en: ['Case prepared, signature missing. The AI holds the file, a human presses the red button.',
           'Almost. The AI prepares everything, a human says yes. That keeps the damage manageable.',
           'With a check-back. Because "that is not what I meant" can be a very expensive sentence.',
           'Draft yes, send no. Not without a thumbs-up from a human, anyway.'],
      de: ['Vorgang vorbereitet, Unterschrift fehlt. Die KI hält die Akte, ein Mensch drückt den roten Knopf.',
           'Fast. Die KI bereitet alles vor, ein Mensch sagt Ja. So bleibt der Schaden im Zweifel handlich.',
           'Mit Rückfrage. Weil „Das wollte ich eigentlich anders“ ein sehr teurer Satz sein kann.',
           'Entwurf ja, Absenden nein. Zumindest nicht ohne Daumen nach oben von einem Menschen.'],
      pt: ['Processo preparado, falta a assinatura. A IA guarda o dossiê, um humano carrega no botão vermelho.',
           'Quase. A IA prepara tudo, um humano diz sim. Assim o estrago fica gerível.',
           'Com confirmação. Porque «não era bem isto que eu queria» pode ser uma frase muito cara.',
           'Rascunho sim, enviar não. Pelo menos não sem um polegar para cima de um humano.'] },
    never: {
      en: ['Application rejected. Reason: some things you do yourself, preferably with coffee.',
           'Off limits. Even the friendliest AI gets no key here, and it is nothing personal.',
           'Rejected. This goes on the list "Never, not even when asked nicely".',
           'No. And asking whether it might work after all is the kind of question nobody likes to hear again in an audit.'],
      de: ['Antrag abgelehnt. Begründung: Manche Dinge macht man selbst, und zwar mit Kaffee.',
           'Tabu. Selbst die netteste KI bekommt hier keinen Schlüssel, und das ist nicht persönlich gemeint.',
           'Abgelehnt. Das gehört auf die Liste „Nie, auch nicht bei freundlicher Bitte“.',
           'Nein. Und die Frage, ob es nicht doch ginge, hört man im Audit später ungern ein zweites Mal.'],
      pt: ['Pedido rejeitado. Motivo: há coisas que se fazem pessoalmente, de preferência com café.',
           'Fora de questão. Nem a IA mais simpática recebe aqui uma chave, e não é nada pessoal.',
           'Rejeitado. Isto vai para a lista «Nunca, nem com um pedido simpático».',
           'Não. E perguntar se talvez desse na mesma é o tipo de pergunta que ninguém gosta de ouvir outra vez numa auditoria.'] }
  };
  var EXTRA = {
    unknown: { en: 'Unknown territory. When in doubt the AI asks once too often, which is level two.', de: 'Unbekanntes Terrain. Im Zweifel fragt die KI lieber einmal zu oft nach, das ist Stufe zwei.', pt: 'Território desconhecido. Na dúvida, a IA pergunta uma vez a mais, o que é o nível dois.' },
    bumped: { en: '"Without asking" is the part where people later say "oops". One level stricter.', de: '„Ohne Rückfrage“ ist der Teil, bei dem Menschen später „Ups“ sagen. Deshalb eine Stufe strenger.', pt: '«Sem perguntar» é a parte em que as pessoas dizem depois «ups». Por isso, um nível mais rigoroso.' },
    all: { en: 'And as soon as "all" is in the sentence, a slip becomes an event.', de: 'Und sobald „alle“ im Satz steht, wird aus einem Versehen ein Ereignis.', pt: 'E assim que «todos» aparece na frase, um deslize passa a ser um acontecimento.' }
  };

  function norm(s) { return ' ' + String(s || '').toLowerCase().replace(/\s+/g, ' ').trim() + ' '; }
  function has(text, stems) {
    for (var i = 0; i < stems.length; i++) {
      // stem at the start of a word: preceded by a space or punctuation, not by a letter
      var idx = text.indexOf(stems[i]);
      while (idx !== -1) {
        var prev = text.charAt(idx - 1);
        if (!/[a-zà-ÿ]/.test(prev)) return stems[i].trim();
        idx = text.indexOf(stems[i], idx + 1);
      }
    }
    return null;
  }
  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h; }

  function verdict(input, lang) {
    var l = lang === 'de' || lang === 'pt' ? lang : 'en';
    var text = norm(input);
    if (!text.trim()) return null;
    var level = null, matched = null, unknown = false;
    for (var k = 0; k < 3 && !level; k++) {
      var key = ['never', 'approval', 'alone'][k];
      var m = has(text, STEMS[key]);
      if (m) { level = key; matched = m; }
    }
    if (!level) { level = 'approval'; unknown = true; }
    var bumped = false;
    if (has(text, BUMP) && level !== 'never') { level = level === 'alone' ? 'approval' : 'never'; bumped = true; }
    var h = hash(text.trim());
    var pool = QUIPS[level][l];
    var parts = [pool[h % pool.length]];
    if (unknown) parts = [EXTRA.unknown[l]];
    if (bumped) parts.push(EXTRA.bumped[l]);
    if (has(text, ALL)) parts.push(EXTRA.all[l]);
    return { level: level, matched: matched, unknown: unknown, bumped: bumped, quip: parts.join(' '), ref: 'KI-' + String(1000 + (h % 9000)) };
  }

  return { LEVELS: LEVELS, verdict: verdict };
});
