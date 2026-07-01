/* ============================================================================
   attacks.js — OWASP attack instrumentation for the PostFinance Careers demo.

   Loaded by all 5 handoff pages (AFTER support.js). It does NOT touch the
   product design. It provides:
     • window.PFAttacks  — shared, cross-page state + helpers used by each
                           page's <script data-dc-script> Component methods.
     • Cross-page state via localStorage (so the applicant's poison survives
       the header role-switch into the HR pages):
         pf_shared_memory — poisoned "facts" injected by the applicant
         pf_cache         — poisoned cached answers (cache-poisoning demo)
         pf_attack_log    — which attack codes have been demonstrated (X/20)
     • A floating caption panel that explains each attack (code · name ·
       what just happened · tool-trace · meter · one-line fix).
     • A contained XSS "fired" banner (no real exfiltration / no real alert).
     • A small fixed demo badge: progress (X/20), shared-context status, Reset.

   Design tokens reused from the handoff: #FFCC00 accent, #00474F teal,
   #1C1C1A ink, #F4F4F1 bg, #E2E2DE hairline. LLM = teal, Agentic = purple,
   danger = red.
   ========================================================================== */
(function () {
  'use strict';
  if (window.PFAttacks) return; // guard against double-load

  var KEYS = { mem: 'pf_shared_memory', cache: 'pf_cache', log: 'pf_attack_log' };
  var TOTAL = 20;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function readJSON(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  /* ---------------------------------------------------------------- state */
  var PFAttacks = {
    keys: KEYS,
    total: TOTAL,

    // poisoned shared "memory" — written by the applicant, read by HR pages
    mem: {
      all: function () { return readJSON(KEYS.mem, {}); },
      get: function (k) { return PFAttacks.mem.all()[k]; },
      set: function (k, v) { var m = PFAttacks.mem.all(); m[k] = v; writeJSON(KEYS.mem, m); PFAttacks._renderBadge(); return v; },
      poisoned: function () { return Object.keys(PFAttacks.mem.all()).length > 0; }
    },

    // poisoned cache — survives "regenerate" until reset (cache-poisoning demo)
    cache: {
      get: function (k) { return readJSON(KEYS.cache, {})[k]; },
      set: function (k, v) { var c = readJSON(KEYS.cache, {}); c[k] = v; writeJSON(KEYS.cache, c); return v; },
      has: function (k) { return Object.prototype.hasOwnProperty.call(readJSON(KEYS.cache, {}), k); }
    },

    // attack-demonstration log -> progress X/20
    log: {
      all: function () { return readJSON(KEYS.log, []); },
      count: function () { return PFAttacks.log.all().length; },
      mark: function (code) {
        var l = readJSON(KEYS.log, []);
        if (code && l.indexOf(code) < 0) { l.push(code); writeJSON(KEYS.log, l); }
        PFAttacks._renderBadge();
      }
    },

    reset: function () {
      [KEYS.mem, KEYS.cache, KEYS.log].forEach(function (k) { localStorage.removeItem(k); });
      try { location.reload(); } catch (e) {}
    },

    /* ----------------------------------------------------- caption panel */
    // opts: { code, name, cat:'llm'|'agentic', severity:'critical'|'high'|'medium',
    //         what: string|string[], steps:[{text,status:'ok'|'warn'|'bad'}],
    //         meter:{label,text,to(0-100),danger}, leak:string, fix:string }
    caption: function (opts) {
      opts = opts || {};
      var host = PFAttacks._captionHost();
      var cat = opts.cat === 'agentic' ? 'agentic' : 'llm';
      var sev = (opts.severity || 'high').toLowerCase();
      var whatArr = Array.isArray(opts.what) ? opts.what : (opts.what ? [opts.what] : []);

      var html = '';
      html += '<div class="pfc-head">';
      html += '<span class="pfc-code pfc-' + cat + '">' + esc(opts.code || '') + '</span>';
      html += '<span class="pfc-name">' + esc(opts.name || '') + '</span>';
      html += '<span class="pfc-sev pfc-sev-' + sev + '">' + esc(sev) + '</span>';
      html += '<button class="pfc-x" data-pfc-close aria-label="Close">&times;</button>';
      html += '</div><div class="pfc-body">';

      whatArr.forEach(function (p) { html += '<p class="pfc-p">' + esc(p) + '</p>'; });

      if (opts.leak) html += '<pre class="pfc-leak">' + esc(opts.leak) + '</pre>';

      if (opts.steps && opts.steps.length) {
        html += '<div class="pfc-trace">';
        opts.steps.forEach(function (s) {
          var st = s.status === 'bad' ? 'bad' : s.status === 'warn' ? 'warn' : s.status === 'ok' ? 'ok' : 'dim';
          html += '<div class="pfc-step pfc-' + st + '"><span class="pfc-dot"></span><span>' + esc(s.text) + '</span></div>';
        });
        html += '</div>';
      }

      if (opts.meter) {
        var m = opts.meter;
        html += '<div class="pfc-meter' + (m.danger ? ' pfc-meter-danger' : '') + '">' +
          '<div class="pfc-meter-row"><span>' + esc(m.label || 'Usage') + '</span><span>' + esc(m.text || '') + '</span></div>' +
          '<div class="pfc-meter-bar"><i></i></div></div>';
      }

      if (opts.fix) html += '<p class="pfc-fix"><b>Fix —</b> ' + esc(opts.fix) + '</p>';
      html += '</div>';

      host.innerHTML = html;
      host.className = 'pfc-panel pfc-show';
      // animate meter after paint
      if (opts.meter) {
        var bar = host.querySelector('.pfc-meter-bar > i');
        if (bar) { bar.style.width = '0%'; requestAnimationFrame(function () { bar.style.width = Math.max(0, Math.min(100, opts.meter.to || 0)) + '%'; }); }
      }
      if (opts.code) PFAttacks.log.mark(opts.code);
    },
    closeCaption: function () { var h = document.getElementById('pfc-panel'); if (h) h.className = 'pfc-panel'; },

    /* ------------------------------------------------ contained XSS demo */
    // The deliberately-vulnerable sink: render untrusted text as HTML.
    // Payloads call window.__pfx('<where>') from an onerror handler.
    renderUnsafe: function (node, html) { if (node) node.innerHTML = html; },
    // canned payload used by the LLM05 demos. The injected <img onerror> runs a
    // REAL alert() (classic XSS proof) reading document.cookie, then calls
    // window.__pfx() for the explanatory banner.
    xssPayload: function (where) {
      var w = String(where == null ? 'output' : where).replace(/['"<>\\]/g, '');
      var js = "alert('\\u26A0 XSS executed \\u2014 unsanitised model output ran JavaScript in " + w +
        ".\\n\\ndocument.cookie = ' + window.__pfck());window.__pfx('" + w + "')";
      return 'Top match found. <img src=x style="display:none" onerror="' + js + '">';
    },
    xssBanner: function (where) {
      var b = document.getElementById('pfx-banner') || (function () {
        var d = document.createElement('div'); d.id = 'pfx-banner'; document.body.appendChild(d); return d;
      })();
      var cookie = 'session=pf_' + Math.abs(hashStr(String(where) + 'pf')).toString(16) + '…';
      b.innerHTML = '<div class="pfx-card">' +
        '<b>⚠ XSS executed</b> — unsanitised model output rendered as HTML in <code>' + esc(where) + '</code>. ' +
        'An attacker script just ran in the victim\'s session and read <code>document.cookie</code> = <code>' + esc(cookie) + '</code>. ' +
        '<span class="pfx-note">(contained demo — nothing was actually exfiltrated)</span>' +
        '<button data-pfx-close aria-label="Close">&times;</button></div>';
      b.className = 'pfx-show';
      clearTimeout(PFAttacks._xt); PFAttacks._xt = setTimeout(function () { b.className = ''; }, 6000);
    },

    /* ---------------------------------------------------------- helpers */
    flash: function (el) {
      if (!el) return;
      el.classList.add('pf-flash');
      setTimeout(function () { el.classList.remove('pf-flash'); }, 1400);
    },

    /* ----------------------------------------------------- internal UI */
    _captionHost: function () {
      var h = document.getElementById('pfc-panel');
      if (!h) { h = document.createElement('div'); h.id = 'pfc-panel'; h.className = 'pfc-panel'; document.body.appendChild(h); }
      return h;
    },
    _renderBadge: function () {
      var b = document.getElementById('pf-badge');
      if (!b) return;
      var n = PFAttacks.log.count();
      var poisoned = PFAttacks.mem.poisoned();
      b.querySelector('[data-pf-count]').textContent = n + ' / ' + TOTAL;
      b.querySelector('[data-pf-bar]').style.width = (n / TOTAL * 100) + '%';
      var mem = b.querySelector('[data-pf-mem]');
      mem.style.display = poisoned ? 'inline-flex' : 'none';
    }
  };

  function hashStr(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; } return h; }

  // global hooks the XSS payloads call from onerror
  window.__pfck = function () { try { return document.cookie || '(none set)'; } catch (e) { return '(blocked)'; } };
  window.__pfx = function (where) { PFAttacks.xssBanner(where); };
  window.PFAttacks = PFAttacks;

  /* --------------------------------------------------------------- styles */
  var CSS =
  // play-button pills placed in the page templates
  '.pf-atk{display:inline-flex;align-items:center;gap:5px;font-family:"JetBrains Mono",ui-monospace,Menlo,monospace;' +
  'font-size:10.5px;font-weight:700;line-height:1;padding:5px 8px;border-radius:7px;cursor:pointer;' +
  'background:#fff;border:1px solid #E5C2Bf;color:#B23B33;white-space:nowrap;transition:all .15s;}' +
  '.pf-atk:hover{background:#FDECEA;border-color:#C2362F;transform:translateY(-1px);}' +
  '.pf-atk::before{content:"\\25B6";font-size:8px;color:#C2362F;}' +
  '.pf-atk.pf-asi{color:#6B3FA0;border-color:#D7C7EA;}.pf-atk.pf-asi::before{color:#6B3FA0;}' +
  '.pf-atk.pf-asi:hover{background:#F3EEFA;border-color:#6B3FA0;}' +
  '.pf-atk-rail{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 10px;}' +
  '.pf-atk-rail .pf-atk-tag{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:9.5px;font-weight:700;' +
  'letter-spacing:.04em;text-transform:uppercase;color:#B0B0AA;margin-right:2px;}' +
  '.pf-flash{outline:2px solid #C2362F!important;outline-offset:3px;border-radius:8px;transition:outline .2s;}' +
  // caption panel
  '.pfc-panel{position:fixed;right:18px;bottom:18px;width:380px;max-width:calc(100vw - 36px);max-height:70vh;overflow:auto;' +
  'background:#fff;border:1px solid #E2E2DE;border-radius:16px;box-shadow:0 24px 60px -20px rgba(0,0,0,.45);' +
  'z-index:2147483000;font-family:"Hanken Grotesk",-apple-system,Helvetica,Arial,sans-serif;opacity:0;transform:translateY(12px);' +
  'pointer-events:none;transition:opacity .25s,transform .25s;}' +
  '.pfc-panel.pfc-show{opacity:1;transform:none;pointer-events:auto;}' +
  '.pfc-head{display:flex;align-items:center;gap:8px;padding:13px 14px;border-bottom:1px solid #EFEFEC;}' +
  '.pfc-code{font-family:"JetBrains Mono",monospace;font-size:11px;font-weight:700;color:#fff;padding:3px 7px;border-radius:6px;}' +
  '.pfc-code.pfc-llm{background:#00474F;}.pfc-code.pfc-agentic{background:#6B3FA0;}' +
  '.pfc-name{font-size:13.5px;font-weight:800;color:#1C1C1A;flex:1;letter-spacing:-.01em;}' +
  '.pfc-sev{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;padding:3px 7px;border-radius:99px;}' +
  '.pfc-sev-critical{background:#FDECEA;color:#C2362F;}.pfc-sev-high{background:#FCEEDD;color:#B0700A;}.pfc-sev-medium{background:#FBF5DA;color:#8a6d00;}' +
  '.pfc-x{border:0;background:none;font-size:19px;line-height:1;color:#9A9A95;cursor:pointer;padding:0 2px;}' +
  '.pfc-x:hover{color:#1C1C1A;}' +
  '.pfc-body{padding:13px 14px;}' +
  '.pfc-p{margin:0 0 9px;font-size:13px;line-height:1.5;color:#2A2A27;}' +
  '.pfc-leak{margin:0 0 10px;background:#3a1714;color:#ffd9d4;border-radius:8px;padding:9px 11px;' +
  'font-family:"JetBrains Mono",monospace;font-size:11px;line-height:1.45;white-space:pre-wrap;word-break:break-word;}' +
  '.pfc-trace{display:flex;flex-direction:column;gap:5px;margin:0 0 10px;}' +
  '.pfc-step{display:flex;align-items:flex-start;gap:8px;font-family:"JetBrains Mono",monospace;font-size:11px;' +
  'color:#3A3A37;background:#F8F8F6;border:1px solid #EFEFEC;border-radius:7px;padding:7px 9px;line-height:1.4;word-break:break-word;}' +
  '.pfc-dot{width:7px;height:7px;border-radius:99px;flex-shrink:0;margin-top:4px;background:#9A9A95;}' +
  '.pfc-ok .pfc-dot{background:#1B7F4B;}.pfc-warn .pfc-dot{background:#E0A106;}.pfc-bad .pfc-dot{background:#C2362F;}' +
  '.pfc-meter{background:#F8F8F6;border:1px solid #EFEFEC;border-radius:9px;padding:9px 11px;margin:0 0 10px;}' +
  '.pfc-meter-row{display:flex;justify-content:space-between;font-family:"JetBrains Mono",monospace;font-size:10.5px;color:#3A3A37;margin-bottom:6px;}' +
  '.pfc-meter-bar{height:8px;border-radius:99px;background:#EFEFEC;overflow:hidden;}' +
  '.pfc-meter-bar > i{display:block;height:100%;width:0;border-radius:99px;background:#00474F;transition:width 1.1s cubic-bezier(.2,.7,.2,1);}' +
  '.pfc-meter-danger .pfc-meter-bar > i{background:#C2362F;}' +
  '.pfc-fix{margin:6px 0 0;font-size:12px;line-height:1.5;color:#1C1C1A;background:#E7F4EC;border:1px solid #c7e6d4;border-radius:9px;padding:9px 11px;}' +
  '.pfc-fix b{color:#1B7F4B;}' +
  // xss banner
  '#pfx-banner{position:fixed;left:0;right:0;top:0;z-index:2147483600;display:flex;justify-content:center;pointer-events:none;' +
  'transform:translateY(-120%);transition:transform .3s;}' +
  '#pfx-banner.pfx-show{transform:none;}' +
  '.pfx-card{pointer-events:auto;margin:12px;max-width:760px;background:#2a1411;color:#ffd9d4;border:1px solid #C2362F;' +
  'border-radius:12px;padding:12px 44px 12px 16px;font-family:"Hanken Grotesk",sans-serif;font-size:13px;line-height:1.5;position:relative;box-shadow:0 18px 50px -16px rgba(0,0,0,.6);}' +
  '.pfx-card b{color:#ff8a80;}.pfx-card code{background:rgba(255,255,255,.12);padding:1px 5px;border-radius:4px;font-size:11.5px;}' +
  '.pfx-note{display:block;margin-top:4px;font-size:11px;color:#e3b3ad;}' +
  '.pfx-card [data-pfx-close]{position:absolute;top:8px;right:10px;border:0;background:none;color:#ffd9d4;font-size:20px;cursor:pointer;line-height:1;}' +
  // demo badge
  '#pf-badge{position:fixed;left:16px;bottom:16px;z-index:2147483000;display:flex;align-items:center;gap:12px;' +
  'background:#1C1C1A;color:#fff;border-radius:13px;padding:10px 14px;font-family:"Hanken Grotesk",sans-serif;' +
  'box-shadow:0 18px 50px -20px rgba(0,0,0,.6);}' +
  '#pf-badge .pf-b-title{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#FFCC00;}' +
  '#pf-badge .pf-b-count{font-size:13px;font-weight:800;}' +
  '#pf-badge .pf-b-track{width:90px;height:6px;border-radius:99px;background:rgba(255,255,255,.18);overflow:hidden;}' +
  '#pf-badge .pf-b-track > i{display:block;height:100%;width:0;background:#FFCC00;border-radius:99px;transition:width .4s;}' +
  '#pf-badge [data-pf-mem]{display:none;align-items:center;gap:5px;font-size:10.5px;font-weight:700;color:#ffb3ad;}' +
  '#pf-badge [data-pf-mem] .pf-b-led{width:8px;height:8px;border-radius:99px;background:#C2362F;animation:pfblink 1.1s infinite;}' +
  '@keyframes pfblink{50%{opacity:.35;}}' +
  '#pf-badge [data-pf-reset]{border:1px solid rgba(255,255,255,.3);background:transparent;color:#fff;border-radius:8px;' +
  'padding:6px 11px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;}' +
  '#pf-badge [data-pf-reset]:hover{background:rgba(255,255,255,.12);}';

  /* ------------------------------------------------------------- bootstrap */
  function injectCSS() {
    if (document.getElementById('pf-atk-css')) return;
    var s = document.createElement('style'); s.id = 'pf-atk-css'; s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }
  function injectBadge() {
    if (document.getElementById('pf-badge')) return;
    var b = document.createElement('div'); b.id = 'pf-badge';
    b.innerHTML =
      '<div><div class="pf-b-title">OWASP attack demo</div>' +
      '<div class="pf-b-count" data-pf-count>0 / ' + TOTAL + '</div></div>' +
      '<div class="pf-b-track"><i data-pf-bar></i></div>' +
      '<span data-pf-mem title="The applicant has poisoned the shared model memory"><span class="pf-b-led"></span>context poisoned</span>' +
      '<button data-pf-reset>Reset demo</button>';
    document.body.appendChild(b);
    b.querySelector('[data-pf-reset]').addEventListener('click', function () { PFAttacks.reset(); });
    PFAttacks._renderBadge();
  }
  // global delegated close handlers
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-pfc-close]')) PFAttacks.closeCaption();
    if (e.target.closest && e.target.closest('[data-pfx-close]')) { var b = document.getElementById('pfx-banner'); if (b) b.className = ''; }
  });

  function boot() {
    injectCSS(); injectBadge();
    try { if (!document.cookie) document.cookie = 'session=pf_8f3a7c21b4e8d6; path=/'; } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
