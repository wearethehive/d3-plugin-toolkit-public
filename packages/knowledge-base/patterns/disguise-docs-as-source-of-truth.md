---
type: pattern
status: confirmed
tested: "2026-04-08"
---

# Disguise Documentation Is the Source of Truth, NOT d3.pyi

## The rule

Before forming any hypothesis about what's possible with a Disguise
primitive, read the relevant guide page at `https://developer.disguise.one`.
`d3.pyi` shows every method on every C++ class regardless of whether it's
intended for Python use; the docs show the *intended* surface for plugin
developers.

Treat `d3.pyi` as a **type-signature reference for things you have already
confirmed are intended for plugin use** — not as a catalogue of available
APIs. The stub is generated from C++ reflection and exposes huge amounts
of surface that is internal-only. Methods present in `d3.pyi` may:

- Fail with non-Exception errors when called from Python (see
  [c++-binding-non-exception-failures.md](c++-binding-non-exception-failures.md))
- Appear to succeed on setattr while silently discarding the write (see
  [python-attribute-assignment-is-permissive.md](python-attribute-assignment-is-permissive.md))
- Expose "looks-like" APIs that are actually test harnesses, loopback
  stubs, or developer tooling for the Disguise engineers themselves

## Why this matters

The concrete cost of getting this wrong on this project was multiple full
sessions of dead-end investigation, ~10 architectures probed and
eliminated, and user time spent correcting the agent. Reading one guide
page at the start of the investigation would have eliminated most of the
false trails in minutes.

Every hour an agent spends probing `d3.pyi` methods that aren't documented
is an hour that could have been spent reading the one paragraph in the
official guide that says "don't do that, use this instead." **The doc
site is smaller and more authoritative than the stub.**

## How to access Disguise docs from an agent

`WebFetch` fails on Disguise's docs site because the page chrome is
JS-rendered and only the navigation menu comes back in the server-rendered
HTML. Use `curl` directly and extract the `<article>` tag:

```bash
curl -sL https://developer.disguise.one/python-api/guides/devices -o devices.html
python -c "
import re, html
with open('devices.html', encoding='utf-8') as f:
    content = f.read()
art = re.search(r'<article[^>]*>(.*?)</article>', content, re.DOTALL)
body = art.group(1) if art else content
body = re.sub(r'<script[^>]*>.*?</script>', '', body, flags=re.DOTALL)
body = re.sub(r'<style[^>]*>.*?</style>', '', body, flags=re.DOTALL)
body = re.sub(r'</(p|div|h[1-6]|li|tr|pre|code|table)>', r'</\g<1>>\n', body, flags=re.IGNORECASE)
body = re.sub(r'<[^>]+>', '', body)
body = html.unescape(body)
print(body)
"
```

The `<article>` tag wraps the actual content; everything else on the page
is navigation chrome.

## The doc index

`https://developer.disguise.one/llms.txt` is a flat-text index of every
documentation URL. Fetch it first when you need to navigate:

```bash
curl -sL https://developer.disguise.one/llms.txt
```

This returns a markdown-formatted list of every page with URL and one-line
description. Use it to find the right guide page rather than guessing URLs.

## Key reference URLs

- **Python API guides** (authoritative, intended plugin surface):
  - `https://developer.disguise.one/python-api/guides/audio`
  - `https://developer.disguise.one/python-api/guides/calibration`
  - `https://developer.disguise.one/python-api/guides/d3net`
  - `https://developer.disguise.one/python-api/guides/devices`
  - `https://developer.disguise.one/python-api/guides/expressions`
  - `https://developer.disguise.one/python-api/guides/feed`
  - `https://developer.disguise.one/python-api/guides/resources`
  - `https://developer.disguise.one/python-api/guides/stage`
  - `https://developer.disguise.one/python-api/guides/track-and-sequencing`
  - `https://developer.disguise.one/python-api/guides/transports`
  - `https://developer.disguise.one/python-api/guides/utility`
  - `https://developer.disguise.one/python-api/guides/video-input`
- **API changelog** across Designer versions:
  `https://developer.disguise.one/python-api/api-changes`
- **Useful snippets** (copy-paste idioms the docs team maintains):
  `https://developer.disguise.one/python-api/useful-strings`
- **Plugin docs**:
  - `https://developer.disguise.one/plugins/introduction`
  - `https://developer.disguise.one/plugins/getting-started`
  - `https://developer.disguise.one/plugins/architecture`
  - `https://developer.disguise.one/plugins/configuration`
  - `https://developer.disguise.one/plugins/distribution`
  - `https://developer.disguise.one/plugins/useful-links`
- **OpenAPI specs** for the REST surface:
  - `https://developer.disguise.one/specs/service.swagger.json`
  - `https://developer.disguise.one/specs/session.swagger.json`
- **d3.pyi stub** (latest, type signatures only — NOT a capability list):
  `https://developer.disguise.one/assets/d3.pyi`

## Failure modes from getting this wrong

Two concrete cases from this investigation where treating `d3.pyi` as
ground truth led to dead-end probes:

1. **OscTester investigation.** `d3.pyi` shows `OscTester` has
   `oscDevice`, `receiveAddress`, `receiveBuffer`, `clearReceiveBuffer` —
   every signal of an OSC *receive* consumer. The actual class is a
   developer test-message *sender* with a loopback echo display. The
   Disguise UI even labels it accordingly. Reading the Devices guide first
   would have cost zero time. Investigating from `d3.pyi` cost hours of
   probe scripts plus the user's time correcting the agent's hypothesis.

2. **`MetaField.get()` and `d3.Expression.evaluateFromString`
   investigation.** Both methods exist in `d3.pyi` and look like
   live-value APIs — the names, the signatures, the class locations all
   suggest runtime value readers. Both fail with non-Exception errors
   when called from Python because they're internal C++ methods exposed
   by reflection but not designed for plugin invocation. The Expressions
   guide and the Resources guide document neither as plugin-facing. See
   [c++-binding-non-exception-failures.md](c++-binding-non-exception-failures.md)
   for the full probe results.

In both cases the correct answer was one guide page away. In both cases
the agent probed first and read second.

## Related

- [c++-binding-non-exception-failures.md](c++-binding-non-exception-failures.md)
- [python-attribute-assignment-is-permissive.md](python-attribute-assignment-is-permissive.md)
- [sandbox-stdlib.md](sandbox-stdlib.md)

## CLAUDE.md candidate

This pattern should be added as a mandatory pre-flight rule in `CLAUDE.md`:
"Before forming any hypothesis about a Disguise primitive, read the
relevant guide at `https://developer.disguise.one`. `d3.pyi` is a type
reference, not a capability list." The orchestrator will surface this to
the user in pass 3.
