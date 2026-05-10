---
type: pattern
status: confirmed
tested: "2026-04-04"
crashers:
  - pattern: "\\.cues\\.clear\\s*\\("
    message: "track.cues.clear() destroys the timeline structure and is unrecoverable. Use track.cues.removeAtTime(beat) for individual cues. See patterns/cue-removal.md"
    severity: crash
api_coverage:
  - name: "cues.removeAtTime"
    match: "\\.cues\\.removeAtTime\\s*\\("
    related_files: ["cue-removal.md"]
    required: false
  - name: "mergeSectionAtBeat"
    match: "\\.mergeSectionAtBeat\\s*\\("
    related_files: ["cue-removal.md"]
    required: false
---

# Cue and Section Removal

## Removing Individual Cues

Use `track.cues.removeAtTime(beat)` to fully remove a cue entry (including notes and tags):

```python
track.cues.removeAtTime(500.0)  # removes the cue at beat 500
track.save()
```

## Removing Sections with Cues

To fully remove a section split and its associated cue/notes/tags:

```python
# Step 1: merge the section marker
track.mergeSectionAtBeat(beat)
# Step 2: remove the cue entry (with notes and tags)
track.cues.removeAtTime(beat)
```

## Bulk Cleanup (all cues after beat 0)

Iterate in reverse to avoid index shifting:

```python
cue_beats = list(track.cueBeats())
cue_beats.sort(reverse=True)
for beat in cue_beats:
    if beat > 0:
        try:
            track.mergeSectionAtBeat(float(beat))
        except:
            pass
        try:
            track.cues.removeAtTime(float(beat))
        except:
            pass
track.save()
```

## DANGER: Never use `track.cues.clear()`

`track.cues.clear()` removes ALL cue entries including the beat-0 section, which **destroys the timeline structure** and causes Designer to stop rendering. If accidentally called, restore with:

```python
track.splitSectionAtBeat(0)
track.save()
```

## Methods That Do NOT Fully Remove Cues

- `track.mergeSectionAtBeat(beat)` — removes section marker only, leaves cue entry with notes/tags
- `cue.setNote('')` — clears note text but cue entry remains
- `cue.removeTag(...)` — crashes with bare except regardless of argument type
- `cue.setTag(Tag(Tag.CUE, ''))` — sets tag text to empty but tag still exists

## TimeSequence Methods Available

| Method | Purpose |
|--------|---------|
| `cues.removeAtTime(beat)` | Remove entry at exact beat position |
| `cues.removeIndex(idx)` | Remove entry by index |
| `cues.n()` | Count entries |
| `cues.getT(idx)` | Get beat at index |
| `cues.getV(idx)` | Get Cue object at index |
| `cues.clear()` | **DANGER** — removes all entries, breaks timeline |
