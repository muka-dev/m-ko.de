(function () {
  'use strict';

  var root = document.documentElement;

  /* ---------- Language ---------- */

  var supported = ['de', 'en', 'pt'];
  var titles = {
    en: 'm-ko | AI that lands with your team | Markus Kosmal',
    de: 'm-ko | KI, die im Team ankommt | Markus Kosmal',
    pt: 'm-ko | IA que chega à equipa | Markus Kosmal'
  };
  var descriptions = {
    en: 'Markus Kosmal helps small and medium-sized businesses bring in AI so that it makes everyday work easier: listening first, building the solution, and staying until the team likes using it.',
    de: 'Markus Kosmal hilft kleinen und mittleren Unternehmen, KI so einzuführen, dass sie den Alltag leichter macht: erst zuhören, dann die Lösung bauen und dabeibleiben, bis das Team sie gern nutzt.',
    pt: 'Markus Kosmal ajuda pequenas e médias empresas a introduzir a IA de forma a facilitar o dia a dia: primeiro ouvir, depois construir a solução e ficar até a equipa gostar de a usar.'
  };
  var langButtons = document.querySelectorAll('[data-set-lang]');

  function applyLang(lang, save) {
    root.setAttribute('data-lang', lang);
    root.setAttribute('lang', lang);
    // Subpages carry their own title and description on <html>.
    document.title = root.getAttribute('data-title-' + lang) || titles[lang];
    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', root.getAttribute('data-desc-' + lang) || descriptions[lang]);
    langButtons.forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-set-lang') === lang));
    });
    if (save) {
      try { localStorage.setItem('lang', lang); } catch (e) {}
    }
    document.querySelectorAll('[data-alt-' + lang + ']').forEach(function (img) {
      img.alt = img.getAttribute('data-alt-' + lang);
    });
    layoutPath();
    document.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
  }

  langButtons.forEach(function (b) {
    b.addEventListener('click', function () {
      applyLang(b.getAttribute('data-set-lang'), true);
    });
  });

  /* ---------- Menu on small screens ---------- */

  var header = document.querySelector('.site-header');
  var toggle = header && header.querySelector('.menu-toggle');
  if (header && toggle) {
    var setOpen = function (open) {
      header.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', function () {
      setOpen(!header.classList.contains('is-open'));
    });
    header.querySelector('.nav').addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('click', function (e) {
      if (!header.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && header.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });
    window.matchMedia('(min-width: 941px)').addEventListener('change', function () { setOpen(false); });
  }

  /* ---------- Mail address (assembled here to keep it away from harvesters) ---------- */

  document.querySelectorAll('.js-mail').forEach(function (a) {
    var address = a.getAttribute('data-user') + '@' + a.getAttribute('data-host');
    a.href = 'mailto:' + address;
    a.textContent = address;
  });

  /* ---------- The path: one curve through all stops, drawn as you scroll ---------- */

  var path = document.querySelector('.path');
  var svg = path && path.querySelector('.path__line');
  var track = path && path.querySelector('.path__track');
  var drawn = path && path.querySelector('.path__drawn');
  var stops = path ? Array.prototype.slice.call(path.querySelectorAll('.stop')) : [];
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  var points = [];      // dot centres, relative to .path
  var cumulative = [];  // curve length up to each dot
  var total = 0;

  function segment(a, b) {
    var midY = (a.y + b.y) / 2;
    return 'C' + a.x + ',' + midY + ' ' + b.x + ',' + midY + ' ' + b.x + ',' + b.y;
  }

  function layoutPath() {
    if (!path || stops.length < 2) return;
    var box = path.getBoundingClientRect();
    points = stops.map(function (stop) {
      var r = stop.querySelector('.stop__dot').getBoundingClientRect();
      return {
        x: Math.round((r.left + r.width / 2 - box.left) * 10) / 10,
        y: Math.round((r.top + r.height / 2 - box.top) * 10) / 10
      };
    });

    var d = 'M' + points[0].x + ',' + points[0].y;
    cumulative = [0];
    var probe = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    for (var i = 1; i < points.length; i++) {
      var seg = segment(points[i - 1], points[i]);
      d += ' ' + seg;
      probe.setAttribute('d', 'M' + points[i - 1].x + ',' + points[i - 1].y + ' ' + seg);
      cumulative.push(cumulative[i - 1] + probe.getTotalLength());
    }
    total = cumulative[cumulative.length - 1];

    track.setAttribute('d', d);
    drawn.setAttribute('d', d);
    drawn.style.strokeDasharray = total + ' ' + total;
    updatePath();
  }

  function updatePath() {
    if (!total) return;
    var box = path.getBoundingClientRect();
    // The pen sits 62% down the viewport.
    var penY = reduceMotion.matches ? Infinity : window.innerHeight * 0.62 - box.top;
    // Near the end of the page the pen can no longer travel: finish the line.
    var atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    if (atBottom) penY = Infinity;

    var length = 0;
    if (penY >= points[points.length - 1].y) {
      length = total;
    } else if (penY > points[0].y) {
      for (var i = 1; i < points.length; i++) {
        if (penY <= points[i].y) {
          var t = (penY - points[i - 1].y) / (points[i].y - points[i - 1].y);
          length = cumulative[i - 1] + t * (cumulative[i] - cumulative[i - 1]);
          break;
        }
      }
    }

    drawn.style.strokeDashoffset = total - length;
    drawn.style.visibility = length > 0 ? 'visible' : 'hidden';
    stops.forEach(function (stop, i) {
      stop.classList.toggle('is-reached', penY >= points[i].y);
    });
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      updatePath();
    });
  }

  if (path) {
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', layoutPath);
    if (window.ResizeObserver) new ResizeObserver(layoutPath).observe(path);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutPath);
    if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', updatePath);
  }

  var initial = root.getAttribute('data-lang');
  applyLang(supported.indexOf(initial) === -1 ? 'en' : initial, false);
})();
