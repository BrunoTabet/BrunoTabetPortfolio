/* ============================================================
   Bruno Tabet — portfolio interactions
   1. The cities world-map motif (signature moment)
      - real continents, glowing journey arcs, a traveling pulse
      - legend <-> map interactive highlighting
   2. Ambient cursor glow, scroll reveals, nav state
   ============================================================ */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SVG_NS = "http://www.w3.org/2000/svg";
  var W = 1000, H = 500; // equirectangular canvas (2:1)

  /* --- the journey, in order --- */
  var CITIES = [
    { key: "tokyo",    name: "Tokyo",     flag: "🇯🇵", chapter: "Born",    lat: 35.68,  lon: 139.65 },
    { key: "beirut",   name: "Lebanon",   flag: "🇱🇧", chapter: "Family",  lat: 33.89,  lon: 35.50 },
    { key: "paris",    name: "Paris",     flag: "🇫🇷", chapter: "Raised",  lat: 48.85,  lon: 2.35 },
    { key: "dubai",    name: "Dubai",     flag: "🇦🇪", chapter: "Worked",  lat: 25.20,  lon: 55.27 },
    { key: "berkeley", name: "Berkeley",  flag: "🇺🇸", chapter: "Studied", lat: 37.87,  lon: -122.27 },
    { key: "sandiego", name: "San Diego", flag: "🇺🇸", chapter: "Worked",  lat: 32.72,  lon: -117.16 },
    { key: "newyork",  name: "New York",  flag: "🇺🇸", chapter: "Now",     lat: 40.71,  lon: -74.00 }
  ];

  function project(lat, lon) {
    return { x: (lon + 180) / 360 * W, y: (90 - lat) / 180 * H };
  }
  function el(name, attrs) {
    var n = document.createElementNS(SVG_NS, name);
    for (var k in attrs) { if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]); }
    return n;
  }

  var cityNodes = {}; // key -> { dot, ring, label, base }

  function buildMap() {
    var svg = document.getElementById("worldMap");
    if (!svg) return;
    var pts = CITIES.map(function (c) { return project(c.lat, c.lon); });

    // --- real continents ---
    if (window.WORLD_LAND) {
      var land = el("path", { class: "map-land", d: window.WORLD_LAND, "fill-rule": "evenodd" });
      svg.appendChild(land);
    }

    // --- graticule (subtle world grid over the land) ---
    var grid = el("g", { class: "map-grid" });
    for (var lon = -150; lon <= 150; lon += 30) {
      var gx = (lon + 180) / 360 * W;
      grid.appendChild(el("line", { x1: gx, y1: 0, x2: gx, y2: H }));
    }
    for (var lat = -30; lat <= 60; lat += 30) {
      var gy = (90 - lat) / 180 * H;
      grid.appendChild(el("line", { x1: 0, y1: gy, x2: W, y2: gy }));
    }
    svg.appendChild(grid);

    // --- arcs between consecutive cities + one combined journey path ---
    var arcs = [];
    var journeyD = "M" + pts[0].x + "," + pts[0].y;
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      var dist = Math.hypot(b.x - a.x, b.y - a.y);
      var lift = Math.min(dist * 0.28, 110);
      var seg = " Q" + mx + "," + (my - lift) + " " + b.x + "," + b.y;
      journeyD += seg;
      var arc = el("path", { class: "map-arc", d: "M" + a.x + "," + a.y + seg });
      svg.appendChild(arc);
      arcs.push(arc);
    }

    // --- traveling pulse along the whole journey ---
    if (!reduceMotion) {
      var guide = el("path", { d: journeyD, fill: "none", stroke: "none", id: "journeyGuide" });
      svg.appendChild(guide);
      var pulses = [];
      [0, 0.5].forEach(function (offset) {
        var pulse = el("circle", { class: "map-pulse", r: 2.6 });
        // finite: a couple of passes down the journey, then it settles
        var mo = el("animateMotion", { dur: "11s", repeatCount: "2", rotate: "auto", keyPoints: "0;1", keyTimes: "0;1", calcMode: "linear" });
        mo.setAttribute("begin", (offset * 11) + "s");
        var mp = el("mpath");
        mp.setAttributeNS("http://www.w3.org/1999/xlink", "href", "#journeyGuide");
        mp.setAttribute("href", "#journeyGuide");
        mo.appendChild(mp);
        pulse.appendChild(mo);
        svg.appendChild(pulse);
        pulses.push(pulse);
      });
      // remove the pulses once they've made their passes, so the map comes to rest
      setTimeout(function () { pulses.forEach(function (p) { p.remove(); }); }, 24000);
    }

    // --- city markers + labels ---
    var labels = [];
    CITIES.forEach(function (c, idx) {
      var p = pts[idx];
      var isNow = idx === CITIES.length - 1;
      var g = el("g", { class: "city" + (isNow ? " city--now" : ""), id: "city-" + c.key });
      g.appendChild(el("circle", { class: "map-city-glow", cx: p.x, cy: p.y, r: 9 }));
      var ring = el("circle", { class: "map-city-ring", cx: p.x, cy: p.y, r: 4 });
      g.appendChild(ring);
      var dot = el("circle", { class: "map-city", cx: p.x, cy: p.y, r: isNow ? 3.4 : 2.6 });
      g.appendChild(dot);

      var anchor = p.x > W - 130 ? "end" : "start";
      var dx = anchor === "end" ? -9 : 9;
      var label = el("text", { class: "map-label" + (isNow ? " is-now" : ""), x: p.x + dx, y: p.y - 9, "text-anchor": anchor });
      label.textContent = c.name;
      g.appendChild(label);

      svg.appendChild(g);
      cityNodes[c.key] = { dot: dot, ring: ring, label: label, baseR: isNow ? 3.4 : 2.6 };
      labels.push({ node: label, ring: ring });
    });

    animate(arcs, labels);
    initLegendLink();
  }

  function animate(arcs, labels) {
    var journey = document.getElementById("journey");
    if (reduceMotion) {
      arcs.forEach(function (a) { a.style.opacity = ".5"; });
      labels.forEach(function (l) { l.node.style.opacity = ".8"; });
      if (journey) { journey.classList.add("is-in"); }
      return;
    }
    var perArc = 520;
    arcs.forEach(function (arc, i) {
      var len = arc.getTotalLength();
      arc.style.strokeDasharray = len;
      arc.style.strokeDashoffset = len;
      arc.style.opacity = ".5";
      arc.style.transition = "stroke-dashoffset " + perArc + "ms cubic-bezier(0.22,1,0.36,1)";
      setTimeout(function () { arc.style.strokeDashoffset = "0"; }, 500 + i * perArc);
    });
    labels.forEach(function (l, i) {
      var delay = 500 + (i === 0 ? 0 : (i - 1) * perArc + perArc * 0.6);
      setTimeout(function () {
        l.node.style.transition = "opacity .5s ease";
        l.node.style.opacity = ".8";
        l.ring.style.transition = "r 1.2s ease-out, opacity 1.2s ease-out";
        l.ring.setAttribute("r", "13");
        l.ring.style.opacity = "0";
      }, delay);
    });
    if (journey) {
      journey.classList.add("is-in");
      Array.prototype.forEach.call(journey.children, function (li, i) {
        li.style.animationDelay = (600 + i * 90) + "ms";
      });
    }
  }

  /* --- legend <-> map highlight --- */
  function setActive(key, on) {
    var n = cityNodes[key];
    var li = document.querySelector('.journey [data-city="' + key + '"], .journey li[data-city="' + key + '"]');
    if (!n) return;
    n.dot.setAttribute("r", on ? n.baseR + 2.4 : n.baseR);
    n.label.style.opacity = on ? "1" : ".8";
    n.label.style.fill = on ? "var(--accent-hi)" : "";
    var g = document.getElementById("city-" + key);
    if (g) g.classList.toggle("is-active", on);
    var legendItem = document.querySelector('.journey li[data-city="' + key + '"]');
    if (legendItem) legendItem.classList.toggle("is-active", on);
  }

  function initLegendLink() {
    var items = document.querySelectorAll(".journey li[data-city]");
    Array.prototype.forEach.call(items, function (li) {
      var key = li.getAttribute("data-city");
      li.tabIndex = 0;
      var on = function () { setActive(key, true); };
      var off = function () { setActive(key, false); };
      li.addEventListener("mouseenter", on);
      li.addEventListener("mouseleave", off);
      li.addEventListener("focus", on);
      li.addEventListener("blur", off);
    });
  }

  /* --- ambient cursor glow in the hero --- */
  function initGlow() {
    var hero = document.getElementById("hero");
    if (!hero || reduceMotion || !window.matchMedia("(pointer:fine)").matches) return;
    var glow = document.createElement("div");
    glow.className = "hero__glow";
    hero.appendChild(glow);
    var raf = null;
    hero.addEventListener("pointermove", function (e) {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        var r = hero.getBoundingClientRect();
        glow.style.setProperty("--gx", (e.clientX - r.left) + "px");
        glow.style.setProperty("--gy", (e.clientY - r.top) + "px");
        glow.style.opacity = "1";
        raf = null;
      });
    });
    hero.addEventListener("pointerleave", function () { glow.style.opacity = "0"; });
  }

  /* --- scroll reveals --- */
  function initReveals() {
    var items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window) || reduceMotion) {
      items.forEach(function (n) { n.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    items.forEach(function (n) { io.observe(n); });
  }

  /* --- nav scrolled state --- */
  function initNav() {
    var nav = document.getElementById("nav");
    if (!nav) return;
    var onScroll = function () { nav.classList.toggle("is-scrolled", window.scrollY > 24); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* --- Najma live Nujoom demo (reproduced from the getnajma.com landing) --- */
  function initNajmaDemo() {
    var stream = document.getElementById("njStream");
    var dotsWrap = document.getElementById("njDots");
    if (!stream) return;
    var dots = dotsWrap ? Array.prototype.slice.call(dotsWrap.children) : [];
    var BLUE = "#6cc3ef", ROSE = "#f0a6c0", SOL = "#e9be5c";

    var convos = [
      {
        q: "Best day to ask for a raise this month?",
        a: "Thursday the 24th edges it. The Sun lights up your <b>10th house of career</b>, so visibility and authority run high that day.",
        head: "✦ Career timing", sub: "this week · higher = stronger",
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        you: [54, 61, 58, 82, 60, 47, 50], peak: 3
      },
      {
        q: "When should I call my mum this week?",
        a: "This week is fairly even, so you have room to choose. <b>Thursday lands warmest</b>, with the Moon in your 4th house of home and family.",
        head: "🏡 Reaching out", sub: "you vs Lea · higher = warmer",
        labels: ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"],
        you: [50, 50, 45, 45, 49, 51, 46], lea: [47, 49, 44, 43, 46, 48, 45], peak: 5
      }
    ];

    var reduce = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    function wait(ms) { return new Promise(function (r) { setTimeout(r, reduce ? Math.min(ms, 100) : ms); }); }

    function chartEl(c) {
      var arr = c.lea ? c.you.concat(c.lea) : c.you;
      var max = Math.max.apply(null, arr);
      var card = document.createElement("div"); card.className = "card2";
      var legend = c.lea
        ? '<div class="legend2"><span><i style="background:' + BLUE + '"></i>You</span><span><i style="background:' + ROSE + '"></i>Lea</span></div>'
        : "";
      card.innerHTML = '<div class="card2-h">' + c.head + '</div><div class="card2-sub">' + c.sub + "</div>" + legend + '<div class="chart2"></div>';
      var chart = card.querySelector(".chart2");
      c.labels.forEach(function (lb, i) {
        var col = document.createElement("div");
        col.className = "col2" + (i === c.peak ? " peak" : "");
        if (c.lea) {
          col.innerHTML = '<div class="bars2"><span class="bar2 j1" style="--bw:6px;background:' + BLUE + '"></span><span class="bar2 j2" style="--bw:6px;background:' + ROSE + '"></span></div><small>' + lb + "</small>";
        } else {
          var color = i === c.peak ? SOL : BLUE;
          col.innerHTML = '<div class="bars2"><span class="bar2 j1" style="--bw:11px;background:' + color + '"></span></div><small>' + lb + "</small>";
        }
        chart.appendChild(col);
        var j1 = col.querySelector(".j1"), j2 = col.querySelector(".j2");
        setTimeout(function () {
          j1.style.height = (c.you[i] / max * 100) + "%";
          if (j2) j2.style.height = (c.lea[i] / max * 100) + "%";
        }, 70 * i + 140);
      });
      return card;
    }

    function typeQ(text) {
      var q = document.createElement("div"); q.className = "q";
      var span = document.createElement("span");
      var cur = document.createElement("span"); cur.className = "cursor";
      q.appendChild(span); q.appendChild(cur); stream.appendChild(q);
      if (reduce) { span.textContent = text; cur.remove(); return Promise.resolve(); }
      return new Promise(function (resolve) {
        var i = 0;
        (function step() {
          if (i >= text.length) { setTimeout(function () { cur.remove(); resolve(); }, 260); return; }
          span.textContent = text.slice(0, ++i);
          setTimeout(step, 26 + Math.random() * 42);
        })();
      });
    }

    function showTyping() {
      var t = document.createElement("div"); t.className = "a show";
      t.innerHTML = '<div class="typing2"><i></i><i></i><i></i></div>';
      stream.appendChild(t);
      return wait(reduce ? 100 : 850).then(function () { t.remove(); });
    }

    function answer(c) {
      var a = document.createElement("div"); a.className = "a";
      a.innerHTML = '<div class="a-text">' + c.a + "</div>";
      a.appendChild(chartEl(c));
      stream.appendChild(a);
      requestAnimationFrame(function () { a.classList.add("show"); });
    }

    var idx = 0, started = false, gen = 0;
    function run() {
      var myGen = ++gen; // any newer run (e.g. a dot click) cancels this one
      stream.style.opacity = 0;
      wait(reduce ? 60 : 260).then(function () {
        if (myGen !== gen) return;
        stream.innerHTML = ""; stream.style.opacity = 1;
        dots.forEach(function (d, i) { d.classList.toggle("on", i === idx); });
        var c = convos[idx];
        return typeQ(c.q)
          .then(function () { if (myGen !== gen) throw 0; return showTyping(); })
          .then(function () { if (myGen !== gen) throw 0; answer(c); });
      }).then(function () {
        if (myGen !== gen) return;
        // play each question once, then freeze on the last frame
        if (idx < convos.length - 1) {
          return wait(reduce ? 2200 : 5200).then(function () { if (myGen === gen) { idx++; run(); } });
        }
      }).catch(function () {});
    }

    // let the reader jump between the two examples
    dots.forEach(function (d, i) {
      d.addEventListener("click", function (e) { e.stopPropagation(); idx = i; run(); });
    });

    // start only when the card scrolls into view (saves work off-screen)
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting && !started) { started = true; run(); io.disconnect(); }
        });
      }, { threshold: 0.25 });
      io.observe(stream);
    } else { run(); }
  }

  /* --- hiresort live scoring demo --- */
  function initHiresortDemo() {
    var list = document.getElementById("hsList");
    var prog = document.getElementById("hsProg");
    var badge = document.getElementById("hsBadge");
    if (!list || !prog) return;
    var reduce = window.matchMedia("(prefers-reduced-motion:reduce)").matches;

    var cands = [
      { name: "A. Haddad", note: "PyTorch · MLOps · led 2 launches", score: 92, hi: true },
      { name: "M. Okafor", note: "Strong DS · gap: production ML", score: 87, hi: true },
      { name: "J. Rivera", note: "Junior · no MLOps signal", score: 71, hi: false, dim: true }
    ];

    function wait(ms) { return new Promise(function (r) { setTimeout(r, reduce ? Math.min(ms, 120) : ms); }); }

    function countUp(el, target, ms) {
      if (reduce) { el.textContent = target; return; }
      var steps = 22, i = 0;
      var iv = setInterval(function () {
        i++;
        var t = i / steps;
        el.textContent = Math.round(target * (t * (2 - t))); // easeOut
        if (i >= steps) { clearInterval(iv); el.textContent = target; }
      }, ms / steps);
    }

    function fillProgress(ms) {
      return new Promise(function (resolve) {
        prog.style.transition = "none";
        prog.style.width = "0";
        // next frame: enable the transition and fill to 100%
        requestAnimationFrame(function () {
          prog.style.transition = "width " + (reduce ? 200 : ms) + "ms linear";
          prog.style.width = "100%";
        });
        setTimeout(resolve, reduce ? 200 : ms);
      });
    }

    function addRow(c, rank) {
      var row = document.createElement("div");
      row.className = "mhs__row" + (c.dim ? " mhs__row--dim" : "");
      row.innerHTML = '<span class="mhs__rank">' + rank + '</span>' +
        '<span class="mhs__who"><b>' + c.name + '</b><small>' + c.note + '</small></span>' +
        '<span class="mhs__score' + (c.hi ? ' mhs__score--hi' : '') + '">0</span>';
      list.appendChild(row);
      requestAnimationFrame(function () { row.classList.add("show"); });
      countUp(row.querySelector(".mhs__score"), c.score, 700);
    }

    var started = false;
    function run() {
      list.innerHTML = "";
      prog.style.width = "0";
      if (badge) { badge.textContent = "Scoring…"; badge.classList.add("is-scoring"); }
      wait(400).then(function () { return fillProgress(reduce ? 200 : 1400); }).then(function () {
        if (badge) { badge.textContent = "Ranked"; badge.classList.remove("is-scoring"); }
        var seq = Promise.resolve();
        cands.forEach(function (c, i) {
          seq = seq.then(function () { return wait(i === 0 ? 200 : 320); }).then(function () { addRow(c, i + 1); });
        });
        return seq;
      });
      // scored once, then freeze on the ranked list (no loop)
    }

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting && !started) { started = true; run(); io.disconnect(); }
        });
      }, { threshold: 0.3 });
      io.observe(list);
    } else { run(); }
  }

  /* --- Ahlein live WhatsApp demo (cycles business types) --- */
  function initAhleinDemo() {
    var chat = document.getElementById("waChat");
    var bizEl = document.getElementById("waBiz");
    if (!chat) return;
    var reduce = window.matchMedia("(prefers-reduced-motion:reduce)").matches;

    var scenarios = [
      { biz: "Ana · Hair Salon", msgs: [
        { t: "in",  x: "marhaba! baddi maw3ad la haircut bukra 🙏" },
        { t: "out", x: "Ahla! Tomorrow I have <b>3:30</b> or <b>5:00pm</b> with Sami. Which suits you?" },
        { t: "in",  x: "5 🙌" },
        { t: "out", x: "Booked ✂️ Tomorrow 5:00pm with Sami. I'll remind you the day before." }
      ]},
      { biz: "Dr. Aoun · Clinic", msgs: [
        { t: "in",  x: "bonjour, je voudrais un rendez-vous cette semaine" },
        { t: "out", x: "Bien sûr ! J'ai <b>jeudi 11h</b> ou <b>vendredi 15h</b>. Lequel préférez-vous ?" },
        { t: "in",  x: "vendredi svp" },
        { t: "out", x: "C'est noté ✅ Vendredi 15h. À très vite !" }
      ]},
      { biz: "Olive · Restaurant", msgs: [
        { t: "in",  x: "table for 4 tonight around 8?" },
        { t: "out", x: "Got it. <b>8:15pm for 4</b> is open. Want me to hold it?" },
        { t: "in",  x: "yes please" },
        { t: "out", x: "Done 🍽️ Table for 4 at 8:15 tonight. See you then!" }
      ]}
    ];

    function wait(ms) { return new Promise(function (r) { setTimeout(r, reduce ? Math.min(ms, 120) : ms); }); }

    function addBubble(m) {
      var b = document.createElement("div");
      b.className = "mwa__bubble mwa__bubble--" + m.t;
      b.innerHTML = m.x;
      chat.appendChild(b);
      requestAnimationFrame(function () { b.classList.add("show"); });
    }
    function typing() {
      var t = document.createElement("div"); t.className = "mwa__typing";
      t.innerHTML = "<i></i><i></i><i></i>";
      chat.appendChild(t);
      requestAnimationFrame(function () { t.classList.add("show"); });
      return t;
    }

    var idx = 0, started = false;
    function run() {
      var sc = scenarios[idx];
      chat.innerHTML = "";
      if (bizEl) bizEl.textContent = sc.biz;
      var seq = Promise.resolve();
      sc.msgs.forEach(function (m, i) {
        seq = seq.then(function () { return wait(i === 0 ? 500 : 700); }).then(function () {
          if (m.t === "out") {
            var t = typing();
            return wait(reduce ? 120 : 900).then(function () { t.remove(); addBubble(m); });
          }
          addBubble(m);
        });
      });
      seq.then(function () {
        // play each business once, then freeze on the last conversation
        if (idx < scenarios.length - 1) {
          return wait(reduce ? 2200 : 3400).then(function () { idx++; run(); });
        }
      });
    }

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting && !started) { started = true; run(); io.disconnect(); }
        });
      }, { threshold: 0.3 });
      io.observe(chat);
    } else { run(); }
  }

  /* --- Berkeley capstone · citation forecast demo (runs once) --- */
  function initCapstoneDemo() {
    var chart = document.getElementById("capChart");
    if (!chart) return;
    var reduce = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    var data = [14, 22, 30, 46, 58, 74, 96, 128, 150];
    var labels = ["’17", "’18", "’19", "’20", "’21", "’22", "’23", "’24", "’25"];
    var foreFrom = 7, max = 165;
    var started = false;

    function build() {
      chart.innerHTML = "";
      var thr = document.createElement("div");
      thr.className = "mcap__thresh";
      thr.style.bottom = (100 / max * 100) + "%";
      thr.innerHTML = "<span>breakthrough · 100</span>";
      chart.appendChild(thr);
      var flag = document.createElement("div");
      flag.className = "mcap__flag";
      flag.textContent = "breakthrough predicted ✓";
      chart.appendChild(flag);

      data.forEach(function (v, i) {
        var col = document.createElement("div"); col.className = "mcap__col";
        var fore = i >= foreFrom;
        col.innerHTML = '<span class="mcap__bar' + (fore ? " is-fore" : "") + '"></span><small>' + labels[i] + "</small>";
        chart.appendChild(col);
        var bar = col.querySelector(".mcap__bar");
        setTimeout(function () { bar.style.height = (v / max * 100) + "%"; }, reduce ? 0 : 90 * i + 200);
      });
      setTimeout(function () { thr.classList.add("show"); }, reduce ? 0 : 90 * data.length + 400);
      setTimeout(function () { flag.classList.add("show"); }, reduce ? 0 : 90 * data.length + 900);
    }

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting && !started) { started = true; build(); io.disconnect(); } });
      }, { threshold: 0.3 });
      io.observe(chart);
    } else { build(); }
  }

  /* --- case study dialog --- */
  function initCaseStudies() {
    var dialog = document.getElementById("caseDialog");
    var body = document.getElementById("caseBody");
    if (!dialog || !body || typeof dialog.showModal !== "function") return;
    var opener = null;

    function open(key) {
      var tpl = document.querySelector('template[data-case-tpl="' + key + '"]');
      if (!tpl) return;
      body.innerHTML = "";
      body.appendChild(tpl.content.cloneNode(true));
      opener = document.activeElement;
      dialog.showModal();
      dialog.scrollTop = 0;
      document.body.style.overflow = "hidden";
    }
    function close() {
      if (dialog.open) dialog.close();
    }

    // open triggers: explicit buttons + clicking a project card (but not its links/buttons)
    document.querySelectorAll("[data-case-open]").forEach(function (b) {
      b.addEventListener("click", function (e) { e.stopPropagation(); open(b.getAttribute("data-case-open")); });
    });
    document.querySelectorAll("[data-case]").forEach(function (card) {
      card.style.cursor = "pointer";
      card.addEventListener("click", function (e) {
        if (e.target.closest("a") || e.target.closest("[data-case-open]")) return;
        open(card.getAttribute("data-case"));
      });
    });

    dialog.querySelector("[data-case-close]").addEventListener("click", close);
    // click on backdrop (the dialog element itself, outside the body) closes
    dialog.addEventListener("click", function (e) { if (e.target === dialog) close(); });
    dialog.addEventListener("close", function () {
      document.body.style.overflow = "";
      body.innerHTML = "";
      if (opener && opener.focus) opener.focus();
    });
  }

  function init() {
    buildMap();
    initGlow();
    initReveals();
    initNav();
    initNajmaDemo();
    initHiresortDemo();
    initAhleinDemo();
    initCapstoneDemo();
    initCaseStudies();
    var y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
