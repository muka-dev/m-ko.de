// "Darf die KI das?": form, examples and result. Nothing leaves the browser.
(function () {
  'use strict';
  var V = window.AiVerdict;
  var form = document.getElementById('verdict-form');
  if (!V || !form) return;
  var input = document.getElementById('verdict-input');
  var out = document.getElementById('verdict-result');
  var last = '';

  var TXT = {
    en: { alone: 'May do it alone.', approval: 'Only with the OK of a human.', never: 'Stays off limits.', ref: 'File number', hint: 'Just for fun, the detection works with keywords. For real cases: the', link: 'AI check', empty: 'Type a task first.' },
    de: { alone: 'Darf sie allein.', approval: 'Nur mit dem OK eines Menschen.', never: 'Bleibt tabu.', ref: 'Aktenzeichen', hint: 'Nur zum Spaß, die Erkennung arbeitet mit Stichworten. Für echte Fälle: der', link: 'KI-Check', empty: 'Bitte zuerst eine Aufgabe eintippen.' },
    pt: { alone: 'Pode fazer sozinha.', approval: 'Só com o OK de um humano.', never: 'Fica fora de questão.', ref: 'Processo n.º', hint: 'Só por diversão, a deteção usa palavras-chave. Para casos reais: a', link: 'verificação de IA', empty: 'Escreva primeiro uma tarefa.' }
  };
  var ICON = { alone: '✓', approval: '✋', never: '⛔' };
  function lang() { var l = document.documentElement.getAttribute('lang'); return l === 'de' || l === 'pt' ? l : 'en'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function render() {
    var t = TXT[lang()];
    if (!last.trim()) { out.innerHTML = ''; return; }
    var r = V.verdict(last, lang());
    out.innerHTML =
      '<div class="verdict verdict--' + r.level + '">' +
      '<p class="verdict__ref">' + t.ref + ' ' + r.ref + '</p>' +
      '<p class="verdict__title"><span aria-hidden="true">' + ICON[r.level] + '</span> ' + t[r.level] + '</p>' +
      '<p class="verdict__quip">' + esc(r.quip) + '</p>' +
      '<p class="verdict__hint">' + t.hint + ' <a href="../security/">' + t.link + '</a>.</p></div>';
  }

  function placeholder() { input.placeholder = input.getAttribute('data-ph-' + lang()) || input.placeholder; }
  placeholder();
  document.addEventListener('langchange', placeholder);

  function submit(text) { last = text; input.value = text; render(); }

  form.addEventListener('submit', function (e) { e.preventDefault(); submit(input.value); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-verdict-example]'), function (b) {
    b.addEventListener('click', function () { submit(b.getAttribute('data-verdict-' + lang()) || b.textContent); });
  });
  document.addEventListener('langchange', render);
})();
