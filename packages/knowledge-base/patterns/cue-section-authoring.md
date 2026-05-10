---
type: pattern
status: observed
tested: "2026-05-03"
api_coverage:
  - name: "splitSectionAtBeat"
    match: "\\.splitSectionAtBeat\\s*\\("
    related_files: ["cue-section-authoring.md"]
    required: false
  - name: "setTagAtBeat"
    match: "\\.setTagAtBeat\\s*\\("
    related_files: ["cue-section-authoring.md"]
    required: false
---

# Cue and Section Authoring

## Create a Cue Section

`track.cues` is a `TimeSequence`; do not look for a `.create()` method. Create
cue sections with `splitSectionAtBeat`.

```python
track = guisystem.track
beat = track.timeToBeat(seconds)

track.splitSectionAtBeat(beat)
track.setTagAtBeat(beat, Tag(Tag.CUE, cue_number))
track.setNoteAtBeat(beat, note_text)

cue = track.cueAtBeat(beat)
```

Use `track.timeToBeat(seconds)` and `track.beatToTime(beat)` for conversion.
Do not assume beats equal seconds outside default 60 BPM projects.

## Reading Cue Metadata

For a full cue/section listing, iterate the cue `TimeSequence` by index:

- `track.cues.n()` gives the count.
- `track.cues.getT(index)` gives the beat.
- `track.cues.getV(index)` gives the cue object.
- `cue.isSection()` distinguishes section markers.

Tag slots observed in Designer cue records:

| Slot | Meaning |
|---|---|
| `0` | timecode tag |
| `1` | cue tag |
| `2` | MIDI tag |

Use `guisystem.currentTransportManager.smpteClockType()` with
`track.beatToGlobalTime(beat, clock_type, False)` and
`Timecode(...).asString(False)` when displaying track timecode for a cue.

## Bookended Cue Layout

For content blocks that should hold their last frame in Play Section mode:

1. Create a named/tagged section at the cue start.
2. Place layers inside that section.
3. Create a plain section at the block end.

The ending section does not need a tag or note; it acts as the hold boundary.

## Related

- `timeline-export-cues.md` covers reading cue tags, notes, and sections.
- `cue-removal.md` covers safe cue/section removal.

