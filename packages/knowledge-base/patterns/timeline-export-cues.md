---
type: pattern
status: confirmed
tested: "2026-03-25"
api_coverage:
  - name: "splitSectionAtBeat"
    match: "\\.splitSectionAtBeat\\s*\\("
    related_files: ["timeline-export-cues.md", "cue-removal.md"]
    required: false
---

# Timeline Export: Cue/Section/Tag Access Patterns

## Accessing Cues

```python
track = guisystem.track

# Get all cue beat positions
cue_beats = track.cueBeats()  # returns d3.Array<double>
for bi in range(len(cue_beats)):
    beat = float(cue_beats[bi])

    # Get the cue object at this beat
    cue = track.cueAtBeat(beat)
    is_section = cue.isSection()  # bool
    has_note = cue.hasNote()      # bool
    note = cue.getNote()          # str (empty string if no note)
    has_tags = cue.hasTags()      # bool

    # Read tags
    if has_tags:
        tags = cue.getTags()
        for ti in range(len(tags)):
            tag = tags[ti]
            tag_type = int(tag.type)  # 0=TC, 1=CUE, 2=MIDI
            tag_text = str(tag.text)  # e.g. "1.1.1" or "2:0:0:0"
```

## Accessing Sections

```python
ns = track.nSections()
for i in range(ns):
    beat = float(track.sectionToBeat(i))
    length = float(track.sectionLengthBeats(i))
    note = track.noteAtBeat(beat)  # section note (or None)

    # Transition info
    ti = track.transitionInfoAtBeat(beat)
    duration = float(ti.durationBeats)
```

## Tag Type Constants

| Value | Name | Example |
|-------|------|---------|
| 0 | Timecode | "2:0:0:0" |
| 1 | Cue | "1.1.1" |
| 2 | MIDI | MIDI note text |

## Key Observations

- Cues are a superset of sections (a section is a cue with `isSection()=True`)
- Not all cues are sections — some are tag-only or note-only
- `track.cues` is a `TimeSequence[Cue]` but `getV(i)` returns object repr, not useful
- Use `track.cueAtBeat(beat)` + methods, not the TimeSequence directly
- Notes and tags are per-cue, not per-section (a non-section cue can have tags)
