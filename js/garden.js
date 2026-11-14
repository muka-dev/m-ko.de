/* Permaculture field generator.
   Rule-based and fully local: picks one plant per role for the given site
   and draws a top-down plan. No network requests. */
(function () {
  'use strict';

  var tool = document.getElementById('garden-tool');
  if (!tool) return;

  var root = document.documentElement;
  var form = document.getElementById('garden-form');
  var sizeInput = document.getElementById('g-size');
  var sizeOut = document.getElementById('g-size-out');
  var mapEl = document.getElementById('g-map');
  var statsEl = document.getElementById('g-stats');
  var teamEl = document.getElementById('g-team');
  var planEl = document.getElementById('g-plan');
  var shuffleBtn = document.getElementById('g-shuffle');

  /* ---------- Data ---------- */

  // cl: climates (T temperate, M mediterranean, S subtropical, R tropical)
  // sun: f = full sun, p = partial shade. w: water need 0 low, 1 medium, 2 high.
  // big: woody nitrogen fixer for plots with trees; small: for beds only.
  var PLANTS = [
    { role: 'tree', cl: 'T', sun: 'f', w: 1, n: { de: 'Apfel', en: 'Apple', pt: 'Macieira' } },
    { role: 'tree', cl: 'T', sun: 'f', w: 1, n: { de: 'Birne', en: 'Pear', pt: 'Pereira' } },
    { role: 'tree', cl: 'TM', sun: 'f', w: 1, n: { de: 'Zwetschge', en: 'Plum', pt: 'Ameixeira' } },
    { role: 'tree', cl: 'T', sun: 'fp', w: 1, n: { de: 'Haselnuss', en: 'Hazel', pt: 'Aveleira' } },
    { role: 'tree', cl: 'T', sun: 'fp', w: 1, n: { de: 'Sauerkirsche', en: 'Sour cherry', pt: 'Ginjeira' } },
    { role: 'tree', cl: 'MS', sun: 'fp', w: 0, n: { de: 'Feige', en: 'Fig', pt: 'Figueira' } },
    { role: 'tree', cl: 'MS', sun: 'f', w: 0, n: { de: 'Olive', en: 'Olive', pt: 'Oliveira' } },
    { role: 'tree', cl: 'M', sun: 'f', w: 0, n: { de: 'Mandel', en: 'Almond', pt: 'Amendoeira' } },
    { role: 'tree', cl: 'MS', sun: 'f', w: 1, n: { de: 'Zitrone', en: 'Lemon', pt: 'Limoeiro' } },
    { role: 'tree', cl: 'SR', sun: 'f', w: 1, n: { de: 'Avocado', en: 'Avocado', pt: 'Abacateiro' } },
    { role: 'tree', cl: 'SR', sun: 'f', w: 1, n: { de: 'Mango', en: 'Mango', pt: 'Mangueira' } },
    { role: 'tree', cl: 'SR', sun: 'fp', w: 2, n: { de: 'Banane', en: 'Banana', pt: 'Bananeira' } },
    { role: 'tree', cl: 'SR', sun: 'f', w: 1, n: { de: 'Papaya', en: 'Papaya', pt: 'Papaieira' } },

    { role: 'nfix', big: true, cl: 'T', sun: 'f', w: 0, n: { de: 'Erbsenstrauch', en: 'Siberian pea shrub', pt: 'Caragana' } },
    { role: 'nfix', big: true, cl: 'TMS', sun: 'fp', w: 0, n: { de: 'Ölweide', en: 'Elaeagnus', pt: 'Eleagno' } },
    { role: 'nfix', big: true, cl: 'MS', sun: 'f', w: 0, n: { de: 'Tagasaste', en: 'Tagasaste', pt: 'Tagasaste' } },
    { role: 'nfix', big: true, cl: 'SR', sun: 'f', w: 0, n: { de: 'Straucherbse', en: 'Pigeon pea', pt: 'Feijão-guandu' } },
    { role: 'nfix', big: true, cl: 'R', sun: 'fp', w: 1, n: { de: 'Gliricidia', en: 'Gliricidia', pt: 'Gliricídia' } },
    { role: 'nfix', big: false, cl: 'TMSR', sun: 'f', w: 1, n: { de: 'Buschbohne', en: 'Bush bean', pt: 'Feijão-anão' } },
    { role: 'nfix', big: false, cl: 'TM', sun: 'fp', w: 1, n: { de: 'Weißklee', en: 'White clover', pt: 'Trevo-branco' } },
    { role: 'nfix', big: false, cl: 'T', sun: 'f', w: 1, n: { de: 'Lupine', en: 'Lupin', pt: 'Tremoceiro' } },
    { role: 'nfix', big: false, cl: 'TM', sun: 'f', w: 0, n: { de: 'Luzerne', en: 'Alfalfa', pt: 'Luzerna' } },
    { role: 'nfix', big: false, cl: 'SR', sun: 'fp', w: 1, n: { de: 'Futtererdnuss', en: 'Pinto peanut', pt: 'Amendoim-forrageiro' } },

    { role: 'shrub', cl: 'T', sun: 'fp', w: 1, n: { de: 'Johannisbeere', en: 'Currant', pt: 'Groselheira' } },
    { role: 'shrub', cl: 'T', sun: 'fp', w: 1, n: { de: 'Himbeere', en: 'Raspberry', pt: 'Framboeseira' } },
    { role: 'shrub', cl: 'T', sun: 'fp', w: 1, n: { de: 'Stachelbeere', en: 'Gooseberry', pt: 'Groselheira-espinhosa' } },
    { role: 'shrub', cl: 'TM', sun: 'fp', w: 1, n: { de: 'Brombeere', en: 'Blackberry', pt: 'Amoreira-silvestre' } },
    { role: 'shrub', cl: 'MS', sun: 'f', w: 0, n: { de: 'Granatapfel', en: 'Pomegranate', pt: 'Romãzeira' } },
    { role: 'shrub', cl: 'MS', sun: 'f', w: 1, n: { de: 'Physalis', en: 'Cape gooseberry', pt: 'Fisális' } },
    { role: 'shrub', cl: 'SR', sun: 'f', w: 1, n: { de: 'Guave', en: 'Guava', pt: 'Goiabeira' } },
    { role: 'shrub', cl: 'SR', sun: 'p', w: 1, n: { de: 'Kaffee', en: 'Coffee', pt: 'Cafeeiro' } },
    { role: 'shrub', cl: 'R', sun: 'f', w: 0, n: { de: 'Maniok', en: 'Cassava', pt: 'Mandioca' } },

    { role: 'climb', cl: 'TM', sun: 'f', w: 1, n: { de: 'Stangenbohne', en: 'Pole bean', pt: 'Feijão-de-trepar' } },
    { role: 'climb', cl: 'TM', sun: 'f', w: 0, n: { de: 'Weinrebe', en: 'Grapevine', pt: 'Videira' } },
    { role: 'climb', cl: 'TM', sun: 'fp', w: 2, n: { de: 'Kiwi', en: 'Kiwi', pt: 'Kiwi' } },
    { role: 'climb', cl: 'T', sun: 'fp', w: 1, n: { de: 'Hopfen', en: 'Hops', pt: 'Lúpulo' } },
    { role: 'climb', cl: 'SR', sun: 'f', w: 1, n: { de: 'Passionsfrucht', en: 'Passion fruit', pt: 'Maracujazeiro' } },
    { role: 'climb', cl: 'SR', sun: 'fp', w: 2, n: { de: 'Chayote', en: 'Chayote', pt: 'Chuchu' } },

    { role: 'ground', cl: 'T', sun: 'fp', w: 1, n: { de: 'Walderdbeere', en: 'Wild strawberry', pt: 'Morangueiro-silvestre' } },
    { role: 'ground', cl: 'TM', sun: 'f', w: 1, n: { de: 'Erdbeere', en: 'Strawberry', pt: 'Morangueiro' } },
    { role: 'ground', cl: 'TMS', sun: 'f', w: 2, n: { de: 'Kürbis', en: 'Pumpkin', pt: 'Abóbora' } },
    { role: 'ground', cl: 'TMS', sun: 'fp', w: 1, n: { de: 'Kapuzinerkresse', en: 'Nasturtium', pt: 'Capuchinha' } },
    { role: 'ground', cl: 'TM', sun: 'f', w: 0, n: { de: 'Thymian', en: 'Thyme', pt: 'Tomilho' } },
    { role: 'ground', cl: 'MSR', sun: 'fp', w: 1, n: { de: 'Süßkartoffel', en: 'Sweet potato', pt: 'Batata-doce' } },

    { role: 'root', cl: 'TM', sun: 'f', w: 0, n: { de: 'Knoblauch', en: 'Garlic', pt: 'Alho' } },
    { role: 'root', cl: 'TM', sun: 'fp', w: 1, n: { de: 'Möhre', en: 'Carrot', pt: 'Cenoura' } },
    { role: 'root', cl: 'T', sun: 'fp', w: 0, n: { de: 'Topinambur', en: 'Jerusalem artichoke', pt: 'Tupinambo' } },
    { role: 'root', cl: 'MS', sun: 'fp', w: 1, n: { de: 'Yacon', en: 'Yacon', pt: 'Yacon' } },
    { role: 'root', cl: 'SR', sun: 'p', w: 1, n: { de: 'Ingwer', en: 'Ginger', pt: 'Gengibre' } },
    { role: 'root', cl: 'R', sun: 'fp', w: 2, n: { de: 'Taro', en: 'Taro', pt: 'Inhame' } },

    { role: 'insect', cl: 'TM', sun: 'fp', w: 1, n: { de: 'Ringelblume', en: 'Calendula', pt: 'Calêndula' } },
    { role: 'insect', cl: 'TM', sun: 'fp', w: 1, n: { de: 'Borretsch', en: 'Borage', pt: 'Borragem' } },
    { role: 'insect', cl: 'T', sun: 'f', w: 1, n: { de: 'Phacelia', en: 'Phacelia', pt: 'Facélia' } },
    { role: 'insect', cl: 'TM', sun: 'f', w: 0, n: { de: 'Schafgarbe', en: 'Yarrow', pt: 'Milefólio' } },
    { role: 'insect', cl: 'TMS', sun: 'f', w: 0, n: { de: 'Lavendel', en: 'Lavender', pt: 'Alfazema' } },
    { role: 'insect', cl: 'TMSR', sun: 'f', w: 1, n: { de: 'Tagetes', en: 'Marigold', pt: 'Cravo-túnico' } },
    { role: 'insect', cl: 'MSR', sun: 'fp', w: 1, n: { de: 'Basilikum', en: 'Basil', pt: 'Manjericão' } },

    { role: 'mulch', cl: 'TM', sun: 'fp', w: 1, n: { de: 'Beinwell', en: 'Comfrey', pt: 'Consolda' } },
    { role: 'mulch', cl: 'MS', sun: 'f', w: 0, n: { de: 'Artischocke', en: 'Artichoke', pt: 'Alcachofra' } },
    { role: 'mulch', cl: 'SR', sun: 'f', w: 0, n: { de: 'Vetiver', en: 'Vetiver', pt: 'Vetiver' } },
    { role: 'mulch', cl: 'SR', sun: 'fp', w: 1, n: { de: 'Zitronengras', en: 'Lemongrass', pt: 'Erva-príncipe' } },
    { role: 'mulch', cl: 'SR', sun: 'f', w: 1, n: { de: 'Tithonie', en: 'Mexican sunflower', pt: 'Girassol-mexicano' } }
  ];

  var COLORS = {
    tree: '#2F8F3F', nfix: '#1F8A8A', shrub: '#A8456B', climb: '#12332E',
    ground: '#6CCF4C', root: '#8A6A3B', insect: '#F2C230', mulch: '#456560',
    water: '#4CA7CF', bed: '#DDD2BA', field: '#E4EBE6', compost: '#5E4A2C'
  };

  var T = {
    de: {
      roles: { tree: 'Kronendach', nfix: 'Stickstoffsammler', shrub: 'Strauchschicht', climb: 'Kletterer', ground: 'Bodendecker', root: 'Wurzelschicht', insect: 'Bestäubermagnet', mulch: 'Mulchlieferant' },
      why: {
        tree: 'gibt Struktur, Schatten und die Haupternte',
        nfix: 'holt Stickstoff aus der Luft und düngt die Nachbarn',
        shrub: 'füllt den Raum zwischen Baum und Beet mit Ernte',
        climb: 'nutzt die Höhe am Rankgitter',
        ground: 'beschattet den Boden und hält die Feuchtigkeit',
        root: 'lockert den Boden und nutzt die Tiefe',
        insect: 'lockt Bestäuber und Nützlinge an',
        mulch: 'liefert Schnittgut zum Mulchen'
      },
      stats: function (c) {
        var parts = [c.area + ' m², etwa ' + c.w + ' × ' + c.h + ' m. Norden ist oben.'];
        var counts = [];
        if (c.trees) counts.push(c.trees + (c.trees === 1 ? ' Baum' : ' Bäume'));
        if (c.shrubs) counts.push(c.shrubs + ' Sträucher');
        counts.push(c.beds + (c.beds === 1 ? ' Beet' : ' Beete'));
        counts.push(c.pond ? 'ein Teich' : 'eine Regentonne');
        counts.push('ein Kompost');
        parts.push(counts.join(', ') + '.');
        return parts.join(' ');
      },
      plan: function (c) {
        var s = [];
        if (c.pond) s.push('Wasser zuerst: Lege den Teich an der tiefsten Stelle an. Er speichert Regen und holt Nützlinge ins Team.');
        else if (c.water === 0) s.push('Wasser zuerst: Stelle eine Regentonne auf, mulche dick und gieße gezielt an der Wurzel.');
        else s.push('Wasser zuerst: Stelle eine Regentonne auf und mulche alle Beete, damit der Boden feucht bleibt.');
        if (c.tree && c.climate === 'R') s.push('Pflanze ' + c.tree + ' als lichtes Dach, in den Tropen ist etwas Schatten willkommen. ' + c.nfix + ' kommt dazwischen.');
        else if (c.tree) s.push('Pflanze ' + c.tree + ' an die Nordseite, damit die Beete Sonne behalten. ' + c.nfix + ' kommt dazwischen.');
        else s.push('Stelle das Rankgitter an die Nordseite und lass ' + c.climb + ' daran hochwachsen. ' + c.nfix + ' kommt mit ins Beet.');
        if (c.tree) s.push('Setze ' + c.mulch + ' rund um die Stämme und die Reihe aus ' + c.shrub + ' davor. Am Rankgitter wächst ' + c.climb + '.');
        else s.push('Setze ' + c.mulch + ' an den Rand. Der Schnitt bleibt als Mulch auf dem Beet liegen.');
        s.push('Bepflanze die Beete gemischt mit ' + c.ground + ', ' + c.root + ' und ' + c.insect + ', statt nach Sorten getrennt.');
        s.push('Beobachte eine Saison lang und passe an. Wer sich wohlfühlt, bleibt im Team.');
        return s;
      }
    },
    en: {
      roles: { tree: 'Canopy', nfix: 'Nitrogen fixer', shrub: 'Shrub layer', climb: 'Climber', ground: 'Ground cover', root: 'Root layer', insect: 'Pollinator magnet', mulch: 'Mulch maker' },
      why: {
        tree: 'gives structure, shade and the main harvest',
        nfix: 'pulls nitrogen from the air and feeds its neighbours',
        shrub: 'fills the space between tree and bed with harvest',
        climb: 'uses the height on the trellis',
        ground: 'shades the soil and keeps moisture in',
        root: 'loosens the soil and uses the depth',
        insect: 'attracts pollinators and beneficial insects',
        mulch: 'grows material to cut and use as mulch'
      },
      stats: function (c) {
        var counts = [];
        if (c.trees) counts.push(c.trees + (c.trees === 1 ? ' tree' : ' trees'));
        if (c.shrubs) counts.push(c.shrubs + ' shrubs');
        counts.push(c.beds + (c.beds === 1 ? ' bed' : ' beds'));
        counts.push(c.pond ? 'a pond' : 'a rain barrel');
        counts.push('a compost heap');
        return c.area + ' m², roughly ' + c.w + ' × ' + c.h + ' m. North is up. ' + counts.join(', ') + '.';
      },
      plan: function (c) {
        var s = [];
        if (c.pond) s.push('Water first: dig the pond at the lowest spot. It stores rain and brings helpful wildlife into the team.');
        else if (c.water === 0) s.push('Water first: set up a rain barrel, mulch thickly and water right at the roots.');
        else s.push('Water first: set up a rain barrel and mulch every bed so the soil stays moist.');
        if (c.tree && c.climate === 'R') s.push('Plant ' + c.tree + ' as a light canopy, a bit of shade is welcome in the tropics. ' + c.nfix + ' goes in between.');
        else if (c.tree) s.push('Plant ' + c.tree + ' on the north side so the beds keep their sun. ' + c.nfix + ' goes in between.');
        else s.push('Put the trellis on the north side and let ' + c.climb + ' grow up it. ' + c.nfix + ' joins the bed.');
        if (c.tree) s.push('Set ' + c.mulch + ' around the trunks and the row of ' + c.shrub + ' in front. ' + c.climb + ' grows on the trellis.');
        else s.push('Set ' + c.mulch + ' along the edge. The cuttings stay on the bed as mulch.');
        s.push('Plant the beds as a mix of ' + c.ground + ', ' + c.root + ' and ' + c.insect + ' instead of one crop per bed.');
        s.push('Watch for one season and adjust. Whoever thrives stays on the team.');
        return s;
      }
    },
    pt: {
      roles: { tree: 'Copa', nfix: 'Fixador de azoto', shrub: 'Arbustos', climb: 'Trepadeira', ground: 'Cobertura do solo', root: 'Raízes', insect: 'Íman de polinizadores', mulch: 'Produtor de cobertura' },
      why: {
        tree: 'dá estrutura, sombra e a colheita principal',
        nfix: 'tira azoto do ar e alimenta os vizinhos',
        shrub: 'enche de colheita o espaço entre a árvore e o canteiro',
        climb: 'aproveita a altura na treliça',
        ground: 'dá sombra ao solo e conserva a humidade',
        root: 'solta o solo e aproveita a profundidade',
        insect: 'atrai polinizadores e insetos auxiliares',
        mulch: 'produz material para cortar e usar como cobertura'
      },
      stats: function (c) {
        var counts = [];
        if (c.trees) counts.push(c.trees + (c.trees === 1 ? ' árvore' : ' árvores'));
        if (c.shrubs) counts.push(c.shrubs + ' arbustos');
        counts.push(c.beds + (c.beds === 1 ? ' canteiro' : ' canteiros'));
        counts.push(c.pond ? 'um charco' : 'um depósito de água da chuva');
        counts.push('um compostor');
        return c.area + ' m², cerca de ' + c.w + ' × ' + c.h + ' m. O norte fica em cima. ' + counts.join(', ') + '.';
      },
      plan: function (c) {
        var s = [];
        if (c.pond) s.push('Primeiro a água: faça o charco no ponto mais baixo. Guarda a chuva e traz fauna auxiliar para a equipa.');
        else if (c.water === 0) s.push('Primeiro a água: instale um depósito para a chuva, cubra bem o solo e regue junto à raiz.');
        else s.push('Primeiro a água: instale um depósito para a chuva e cubra todos os canteiros, para o solo se manter húmido.');
        if (c.tree && c.climate === 'R') s.push('Plante ' + c.tree + ' como copa leve, nos trópicos alguma sombra é bem-vinda. ' + c.nfix + ' fica no meio.');
        else if (c.tree) s.push('Plante ' + c.tree + ' do lado norte, para os canteiros não perderem o sol. ' + c.nfix + ' fica no meio.');
        else s.push('Ponha a treliça do lado norte e deixe ' + c.climb + ' subir por ela. ' + c.nfix + ' entra no canteiro.');
        if (c.tree) s.push('Ponha ' + c.mulch + ' à volta dos troncos e a fila de ' + c.shrub + ' à frente. Na treliça cresce ' + c.climb + '.');
        else s.push('Ponha ' + c.mulch + ' na borda. O que cortar fica no canteiro como cobertura.');
        s.push('Plante os canteiros em mistura com ' + c.ground + ', ' + c.root + ' e ' + c.insect + ', em vez de uma cultura por canteiro.');
        s.push('Observe durante uma estação e ajuste. Quem se dá bem fica na equipa.');
        return s;
      }
    }
  };

  var ROLE_ORDER = ['tree', 'nfix', 'shrub', 'climb', 'ground', 'root', 'insect', 'mulch'];

  /* ---------- Helpers ---------- */

  function rng(seed) {
    // mulberry32
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function lang() {
    var l = root.getAttribute('data-lang');
    return T[l] ? l : 'en';
  }
  function fmt(n) {
    return n.toLocaleString(lang(), { maximumFractionDigits: 1 });
  }
  function sliderToArea(v) {
    var a = 5 * Math.pow(400, v / 100); // 5 … 2000 m²
    if (a < 50) return Math.round(a);
    if (a < 200) return Math.round(a / 5) * 5;
    if (a < 1000) return Math.round(a / 10) * 10;
    return Math.round(a / 50) * 50;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------- Picking the team ---------- */

  function pickTeam(site, rand) {
    var hasTrees = site.area >= 25;
    var team = {};
    ROLE_ORDER.forEach(function (role) {
      if (!hasTrees && (role === 'tree' || role === 'shrub')) return;
      var best = null, bestScore = -Infinity;
      PLANTS.forEach(function (p) {
        if (p.role !== role || p.cl.indexOf(site.climate) === -1) return;
        if (role === 'nfix' && p.big !== hasTrees) return;
        var s = 0;
        if (p.sun.indexOf(site.sun) !== -1) s += 2;
        else s -= site.sun === 'p' ? 3 : 2;
        if (p.w <= site.water) s += 2 - (site.water - p.w) * 0.5;
        else s -= 2 * (p.w - site.water);
        s += rand() * 1.4; // variety between equally good candidates
        if (s > bestScore) { bestScore = s; best = p; }
      });
      if (best) team[role] = best;
    });
    return team;
  }

  /* ---------- Layout (all sizes in metres, scaled when drawn) ---------- */

  function layout(site, rand) {
    var W = Math.sqrt(site.area * 1.5);
    var H = site.area / W;
    var shapes = [];
    var hasTrees = site.area >= 25;
    var info = { W: W, H: H, trees: 0, shrubs: 0, beds: 0, pond: false };
    var y = 0;

    if (hasTrees) {
      var tr = clamp(H * 0.16, 0.9, 2.4);
      var perRow = Math.max(1, Math.floor(W / (2 * tr * 1.5)));
      var rows = site.area > 400 ? 2 : 1;
      var cell = W / perRow;
      for (var r = 0; r < rows; r++) {
        var cy = tr * 1.1 + r * 2 * tr * 1.08;
        var count = r % 2 ? perRow - 1 : perRow;
        for (var i = 0; i < count; i++) {
          var cx = (i + 0.5) * cell + (r % 2 ? cell / 2 : 0) + (rand() - 0.5) * cell * 0.08;
          shapes.push({ t: 'circle', role: 'tree', x: cx, y: cy, r: tr });
          info.trees++;
          // mulch plants in a half ring on the sunny side of each trunk
          if (r === rows - 1 || rows === 1) {
            for (var k = 0; k < 5; k++) {
              var a = (25 + k * 32.5) * Math.PI / 180;
              shapes.push({ t: 'dot', role: 'mulch', x: cx + Math.cos(a) * tr * 1.18, y: cy + Math.sin(a) * tr * 1.18, r: Math.max(tr * 0.13, 0.12) });
            }
          }
        }
        if (r === 0) {
          // nitrogen fixers between the canopy trees
          if (perRow === 1) shapes.push({ t: 'circle', role: 'nfix', x: Math.min(W - tr * 0.6, cell / 2 + tr * 1.45), y: tr * 0.75, r: tr * 0.42 });
          for (var j = 1; j < perRow; j++) shapes.push({ t: 'circle', role: 'nfix', x: j * cell, y: tr * 0.9, r: tr * 0.42 });
        }
      }
      y = tr * 1.1 + (rows - 1) * 2 * tr * 1.08 + tr * 1.45;

      var sr = clamp(tr * 0.4, 0.4, 0.9);
      var nShrubs = Math.max(2, Math.floor((W - sr) / (2 * sr * 1.6)));
      var gap = W / nShrubs;
      y += sr;
      for (var s = 0; s < nShrubs; s++) {
        shapes.push({ t: 'circle', role: 'shrub', x: (s + 0.5) * gap, y: y, r: sr });
        info.shrubs++;
      }
      y += sr * 1.5;
    } else {
      y = Math.min(0.3, H * 0.08);
    }

    // trellis for the climber
    var tx0 = W * 0.06, tx1 = W * 0.94;
    shapes.push({ t: 'trellis', role: 'climb', x0: tx0, x1: tx1, y: y });
    y += Math.max(0.35, H * 0.035);

    // service strip on the east side: water on top, compost below
    var margin = Math.min(0.3, H * 0.04);
    var strip = clamp(W * 0.15, 0.8, 7);
    var availH = H - y - margin;
    var bedsX0 = margin, bedsX1 = W - strip - margin;
    info.pond = site.area >= 150 && site.water >= 1;

    var sx = W - strip / 2 - margin / 2;
    if (info.pond) {
      shapes.push({ t: 'pond', x: sx, y: y + availH * 0.3, rx: strip * 0.42, ry: availH * 0.27 });
    } else {
      shapes.push({ t: 'barrel', x: sx, y: y + availH * 0.2, r: clamp(strip * 0.24, 0.22, 0.6) });
    }
    var cs = clamp(strip * 0.5, 0.45, 1.6);
    shapes.push({ t: 'compost', x: sx - cs / 2, y: y + availH - cs, s: cs });

    // beds, running east to west
    var nBeds = clamp(Math.round(availH / 1.1), 1, 6);
    var pitch = availH / nBeds;
    var path = Math.min(0.5, pitch * 0.28);
    var bedH = pitch - path;
    var crops = ['ground', 'root', 'insect'];
    if (!hasTrees) crops = ['ground', 'nfix', 'root', 'insect'];
    for (var b = 0; b < nBeds; b++) {
      var by = y + b * pitch + path / 2;
      shapes.push({ t: 'bed', x: bedsX0, y: by, w: bedsX1 - bedsX0, h: bedH });
      info.beds++;
      var step = Math.max(bedH * 0.95, (bedsX1 - bedsX0) / 26);
      var n = Math.max(2, Math.floor((bedsX1 - bedsX0 - bedH * 0.4) / step));
      var used = (bedsX1 - bedsX0) / n;
      for (var d = 0; d < n; d++) {
        shapes.push({ t: 'dot', role: crops[(d + b) % crops.length], x: bedsX0 + (d + 0.5) * used, y: by + bedH / 2, r: Math.min(bedH * 0.3, used * 0.34) });
      }
      if (!hasTrees && b === nBeds - 1) {
        // no trees to ring: mulch plants sit at the bed corners
        shapes.push({ t: 'dot', role: 'mulch', x: bedsX0 + bedH * 0.12, y: by + bedH * 0.85, r: bedH * 0.16 });
        shapes.push({ t: 'dot', role: 'mulch', x: bedsX1 - bedH * 0.12, y: by + bedH * 0.85, r: bedH * 0.16 });
      }
    }
    return { shapes: shapes, info: info };
  }

  /* ---------- Drawing ---------- */

  function draw(plan) {
    var W = plan.info.W, H = plan.info.H;
    var k = 600 / W; // px per metre
    var PH = H * k;  // always 400 for the fixed 3:2 field
    var i = 0;
    function anim() { return ' class="pop" style="animation-delay:' + Math.min(i++ * 9, 900) + 'ms"'; }
    var out = ['<svg viewBox="-6 -30 612 ' + (PH + 36) + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">'];
    out.push('<text x="0" y="-10" font-size="15" font-weight="700" fill="#12332E">N</text>');
    out.push('<path d="M22 -10 L22 -24 M17 -19 L22 -25 L27 -19" fill="none" stroke="#12332E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>');
    out.push('<rect x="0" y="0" width="600" height="' + PH + '" rx="10" fill="' + COLORS.field + '" stroke="#12332E" stroke-width="2"/>');

    // beds below, plants above
    var order = { bed: 0, pond: 1, barrel: 1, compost: 1, trellis: 2, dot: 3, circle: 4 };
    var sorted = plan.shapes.slice().sort(function (a, b) {
      var d = order[a.t] - order[b.t];
      if (d) return d;
      if (a.t === 'circle') return (b.r - a.r);
      return 0;
    });

    sorted.forEach(function (s) {
      if (s.t === 'bed') {
        out.push('<rect' + anim() + ' x="' + (s.x * k).toFixed(1) + '" y="' + (s.y * k).toFixed(1) + '" width="' + (s.w * k).toFixed(1) + '" height="' + (s.h * k).toFixed(1) + '" rx="' + Math.min(8, s.h * k / 2).toFixed(1) + '" fill="' + COLORS.bed + '"/>');
      } else if (s.t === 'pond') {
        out.push('<ellipse' + anim() + ' cx="' + (s.x * k).toFixed(1) + '" cy="' + (s.y * k).toFixed(1) + '" rx="' + (s.rx * k).toFixed(1) + '" ry="' + (s.ry * k).toFixed(1) + '" fill="' + COLORS.water + '" stroke="#12332E" stroke-width="1.5"/>');
      } else if (s.t === 'barrel') {
        var br = Math.max(7, s.r * k);
        out.push('<circle' + anim() + ' cx="' + (s.x * k).toFixed(1) + '" cy="' + (s.y * k).toFixed(1) + '" r="' + br.toFixed(1) + '" fill="' + COLORS.water + '" stroke="#12332E" stroke-width="1.5"/>');
      } else if (s.t === 'compost') {
        var cs = Math.max(13, s.s * k);
        var cx = s.x * k + (s.s * k - cs) / 2, cy = s.y * k + (s.s * k - cs);
        out.push('<g' + anim() + '><rect x="' + cx.toFixed(1) + '" y="' + cy.toFixed(1) + '" width="' + cs.toFixed(1) + '" height="' + cs.toFixed(1) + '" rx="2" fill="none" stroke="' + COLORS.compost + '" stroke-width="2.5"/>' +
          '<path d="M' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' l' + cs.toFixed(1) + ' ' + cs.toFixed(1) + ' M' + (cx + cs).toFixed(1) + ' ' + cy.toFixed(1) + ' l-' + cs.toFixed(1) + ' ' + cs.toFixed(1) + '" stroke="' + COLORS.compost + '" stroke-width="1.5"/></g>');
      } else if (s.t === 'trellis') {
        var ty = s.y * k, x0 = s.x0 * k, x1 = s.x1 * k;
        var g = '<g' + anim() + '><path d="M' + x0.toFixed(1) + ' ' + ty.toFixed(1) + ' H' + x1.toFixed(1) + '" stroke="' + COLORS.climb + '" stroke-width="2" stroke-dasharray="7 5" stroke-linecap="round"/>';
        var posts = Math.max(3, Math.round((x1 - x0) / 60));
        for (var p = 0; p <= posts; p++) g += '<circle cx="' + (x0 + (x1 - x0) * p / posts).toFixed(1) + '" cy="' + ty.toFixed(1) + '" r="4" fill="' + COLORS.climb + '"/>';
        out.push(g + '</g>');
      } else if (s.t === 'dot') {
        out.push('<circle' + anim() + ' cx="' + (s.x * k).toFixed(1) + '" cy="' + (s.y * k).toFixed(1) + '" r="' + Math.max(2.6, s.r * k).toFixed(1) + '" fill="' + COLORS[s.role] + '" stroke="#12332E" stroke-width="' + (s.role === 'insect' || s.role === 'ground' ? 1 : 0) + '"/>');
      } else if (s.t === 'circle') {
        var rr = Math.max(5, s.r * k);
        out.push('<circle' + anim() + ' cx="' + (s.x * k).toFixed(1) + '" cy="' + (s.y * k).toFixed(1) + '" r="' + rr.toFixed(1) + '" fill="' + COLORS[s.role] + '" fill-opacity="' + (s.role === 'tree' ? 0.82 : 0.95) + '" stroke="#12332E" stroke-width="1.5"/>');
      }
    });
    out.push('</svg>');
    return out.join('');
  }

  /* ---------- Render ---------- */

  function setCount(id, n) {
    var el = document.getElementById(id);
    if (el) el.textContent = n;
  }

  /* On phones the generator and its two result lists start folded, on larger
     screens they are always open. Without JavaScript everything stays open. */
  var folds = document.querySelectorAll('#garden [data-fold]');
  var phone = window.matchMedia('(max-width: 760px)');
  function syncFolds() {
    folds.forEach(function (d) { d.open = !phone.matches; });
  }
  folds.forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (!phone.matches && !d.open) d.open = true;
    });
  });
  phone.addEventListener('change', syncFolds);
  syncFolds();

  var seed = 20261113;
  var last = null;

  function readSite() {
    return {
      area: sliderToArea(Number(sizeInput.value)),
      climate: form.elements.climate.value,
      sun: form.elements.sun.value,
      water: Number(form.elements.water.value)
    };
  }

  function generate() {
    var site = readSite();
    var rand = rng(seed);
    var team = pickTeam(site, rand);
    var plan = layout(site, rand);
    last = { site: site, team: team, plan: plan };
    mapEl.innerHTML = draw(plan);
    renderText();
  }

  function renderText() {
    if (!last) return;
    var l = lang(), t = T[l], site = last.site, team = last.team, info = last.plan.info;
    sizeOut.textContent = site.area.toLocaleString(l) + ' m²';

    teamEl.innerHTML = ROLE_ORDER.filter(function (r) { return team[r]; }).map(function (r) {
      return '<li><span class="team__swatch" style="background:' + COLORS[r] + '"></span>' +
        '<span class="team__role">' + esc(t.roles[r]) + '</span>' +
        '<strong class="team__plant">' + esc(team[r].n[l]) + '</strong>' +
        '<span class="team__why">' + esc(t.why[r]) + '</span></li>';
    }).join('');

    function name(r) { return team[r] ? team[r].n[l] : ''; }
    var ctx = {
      area: site.area.toLocaleString(l), w: fmt(info.W), h: fmt(info.H),
      trees: info.trees, shrubs: info.shrubs, beds: info.beds, pond: info.pond,
      water: site.water, climate: site.climate,
      tree: name('tree'), nfix: name('nfix'), shrub: name('shrub'), climb: name('climb'),
      ground: name('ground'), root: name('root'), insect: name('insect'), mulch: name('mulch')
    };
    statsEl.textContent = t.stats(ctx);
    planEl.innerHTML = t.plan(ctx).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    setCount('g-team-count', teamEl.children.length);
    setCount('g-plan-count', planEl.children.length);
  }

  form.addEventListener('input', generate);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  shuffleBtn.addEventListener('click', function () {
    seed = (seed * 1664525 + 1013904223) | 0;
    generate();
  });
  document.addEventListener('langchange', renderText);

  generate();
})();
