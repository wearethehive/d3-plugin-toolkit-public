---
type: pattern
status: confirmed
tested: "2026-05-15"
api_coverage:
  - name: "insertAudioBeats"
    match: "\\.insertAudioBeats\\s*\\("
    related_files: ["insert-audio-beats-section-extension.md"]
    required: false
  - name: "SuperTrack.MoveLayers"
    match: "SuperTrack\\.MoveLayers|\\.MoveLayers"
    related_files: ["insert-audio-beats-section-extension.md"]
    required: false
---

# Section Extension via insertAudioBeats

## Purpose

Use `track.insertAudioBeats(iBeat, nBeats, d3.SuperTrack.MoveLayers)` to extend
a pre-split cue section while keeping the timeline structure aligned.

This matches the SmartGroups package-build need: if a look's longest media file
exceeds the currently allocated section length, insert time at the existing
section end so later cues, notes, section breaks, layers, and audio sections move
later.

## Confirmed Behavior

Probe:
`packages/knowledge-base/reference-tools/probe_insert_audio_beats_section_extension.py`

Run:

```bash
node packages/cli/dist/index.js exec --file packages/knowledge-base/reference-tools/probe_insert_audio_beats_section_extension.py
```

In a disposable track with 15-beat sections at `15`, `30`, `45`, and `60`,
calling:

```python
track.insertAudioBeats(30.0, 15.0, d3.SuperTrack.MoveLayers)
```

confirmed:

- Track length increased by 15 beats.
- The section/note at the insertion beat moved from `30` to `45`.
- Later section/note cues moved from `45` to `60` and `60` to `75`.
- A layer before the insertion beat stayed at the same start beat.
- Layers at or after the insertion beat moved forward by 15 beats.
- The disposable probe track was removed successfully with
  `resourceManager.remove(PROBE_PATH)`.

## Implementation Pattern

```python
try:
    affect = int(d3.SuperTrack.MoveLayers)
except:
    affect = 1

track.insertAudioBeats(section_end_beat, beats_to_add, affect)
```

Use this at the existing section end, not at the content start. For a package
build flow, process packages in chronological order and re-resolve cue positions
after each insertion because every insert shifts downstream beats.

## Notes

- Do not use `insertBlank` for this workflow. The stub says it does not affect
  cues or audio sections.
- `insertBeats` affects cues/layers, but the user workflow needs audio sections
  preserved too; `insertAudioBeats` is the confirmed fit.
- Do not shrink sections. Only insert when required media duration exceeds the
  current allocated section length.
- Avoid using fresh `track.beatToTime()` / `track.timeToBeat()` reads as control
  values immediately after `insertAudioBeats()` in the same Python execution.
  A live active-track probe extended a 15-second section to 30 seconds correctly,
  but one immediate same-execution `beatToTime()` delta reported a negative
  value. A follow-up read-only probe returned correct monotonic times.
- For SmartGroups-style package builds, compute the target section in beats from
  `sectionLengthBeats()` plus duration-to-beat conversion before inserting time,
  then set generated layers to the resulting section end. This keeps short media
  in a 15-second cue as 15-second layers and rounds longer media to 30/45/etc.
