/* ============================================================
   Bruno Tabet — portfolio interactions
   1. The cities world-map motif (signature moment)
   2. Scroll reveals + nav state
   ============================================================ */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SVG_NS = "http://www.w3.org/2000/svg";
  var W = 1000, H = 500; // equirectangular canvas (2:1)

  /* --- the journey, in order --- */
  var CITIES = [
    { key: "tokyo",    name: "Tokyo",     lat: 35.68,  lon: 139.65 },
    { key: "beirut",   name: "Beirut",    lat: 33.89,  lon: 35.50 },
    { key: "paris",    name: "Paris",     lat: 48.85,  lon: 2.35 },
    { key: "dubai",    name: "Dubai",     lat: 25.20,  lon: 55.27 },
    { key: "berkeley", name: "Berkeley",  lat: 37.87,  lon: -122.27 },
    { key: "sandiego", name: "San Diego", lat: 32.72,  lon: -117.16 },
    { key: "newyork",  name: "New York",  lat: 40.71,  lon: -74.00 }
  ];

  // equirectangular projection -> canvas coords
  function project(lat, lon) {
    return {
      x: (lon + 180) / 360 * W,
      y: (90 - lat) / 180 * H
    };
  }

  function el(name, attrs) {
    var n = document.createElementNS(SVG_NS, name);
    for (var k in attrs) { if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]); }
    return n;
  }

  function buildMap() {
    var svg = document.getElementById("worldMap");
    if (!svg) return;

    var pts = CITIES.map(function (c) { return project(c.lat, c.lon); });

    // --- graticule (subtle world grid) ---
    var grid = el("g", { class: "map-grid" });
    for (var lon = -150; lon <= 150; lon += 30) {
      var x = (lon + 180) / 360 * W;
      grid.appendChild(el("line", { x1: x, y1: 0, x2: x, y2: H }));
    }
    for (var lat = -60; lat <= 60; lat += 30) {
      var y = (90 - lat) / 180 * H;
      grid.appendChild(el("line", { x1: 0, y1: y, x2: W, y2: y }));
    }
    svg.appendChild(grid);

    // --- arcs between consecutive cities (flight-path curves) ---
    var arcs = [];
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      var dist = Math.hypot(b.x - a.x, b.y - a.y);
      var lift = Math.min(dist * 0.28, 110); // bulge upward like a great-circle
      var d = "M" + a.x + "," + a.y + " Q" + mx + "," + (my - lift) + " " + b.x + "," + b.y;
      var arc = el("path", { class: "map-arc", d: d });
      svg.appendChild(arc);
      arcs.push(arc);
    }

    // --- city dots + labels ---
    var labels = [];
    CITIES.forEach(function (c, idx) {
      var p = pts[idx];
      var isNow = idx === CITIES.length - 1;
      svg.appendChild(el("circle", { class: "map-city-glow", cx: p.x, cy: p.y, r: 8 }));
      var ring = el("circle", { class: "map-city-ring", cx: p.x, cy: p.y, r: 4 });
      svg.appendChild(ring);
      svg.appendChild(el("circle", { class: "map-city", cx: p.x, cy: p.y, r: isNow ? 3.4 : 2.6 }));

      // place label to avoid running off the right edge
      var anchor = p.x > W - 120 ? "end" : "start";
      var dx = anchor === "end" ? -8 : 8;
      var label = el("text", {
        class: "map-label" + (isNow ? " is-now" : ""),
        x: p.x + dx, y: p.y - 8, "text-anchor": anchor
      });
      label.textContent = c.name;
      svg.appendChild(label);
      labels.push({ node: label, ring: ring });
    });

    animate(arcs, labels);
  }

  function animate(arcs, labels) {
    if (reduceMotion) {
      arcs.forEach(function (a) { a.style.opacity = ".55"; });
      labels.forEach(function (l) { l.node.style.opacity = ".8"; });
      var jr = document.getElementById("journey");
      if (jr) { jr.classList.add("is-in"); Array.prototype.forEach.call(jr.children, function (li) { li.style.opacity = 1; }); }
      return;
    }

    // draw each arc in sequence, revealing the destination label as it lands
    var perArc = 520; // ms
    arcs.forEach(function (arc, i) {
      var len = arc.getTotalLength();
      arc.style.strokeDasharray = len;
      arc.style.strokeDashoffset = len;
      arc.style.opacity = ".55";
      arc.style.transition = "stroke-dashoffset " + perArc + "ms cubic-bezier(0.22,1,0.36,1)";
      var delay = 500 + i * perArc;
      setTimeout(function () { arc.style.strokeDashoffset = "0"; }, delay);
    });

    // reveal labels: first at start, rest as each arc arrives
    labels.forEach(function (l, i) {
      var delay = 500 + (i === 0 ? 0 : (i - 1) * perArc + perArc * 0.6);
      setTimeout(function () {
        l.node.style.transition = "opacity .5s ease";
        l.node.style.opacity = ".8";
        l.ring.style.transition = "r 1.2s ease-out, opacity 1.2s ease-out";
        l.ring.setAttribute("r", "12");
        l.ring.style.opacity = "0";
      }, delay);
    });

    // stagger the text journey legend below the hero
    var journey = document.getElementById("journey");
    if (journey) {
      journey.classList.add("is-in");
      Array.prototype.forEach.call(journey.children, function (li, i) {
        li.style.animationDelay = (600 + i * 90) + "ms";
      });
    }
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

  function init() {
    buildMap();
    initReveals();
    initNav();
    var y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
