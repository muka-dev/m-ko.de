// Emergency button on the home page, arrival animation on /emergency/, and the call button.
(function () {
  'use strict';

  var KEY = 'sos-arrive';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function overlay(x, y) {
    var f = document.createElement('div');
    f.className = 'sos-flash';
    f.setAttribute('aria-hidden', 'true');
    f.innerHTML = '<span>Aaaaaaaaaaiiiiiiii!</span>';
    f.style.setProperty('--x', x + 'px');
    f.style.setProperty('--y', y + 'px');
    document.body.appendChild(f);
    return f;
  }

  /* ---------- Home: the big phone ---------- */

  var phone = document.querySelector('.sos-phone');
  if (phone) {
    phone.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || reduce) return;
      e.preventDefault();
      var r = phone.getBoundingClientRect();
      phone.classList.add('is-pressed');
      overlay(r.left + r.width / 2, r.top + r.height / 2).classList.add('is-in');
      try { sessionStorage.setItem(KEY, '1'); } catch (err) {}
      setTimeout(function () { location.href = phone.href; }, 950);
    });
    // Coming back with the browser's back button: undo the animation.
    window.addEventListener('pageshow', function (e) {
      if (!e.persisted) return;
      phone.classList.remove('is-pressed');
      document.querySelectorAll('.sos-flash').forEach(function (f) { f.remove(); });
    });
  }

  /* ---------- Emergency page: arrival ---------- */

  if (document.querySelector('.emergency')) {
    var arrived = false;
    try { arrived = sessionStorage.getItem(KEY) === '1'; sessionStorage.removeItem(KEY); } catch (err) {}
    if (arrived && !reduce) {
      var f = overlay(window.innerWidth / 2, window.innerHeight * 0.3);
      f.classList.add('is-out');
      f.addEventListener('animationend', function () { f.remove(); });
    }
  }

  /* ---------- Call button: the number is fetched only on a click ---------- */

  var buttons = document.querySelectorAll('[data-call]');
  if (!buttons.length) return;

  fetch('/agents/call.php?status', { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.json(); })
    .then(function (j) { if (j && j.enabled) buttons.forEach(function (b) { b.hidden = false; }); })
    .catch(function () {});

  function reveal(button) {
    return fetch('/agents/call.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"reveal":true}' })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        var tel = x.ok && x.j && typeof x.j.tel === 'string' ? x.j.tel : '';
        if (!/^\+?[0-9 ()\/-]{6,24}$/.test(tel)) throw new Error('no number');
        buttons.forEach(function (b) {
          b.setAttribute('href', 'tel:' + tel.replace(/[^\d+]/g, ''));
          b.removeAttribute('role');
          b.removeAttribute('data-call');
          b.textContent = tel;
        });
        // On a phone the call starts at once.
        if (window.matchMedia('(pointer: coarse)').matches) location.href = button.getAttribute('href');
      });
  }

  buttons.forEach(function (b) {
    b.addEventListener('click', function (e) {
      if (!b.hasAttribute('data-call')) return; // already a tel: link
      e.preventDefault();
      if (b.dataset.busy) return;
      b.dataset.busy = '1';
      reveal(b).catch(function () { buttons.forEach(function (x) { x.hidden = true; }); })
        .then(function () { delete b.dataset.busy; });
    });
  });
})();
