/* Time-and-cost example calculation. Local only, no network requests. */
(function () {
  'use strict';
  var form = document.getElementById('calc-form');
  if (!form) return;

  var root = document.documentElement;
  var $ = function (id) { return document.getElementById(id); };
  var people = $('c-people'), hours = $('c-hours'), share = $('c-share'), rate = $('c-rate');

  function locale() {
    var l = root.getAttribute('data-lang');
    return l === 'pt' ? 'pt-PT' : (l === 'de' ? 'de-DE' : 'en-GB');
  }

  function update() {
    var loc = locale();
    var p = Number(people.value), h = Number(hours.value), s = Number(share.value) / 100, r = Number(rate.value);
    var hoursYear = p * h * s * 52;
    var money = new Intl.NumberFormat(loc, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

    $('c-people-out').textContent = p;
    $('c-hours-out').textContent = h + ' h';
    $('c-share-out').textContent = Math.round(s * 100) + ' %';
    $('c-rate-out').textContent = money.format(r);

    $('r-hours').textContent = Math.round(hoursYear / 12).toLocaleString(loc);
    $('r-eur').textContent = money.format(Math.round(hoursYear * r / 100) * 100);
    $('r-fte').textContent = '≈ ' + (hoursYear / 1650).toLocaleString(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    $('r-bar').style.width = Math.round(s * 100) + '%';
  }

  form.addEventListener('input', update);
  document.addEventListener('langchange', update);
  update();
})();
