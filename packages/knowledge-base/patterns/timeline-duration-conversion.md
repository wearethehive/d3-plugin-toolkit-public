---
type: pattern
status: confirmed
tested: "2026-05-16"
api_coverage:
  - name: "Track beat/time conversion"
    match: "\\.beatToTime\\s*\\(|\\.timeToBeat\\s*\\("
    related_files: ["timeline-duration-conversion.md", "insert-audio-beats-section-extension.md"]
    required: false
  - name: "VideoClip duration metadata"
    match: "\\.fileNFrames|\\.fileFps|\\.fps|\\.speed"
    related_files: ["timeline-duration-conversion.md"]
    required: false
---

# Timeline Duration Conversion

## Rule

Use track conversion methods for layer and section beat extents:

```python
start_seconds = float(track.beatToTime(float(start_beat)))
end_beat = float(track.timeToBeat(start_seconds + float(duration_seconds)))
duration_beats = end_beat - float(start_beat)
```

Do not assume seconds and beats are equivalent outside known 60 BPM contexts.
When a conversion method fails, BPM fallback is acceptable for preview or
planning code:

```python
duration_beats = duration_seconds * bpm / 60.0
duration_seconds = duration_beats * 60.0 / bpm
```

## Clip Duration Source

Use the clip's media metadata for media duration:

```python
seconds = float(clip.fileNFrames) / float(clip.fileFps)
try:
    speed = float(clip.speed)
    if speed > 0:
        seconds = seconds / speed
except:
    pass
```

If `fileFps` is unavailable, `clip.fps` is a usable fallback.

## Probe

`packages/knowledge-base/reference-tools/probe_timeline_timing_context.py`
confirmed on Designer r32.4.3 that the active track round-tripped 15 and 60
second samples through `beatToTime()` / `timeToBeat()`.

`packages/knowledge-base/reference-tools/probe_smartgroups_testcontent_sequence.py`
confirmed SmartGroups-style media placement using clip metadata for generated
layer lengths.

## SmartGroups Impact

SmartGroups should compute package section extension in beats, using clip
duration from `VideoClip.fileNFrames/fileFps` and the active track's
`beatToTime()` / `timeToBeat()` conversion for timeline extents. This keeps
planning correct when the project is not operating at one beat per second.
