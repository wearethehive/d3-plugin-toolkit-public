---
type: pattern
status: confirmed
tested: "2026-05-16"
designer_version: "r32.4.3.247061"
api_coverage:
  - name: "VariableVideoModule layer creation"
    match: "addNewLayer\\s*\\(\\s*d3\\.VariableVideoModule"
    related_files: ["smartgroups-sequential-media-build.md", "video-layer-placement.md"]
    required: false
  - name: "Video sequence assignment"
    match: "findSequence\\s*\\(\\s*['\"]video['\"]\\s*\\)|setResource\\s*\\("
    related_files: ["smartgroups-sequential-media-build.md", "video-layer-placement.md"]
    required: false
  - name: "Section splitting and notes"
    match: "splitSectionAtBeat\\s*\\(|setNoteAtBeat\\s*\\("
    related_files: ["smartgroups-sequential-media-build.md", "cue-section-authoring.md"]
    required: false
---

# SmartGroups Sequential Media Build

## Rule

For SmartGroups-style acid tests and package-build diagnostics, a focused probe
can build a sequence of video layers from `VideoClip` resources and validate
the resulting timeline without going through the plugin UI.

Confirmed sequence:

```python
layer = track.addNewLayer(d3.VariableVideoModule, start_beat, length_beats, name)
video_fseq = layer.findSequence("video")
seq = video_fseq.sequence if hasattr(video_fseq, "sequence") else video_fseq
seq.setResource(start_beat, clip)
track.splitSectionAtBeat(start_beat)
track.setNoteAtBeat(start_beat, note)
track.splitSectionAtBeat(end_beat)
```

After creation, read back:

- layer `tStart` and `tLength`
- section start/end beats
- cue/section note text
- video sequence resource path

## Probe

`packages/knowledge-base/reference-tools/probe_smartgroups_testcontent_sequence.py`
confirmed this on Designer r32.4.3.247061 in project `audioprobe`.

The probe created five layers from `objects/videoclip/testcontent`, created
matching section boundaries/notes, and verified every generated layer and video
sequence readback matched the planned clip duration/resource.

## Use

Use this as a diagnostic or regression probe when SmartGroups package build
behavior changes. It is a mutating active-track probe, so run it only in a
disposable or intentionally prepared Designer session.
