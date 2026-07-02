# COP AI — OWASP LLM & Agentic Attack Playground

A **deliberately‑insecure** "Careers" hiring app used as a live demo of the
**OWASP Top 10 for LLM Applications (2025)** and the **OWASP Top 10 for Agentic Applications (2026)**.

Every page carries small red **▶ play buttons** next to the exact UI component an attack targets. Click one
and the attack happens **on the real UI** — an injected chat turn, a hijacked RAG answer, a real `alert()` from
unsanitised output, a score that flips from 96 → 99 — each with a caption explaining what happened and the fix.

> ⚠️ **Safety:** this is a training/demo artifact. No real models, tools, or code run. XSS payloads are
> contained (a JavaScript `alert()` + banner, nothing is exfiltrated) and all credentials are obvious fakes.

## Run it

Open **[`src/index.html`](src/index.html)** in a browser (no build step) and click the ▶ buttons.
Switch between the **Applicant** and **HR employee** roles with the toggle in the header.

## Headline demo — cross‑role context poisoning

The applicant and the HR hiring manager share one model and one memory:

1. **Applicant** clicks *ASI06 · Poison shared context* (in the chatbot **or** via CV upload).
2. Switch to the **HR employee** role.
3. Open **Candidate Summary** → *ASI06 · See poisoned scoring*: the score jumps **96 → 99**, the watch‑outs
   vanish, and the recommendation flips to *hire* — driven entirely by the applicant's injected text.
4. **Cache poisoning** makes it sticky across reloads. **Reset demo** (badge, bottom‑left) clears everything.

## Coverage — 21 demos

| OWASP set | Codes |
|---|---|
| LLM Applications 2025 | LLM01–LLM10 |
| Agentic Applications 2026 | ASI01–ASI10 |
| Bonus | Cache Poisoning |

`node src/verify-attacks.js` re‑checks that every code has a play button, that each handler is wired, and that
the applicant→HR chain is consistent.

## Layout

| Path | What |
|---|---|
| [`src/`](src/) | The instrumented handoff app — 5 pages + `attacks.js` (shared attack engine) + `index.html` launcher |
| [`presentation/`](presentation/) | `owasp-juice-shop.html` (scoreboard view) · `adversial.html` (adversarial simulator) |
| [`specs/`](specs/) | Attack catalog, per‑component injection plan, and the original Claude Design handoff bundle |
| [`docs/`](docs/) | Slide deck |

## Sources

- OWASP Top 10 for LLM Applications (2025) — <https://genai.owasp.org/llm-top-10/>
- OWASP Top 10 for Agentic Applications (2026) — <https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/>

---

Built with [Claude Code](https://claude.com/claude-code).
