#!/usr/bin/env node
/* Coverage + integrity check for the OWASP attack demos.
   Run: node src/verify-attacks.js   (from repo root or src/)
   Asserts, for every page: JS parses, attacks.js is loaded, and every pf-atk
   button's handler is actually returned by renderVals(). Aggregates code
   coverage (LLM01-10 + ASI01-10 + CACHE) and checks the applicant->HR wiring. */
const fs = require('fs');
const path = require('path');
const DIR = __dirname.endsWith('src') ? __dirname : path.join(__dirname, 'src');

const PAGES = [
  'Application Assistant.dc.html', 'CV Upload.dc.html', 'RAG Search.dc.html',
  'Recruiting Assistant.dc.html', 'Candidate Summary.dc.html',
];
const EXPECTED = [];
for (let i = 1; i <= 10; i++) EXPECTED.push('LLM' + String(i).padStart(2, '0'));
for (let i = 1; i <= 10; i++) EXPECTED.push('ASI' + String(i).padStart(2, '0'));
EXPECTED.push('CACHE');

function stubs() {
  const noop = () => {};
  return {
    PFAttacks: {
      caption: noop, closeCaption: noop, flash: noop, renderUnsafe: noop,
      xssPayload: () => '', reset: noop,
      mem: { get: noop, set: noop, all: () => ({}), poisoned: () => false },
      cache: { get: () => null, set: noop, has: () => false },
      log: { mark: noop, count: () => 0, all: () => [] },
    },
    __pfx: noop, setInterval: noop, clearInterval: noop, setTimeout: noop, clearTimeout: noop,
    requestAnimationFrame: noop, Date: { now: () => 0 }, console,
  };
}

let fail = 0;
const coverage = {};
const wiring = { writers: [], readers: [], cacheKeys: new Set() };

for (const file of PAGES) {
  const full = path.join(DIR, file);
  const html = fs.readFileSync(full, 'utf8');
  const problems = [];

  if (!html.includes('./attacks.js')) problems.push('attacks.js not loaded in <head>');

  const m = html.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/);
  if (!m) { console.log('✗ ' + file + ': no data-dc-script block'); fail++; continue; }
  const script = m[1];

  // buttons + their handler + OWASP code
  const buttons = [];
  const btnRe = /<button[^>]*class="pf-atk[^"]*"[^>]*>[\s\S]*?<\/button>/g;
  let bm;
  while ((bm = btnRe.exec(html)) !== null) {
    const tag = bm[0];
    const h = tag.match(/onClick="\{\{\s*(\w+)\s*\}\}"/);
    const c = tag.match(/(LLM\d{2}|ASI\d{2}|CACHE)/);
    if (h && c) { buttons.push({ handler: h[1], code: c[1] }); coverage[c[1]] = (coverage[c[1]] || 0) + 1; }
    else problems.push('pf-atk button missing handler or code: ' + tag.replace(/\s+/g, ' ').slice(0, 70));
  }

  // execute renderVals() in a stubbed sandbox to get the real returned keys
  let returnedKeys = [];
  try {
    const s = stubs();
    const runner = new Function(...Object.keys(s),
      'class DCLogic{ setState(){} }\n' + script + '\nreturn new Component().renderVals();');
    const vals = runner(...Object.values(s));
    returnedKeys = Object.keys(vals || {});
  } catch (e) {
    problems.push('renderVals() failed to execute: ' + e.message);
  }

  for (const b of buttons) {
    if (!new RegExp('\\b' + b.handler + '\\s*=').test(script)) problems.push(b.code + ' handler ' + b.handler + ' not defined');
    if (returnedKeys.length && returnedKeys.indexOf(b.handler) < 0) problems.push(b.code + ' handler ' + b.handler + ' not returned by renderVals()');
  }

  // wiring
  if (/PFAttacks\.mem\.set\(\s*['"]candidate_override['"]/.test(script)) wiring.writers.push(file);
  if (/PFAttacks\.mem\.get\(\s*['"]candidate_override['"]/.test(script)) wiring.readers.push(file);
  const ck = script.match(/PFAttacks\.cache\.(?:set|get|has)\(\s*['"]([^'"]+)['"]/g) || [];
  ck.forEach(x => wiring.cacheKeys.add(x.match(/['"]([^'"]+)['"]/)[1]));

  if (problems.length) { fail += problems.length; console.log('✗ ' + file); problems.forEach(p => console.log('    - ' + p)); }
  else console.log('✓ ' + file + '  (' + buttons.length + ' buttons: ' + buttons.map(b => b.code).join(', ') + ')');
}

console.log('\n=== coverage (LLM01-10 + ASI01-10 + CACHE) ===');
const missing = EXPECTED.filter(c => !coverage[c]);
console.log(EXPECTED.map(c => c + '×' + (coverage[c] || 0)).join('  '));
if (missing.length) { console.log('✗ MISSING: ' + missing.join(', ')); fail += missing.length; }
else console.log('✓ all ' + EXPECTED.length + ' codes covered');

console.log('\n=== applicant → HR chain ===');
console.log('writers (set candidate_override): ' + wiring.writers.join(', '));
console.log('readers (get candidate_override): ' + wiring.readers.join(', '));
console.log('cache keys: ' + [...wiring.cacheKeys].join(', '));
if (!wiring.writers.length) { console.log('✗ no writer'); fail++; }
if (!wiring.readers.length) { console.log('✗ no reader'); fail++; }
if (wiring.cacheKeys.size > 1) { console.log('✗ inconsistent cache keys'); fail++; }

console.log('\n' + (fail ? '✗ ' + fail + ' problem(s)' : '✓ ALL CHECKS PASSED'));
process.exit(fail ? 1 : 0);
