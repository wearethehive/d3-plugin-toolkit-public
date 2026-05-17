---
type: pattern
status: candidate
tested: "2026-04-24"
caveat: >
  This recipe is assembled from two independently-confirmed patterns but the
  combined track-wipe has only been type-checked and built — not yet confirmed
  end-to-end against a live Designer run at time of entry. Promote to
  `status: confirmed` once a probe / real rebuild flow completes cleanly.
api_coverage:
  - name: "track-wipe composite"
    match: "track\\.cueBeats\\s*\\("
    related_files: ["track-wipe.md", "cue-removal.md", "safe-iteration.md"]
    required: false
---

# Track Wipe (Layers + Cues, Preserving Beat 0)

## What It Does

Clears a `Track` completely so a fresh import can rebuild from scratch:

1. Removes every layer (reverse-index iteration — `safe-iteration.md`)
2. Removes every cue entry and section split **except at beat 0**
   (`cue-removal.md` — `track.cues.clear()` is forbidden, and beat 0 is the
   timeline's structural root)
3. Optionally resets the note at beat 0 so stale content does not bleed into
   the rebuild

The result is a track with `len(track.layers) == 0` and exactly one cue
entry at beat 0 with empty note/tag. The track is still renderable.

## When To Use

- Rebuild-from-sheet / rebuild-from-JSON flows where the user wants a clean
  slate before import writes new content.
- After a corrupted import where manual cleanup in Designer would be
  error-prone.

**Do not use** for partial edits. A wipe destroys all existing work on the track.

## Primitives It Composes

| Step | Pattern | Why |
|------|---------|-----|
| Layer loop | `patterns/safe-iteration.md` | d3 collections require index iteration |
| Reverse index | `patterns/safe-iteration.md` | Removal shifts indices — walk high-to-low |
| Cue removal | `patterns/cue-removal.md` | `cues.clear()` destroys structure — use `removeAtTime` |
| Section merge | `patterns/cue-removal.md` | `mergeSectionAtBeat` before `removeAtTime` fully detaches the split |
| Beat-0 preserved | `patterns/cue-removal.md` | Beat 0 is the timeline root — removing it breaks rendering |

## Recipe

```python
import d3

track = guisystem.track

# --- Step 1: clear layers (reverse index iteration) ---
n = len(track.layers)
for i in range(n - 1, -1, -1):
    try:
        layer = track.layers[i]
        track.removeLayer(layer)
    except:
        pass

# --- Step 2: clear cues + sections, preserving beat 0 ---
beats = list(track.cueBeats())
for beat in sorted([float(b) for b in beats], reverse=True):
    if beat <= 0:
        continue  # NEVER remove beat 0 — it's structural
    try:
        track.mergeSectionAtBeat(beat)
    except:
        pass
    try:
        track.cues.removeAtTime(beat)
    except:
        pass

# --- Step 3 (optional): clear beat-0 note so rebuilds don't inherit stale text ---
try:
    track.setNoteAtBeat(0.0, "")
except:
    pass

track.save()
```

## Beat-0 Preservation — Why

`track.cues.clear()` and `track.cues.removeAtTime(0.0)` both remove the
beat-0 cue entry. The beat-0 entry is the timeline's structural root —
without it, Designer stops rendering the track and the timeline cannot be
recovered in the UI. If accidentally destroyed, restore with:

```python
track.splitSectionAtBeat(0)
track.save()
```

See `patterns/cue-removal.md` § "DANGER" for the full story.

## Outstanding Uncertainties

- The recipe has been type-checked and the plugin builds, but the composed
  wipe has **not been end-to-end-run against a live Designer** as of this
  entry date. Both primitives are independently confirmed; the composition
  is the unverified piece.
- `markDirty(track)` is called before each step in some implementations — unclear
  whether it is strictly required for the wipe to persist, or only defensive.
  A probe could compare `save()`-only vs `markDirty() + save()` persistence.

## Related

- `patterns/safe-iteration.md`
- `patterns/cue-removal.md`
- `bugs/phantom-method-invented-from-plausibility.md` — the incident that
  motivated writing this composite pattern down
