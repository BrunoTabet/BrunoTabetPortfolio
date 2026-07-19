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
    { key: "beirut",   name: "Beirut",    flag: "🇱🇧", chapter: "Roots",   lat: 33.89,  lon: 35.50 },
    { key: "paris",    name: "Paris",     flag: "🇫🇷", chapter: "Raised",  lat: 48.85,  lon: 2.35 },
    { key: "dubai",    name: "Dubai",     flag: "🇦🇪", chapter: "Lived",   lat: 25.20,  lon: 55.27 },
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
      [0, 0.5].forEach(function (offset) {
        var pulse = el("circle", { class: "map-pulse", r: 2.6 });
        var mo = el("animateMotion", { dur: "11s", repeatCount: "indefinite", rotate: "auto", keyPoints: "0;1", keyTimes: "0;1", calcMode: "linear" });
        mo.setAttribute("begin", (offset * 11) + "s");
        var mp = el("mpath");
        mp.setAttributeNS("http://www.w3.org/1999/xlink", "href", "#journeyGuide");
        mp.setAttribute("href", "#journeyGuide");
        mo.appendChild(mp);
        pulse.appendChild(mo);
        svg.appendChild(pulse);
      });
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
