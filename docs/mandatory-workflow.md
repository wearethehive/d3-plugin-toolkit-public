# Mandatory Workflow for Designer API Changes

This document is load-bearing. Every item exists because ignoring it caused a production incident.

## The Three Rules

### Rule 1: Knowledge Base First — No Exceptions

Before writing ANY Python that touches a Designer API:

1. `grep` the knowledge base patterns/ and bugs/ directories for the API you're about to use
2. `grep` the reference-tools/ directory for local probes that validate the behavior
3. Read the matching KB entries IN FULL — not just the grep hit line

If you find a proven pattern, USE IT EXACTLY. Do not adapt, simplify, or "improve" it.

If you find nothing, you do NOT have permission to guess. Go to Rule 2.

### Rule 2: Probe Before Implementing

When the knowledge base has no pattern for what you need:

1. Write a standalone Python probe script in `reference-tools/`
2. The probe MUST run against the actual Designer instance
3. The probe MUST test the exact operation you need (not a similar one)
4. The probe MUST include cleanup (remove test resources)
5. The probe MUST run through the SAME execution context as the plugin (registered module, not anonymous)
6. Save the probe results to the knowledge base BEFORE implementing

NEVER deploy code to the plugin that uses an API path you haven't probed.

### Rule 3: Never Deploy Destructive Operations Without Isolated Probing

Before calling any API that modifies or deletes resources:

1. Probe on a SINGLE test resource first
2. Verify the result
3. Verify the resource can be restored if the operation fails
4. Only then implement in the plugin

Operations that have caused incidents:
- `track.cues.clear()` — destroys timeline structure, unrecoverable
- `except Exception` — does NOT catch all d3 errors, use bare `except:`
- `layer.module.mapping = proj` — appears to work but does not persist
- `track.save()` per layer at scale — causes timeout

## Mapping Assignment (Confirmed Pattern)

```python
# CORRECT — persists and renders
proj = resourceManager.load(mapping_path)
map_field = layer.findSequence("mapping")
map_field.sequence.setResource(layer.tStart, proj)
map_field.notifyEdit()

# WRONG — appears to work, does not persist
layer.module.mapping = proj
```

## Cue Removal (Confirmed Pattern)

```python
# CORRECT — removes cue entry fully
track.cues.removeAtTime(beat)

# DANGEROUS — destroys timeline
track.cues.clear()
```

## Exception Handling (Confirmed Pattern)

```python
# CORRECT — catches all d3 errors
try:
    d3.someAPI()
except:
    pass

# WRONG — misses d3 internal errors
try:
    d3.someAPI()
except Exception:
    pass
```

## Batch Size Limits

- Layer creation: max 20 per API call
- Cue creation (splitSectionAtBeat): max 10 per API call
- Cue removal (removeAtTime): max 10 per API call
- Always include progress feedback between batches
