/* ============================================================
   /projects: demos for the Ahlelak cards.
   Same rules as main.js: each plays once when scrolled into view,
   then freezes. A small Replay pill runs it again.
   setTimeout (not rAF) everywhere, so headless captures advance.
   ============================================================ */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion:reduce)").matches;

  /* Runs `play(step)` once on first view. `step(ms)` resolves after ms,
     or rejects if a replay started meanwhile, which ends the old run. */
  function stage(root, reset, play) {
    if (!root) return;
    var gen = 0;
    var btn = root.querySelector(".demo-replay");

    function start() {
      var mine = ++gen;
      if (btn) btn.classList.remove("show");
      reset();
      var step = function (ms) {
        return new Promise(function (resolve, reject) {
          setTimeout(function () { mine === gen ? resolve() : reject(0); }, reduce ? Math.min(ms, 40) : ms);
        });
      };
      play(step).then(function () {
        if (mine === gen && btn) btn.classList.add("show");
      }).catch(function () {});
    }

    if (btn) btn.addEventListener("click", function (e) { e.stopPropagation(); start(); });

    if (!("IntersectionObserver" in window)) { start(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { io.disconnect(); start(); }
      });
    }, { threshold: 0.35 });
    io.observe(root);
  }

  function h(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  /* add a class on the next tick so the transition runs */
  function show(n, cls) { setTimeout(function () { n.classList.add(cls || "show"); }, 30); }

  /* ------------------------------------------------------------
     Ahlein: a voice note on WhatsApp becomes a block in the calendar
     ------------------------------------------------------------ */
  function initAhlein() {
    var root = document.getElementById("ahDemo");
    if (!root) return;
    var chat = document.getElementById("ahChat");
    var grid = document.getElementById("ahGrid");
    var toast = document.getElementById("ahToast");

    var OPEN = 10 * 60, SPAN = 4 * 60; // 10:00 → 14:00
    var hours = grid.querySelector(".ah__hours");
    [10, 11, 12, 13].forEach(function (hr) {
      var s = h("span", "", String(hr > 12 ? hr - 12 : hr));
      s.style.top = ((hr * 60 - OPEN) / SPAN * 100) + "%";
      hours.appendChild(s);
    });
    // hide the first label's overflow above the grid
    hours.firstChild.style.transform = "none";

    var cols = grid.querySelectorAll(".ah__col");
    function appt(col, from, to, title, sub, cls) {
      var a = h("div", "ah__appt" + (cls ? " " + cls : ""), "<b>" + title + "</b><small>" + sub + "</small>");
      a.style.top = ((from - OPEN) / SPAN * 100) + "%";
      a.style.height = "calc(" + ((to - from) / SPAN * 100) + "% - 2px)";
      cols[col].appendChild(a);
      return a;
    }
    var T = function (hh, mm) { return hh * 60 + mm; };
    // the day as it stands before the customer writes
    appt(0, T(10, 0), T(10, 45), "Fade", "Omar · 10:00");
    appt(0, T(12, 0), T(12, 30), "Haircut", "Joe · 12:00");
    appt(0, T(13, 0), T(13, 45), "Cut + beard", "Tony · 1:00");
    appt(1, T(10, 15), T(10, 45), "Beard trim", "Elie · 10:15");
    appt(1, T(11, 0), T(12, 0), "Colour", "Maya · 11:00");
    appt(1, T(12, 30), T(13, 0), "Haircut", "Nabil · 12:30");
    var fresh = appt(0, T(11, 0), T(11, 30), "Haircut", "", "ah__appt--new");

    var bars = [3, 6, 9, 5, 10, 7, 4, 8, 11, 6, 3, 7, 9, 5, 8, 4, 6, 3];
    var wave = bars.map(function (b) { return '<i style="height:' + (b * 9) + '%"></i>'; }).join("");

    function bubble(side, html) {
      var b = h("div", "ah__b ah__b--" + side, html);
      chat.appendChild(b);
      show(b);
      return b;
    }
    function typing(step, ms) {
      var t = h("div", "ah__typing", "<i></i><i></i><i></i>");
      chat.appendChild(t);
      return step(ms).then(function () { t.remove(); });
    }

    stage(root, function () {
      chat.innerHTML = "";
      toast.classList.remove("show");
      fresh.classList.remove("show", "settle");
    }, function (step) {
      var ask;
      return step(500).then(function () {
        bubble("out",
          '<span class="ah__voice"><span class="play"></span><span class="ah__wave">' + wave +
          '</span><small>0:04</small></span><span class="ah__heard">“Haircut Saturday, around 11?”</span>' +
          '<span class="t">10:48</span>');
        return step(700);
      }).then(function () {
        return typing(step, 1300);
      }).then(function () {
        ask = bubble("in",
          "Hi Rami! <b>11:00</b> Saturday is free with <b>Sami</b>. Haircut, 30 min, $15. Book it?" +
          '<span class="ah__btns"><span>Book it</span><span>Another time</span></span>');
        return step(1700);
      }).then(function () {
        ask.querySelector(".ah__btns span").classList.add("tap");
        return step(350);
      }).then(function () {
        bubble("out", 'Book it<span class="t">10:49 ✓✓</span>');
        return typing(step, 900);
      }).then(function () {
        bubble("in", "Booked ✓ <b>Saturday 11:00</b> with Sami. I'll remind you the day before.");
        return step(600);
      }).then(function () {
        toast.classList.add("show");
        return step(500);
      }).then(function () {
        fresh.classList.add("show");
        return step(1600);
      }).then(function () {
        fresh.classList.add("settle");
        toast.classList.remove("show");
        return step(400);
      });
    });
  }

  /* ------------------------------------------------------------
     Ahlelak POS: scan, scan, scan, pay. Offline halfway through.
     ------------------------------------------------------------ */
  var L_CODES = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
  var PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

  function ean13(prefix12) {
    var sum = 0;
    for (var i = 0; i < 12; i++) sum += +prefix12[i] * (i % 2 ? 3 : 1);
    return prefix12 + ((10 - (sum % 10)) % 10);
  }
  function eanModules(code) {
    var bits = "101", par = PARITY[+code[0]], i, l;
    for (i = 1; i <= 6; i++) {
      l = L_CODES[+code[i]];
      if (par[i - 1] === "G") l = l.split("").map(function (c) { return c === "1" ? "0" : "1"; }).reverse().join("");
      bits += l;
    }
    bits += "01010";
    for (i = 7; i <= 12; i++) bits += L_CODES[+code[i]].split("").map(function (c) { return c === "1" ? "0" : "1"; }).join("");
    return bits + "101";
  }
  function barsHtml(code) {
    var bits = eanModules(code), out = "", run = 1;
    for (var i = 1; i <= bits.length; i++) {
      if (bits[i] === bits[i - 1]) { run++; continue; }
      out += '<i style="flex:' + run + (bits[i - 1] === "1" ? "" : ";background:transparent") + '"></i>';
      run = 1;
    }
    return out;
  }

  function initPos() {
    var root = document.getElementById("posDemo");
    if (!root) return;
    var RATE = 89500; // L.L. per dollar, as the demo shop quotes
    var field = document.getElementById("posScan");
    var fieldText = field.querySelector("span");
    var lines = document.getElementById("posLines");
    var usd = document.getElementById("posUsd");
    var lbp = document.getElementById("posLbp");
    var count = document.getElementById("posCount");
    var pay = document.getElementById("posPay");
    var net = document.getElementById("posNet");
    var label = document.getElementById("posLabel");
    var toast = document.getElementById("posToast");

    var ITEMS = [
      { name: "Almaza 330ml", cents: 175, code: ean13("528000100012") },
      { name: "Kinder Bueno 43g", cents: 150, code: ean13("528000100098") },
      { name: "Sohat 500ml", cents: 35, code: ean13("528000100043") }
    ];
    var cart, total, units;

    var usdFmt = function (c) { return "$" + (c / 100).toFixed(2); };
    var lbpFmt = function (c) { return Math.round(c * RATE / 100).toLocaleString("en-US") + " L.L."; };

    function reset() {
      cart = {}; total = 0; units = 0;
      lines.innerHTML = '<div class="pos__empty">Scan a product to start<small>Or search by name</small></div>';
      fieldText.textContent = "Scan or search"; fieldText.classList.remove("val");
      usd.textContent = "$0.00"; lbp.textContent = "0 L.L."; count.textContent = "0 items";
      pay.className = "pos__pay"; pay.textContent = "Pay";
      net.classList.remove("off"); net.lastChild.textContent = "Online";
      label.className = "pos__label"; toast.classList.remove("show");
    }

    function scan(step, item) {
      label.className = "pos__label";
      label.innerHTML = "<b>" + item.name + '</b><div class="pos__code">' + barsHtml(item.code) +
        '<span class="laser"></span></div><span class="pos__digits">' + item.code + "</span>";
      show(label);
      return step(650).then(function () {
        label.querySelector(".laser").classList.add("on");
        return step(560);
      }).then(function () {
        field.classList.add("beep");
        fieldText.textContent = item.code; fieldText.classList.add("val");
        label.classList.add("gone");
        return step(260);
      }).then(function () {
        field.classList.remove("beep");
        fieldText.textContent = "Scan or search"; fieldText.classList.remove("val");
        var empty = lines.querySelector(".pos__empty");
        if (empty) empty.remove();
        var line = cart[item.code];
        if (line) {
          line.qty++;
          var em = line.el.querySelector("em");
          em.textContent = line.qty; em.classList.add("bump");
          setTimeout(function () { em.classList.remove("bump"); }, 300);
        } else {
          var el = h("div", "pos__line",
            "<span><b>" + item.name + "</b><small>" + usdFmt(item.cents) + " · " + lbpFmt(item.cents) + "</small></span>" +
            '<span class="pos__qty"><i>−</i><em>1</em><i>+</i></span><span class="pos__amt"></span>');
          lines.appendChild(el);
          show(el);
          line = cart[item.code] = { qty: 1, el: el };
        }
        line.el.querySelector(".pos__amt").textContent = usdFmt(item.cents * line.qty);
        line.el.classList.add("flash");
        setTimeout(function () { line.el.classList.remove("flash"); }, 450);
        total += item.cents; units++;
        usd.textContent = usdFmt(total); lbp.textContent = lbpFmt(total);
        count.textContent = Object.keys(cart).length + " items · " + units + " units";
        pay.classList.add("ready");
        return step(550);
      });
    }

    stage(root, reset, function (step) {
      return step(500)
        .then(function () { return scan(step, ITEMS[0]); })
        .then(function () {
          net.classList.add("off"); net.lastChild.textContent = "Offline · still selling";
          return step(500);
        })
        .then(function () { return scan(step, ITEMS[1]); })
        .then(function () { return scan(step, ITEMS[2]); })
        .then(function () { return scan(step, ITEMS[2]); })
        .then(function () { return step(500); })
        .then(function () {
          pay.classList.add("press");
          return step(220);
        })
        .then(function () {
          pay.classList.remove("press");
          toast.innerHTML = "Paid in cash · <b>$5.00</b><small>Change $1.05 · saved on this till</small>";
          toast.classList.add("show");
          return step(1900);
        })
        .then(function () {
          toast.classList.remove("show");
          pay.className = "pos__pay done"; pay.textContent = "Sale saved ✓ · stock updated";
          return step(300);
        });
    });
  }

  /* ------------------------------------------------------------
     Invoices: read the pile, book it, then check it
     ------------------------------------------------------------ */
  function initInvoices() {
    var root = document.getElementById("invDemo");
    if (!root) return;
    var docsWrap = document.getElementById("invDocs");
    var prog = document.getElementById("invProg");
    var badge = document.getElementById("invBadge");
    var ledger = document.getElementById("invLedger");
    var checks = document.getElementById("invChecks");

    var DOCS = 10;
    var OUT = { 3: true, 8: true }; // the two invoices going out (revenue)
    var docs = [];
    for (var i = 0; i < DOCS; i++) {
      var d = h("div", "inv__doc" + (OUT[i] ? " out" : ""), '<i></i><i></i><i></i><i></i><i></i><em class="tick">✓</em>');
      docsWrap.appendChild(d);
      docs.push(d);
    }

    var ROWS = [
      ["Chahine Meats SAL", "Entrecôte ×8 · 11 Sep", "Cost", "$180.80"],
      ["Zahle Fresh Produce", "Daily delivery · 12 Sep", "Cost", "$96.40"],
      ["Wedding booking, Verdun", "Function, 140 guests", "Revenue", "$2,450.00"]
    ];
    var FINDINGS = [
      ["alert", "Bank", "Bank account changed", "Chahine Meats wants paying into Crédit Libanais. Every earlier invoice went to Bank Audi."],
      ["", "Price", "Entrecôte up 23%", "22.60 a kilo now, 18.40 in March. Each invoice is correct on its own."],
      ["", "Twice", "Same invoice, arrived twice", "Zahle Fresh Produce, same reference as the one booked on 9 Sep."],
      ["", "Maths", "Total doesn't match its lines", "Printed total is $11.00 more than the lines add up to."]
    ];

    stage(root, function () {
      docs.forEach(function (d) { d.classList.remove("reading", "read"); });
      prog.style.width = "0";
      badge.className = "inv__badge"; badge.textContent = "30 unread";
      ledger.innerHTML = ""; checks.innerHTML = "";
    }, function (step) {
      var p = step(450);
      docs.forEach(function (d, i) {
        p = p.then(function () {
          d.classList.add("reading");
          badge.textContent = "Reading " + Math.round((i + 1) * 3) + " / 30";
          prog.style.width = ((i + 1) / DOCS * 100) + "%";
          return step(240);
        }).then(function () { d.classList.add("read"); });
      });
      return p.then(function () {
        badge.textContent = "30 read";
        return step(350);
      }).then(function () {
        var q = Promise.resolve();
        ROWS.forEach(function (r) {
          q = q.then(function () {
            var row = h("div", "inv__row",
              "<span><b>" + r[0] + "</b><small>" + r[1] + "</small></span>" +
              '<span class="inv__dir' + (r[2] === "Revenue" ? " in" : "") + '">' + r[2] + "</span>" +
              '<span class="inv__amt">' + r[3] + "</span>");
            ledger.appendChild(row);
            show(row);
            return step(330);
          });
        });
        return q;
      }).then(function () {
        var more = h("div", "inv__more", "+ 27 more · 26 costs, 1 more revenue · one clean spreadsheet");
        ledger.appendChild(more);
        show(more);
        return step(500);
      }).then(function () {
        var c = h("div", "inv__checking", "<i></i><span>Checking against 15 earlier documents…</span>");
        checks.appendChild(c);
        show(c);
        return step(1100).then(function () { return c; });
      }).then(function (c) {
        c.classList.add("done");
        c.querySelector("span").textContent = "Checked against 15 earlier documents";
        var q = Promise.resolve();
        FINDINGS.forEach(function (f) {
          q = q.then(function () {
            var n = h("div", "inv__find" + (f[0] ? " " + f[0] : ""),
              '<span class="k">' + f[1] + "</span><b>" + f[2] + "</b><small>" + f[3] + "</small>");
            checks.appendChild(n);
            show(n);
            return step(650);
          });
        });
        return q;
      }).then(function () {
        badge.className = "inv__badge warn"; badge.textContent = "4 need a person";
        return step(300);
      });
    });
  }

  function init() {
    initAhlein();
    initPos();
    initInvoices();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
