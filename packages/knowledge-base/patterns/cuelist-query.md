---
type: pattern
status: observed
tested: "2026-04-19"
api_coverage:
  - name: "section layer membership"
    match: "sectionToBeat\\s*\\(|sectionLengthBeats\\s*\\(|getSequencedValue\\s*\\("
    related_files: ["cuelist-query.md", "timeline-export-cues.md"]
    required: false
  - name: "d3.Timecode display string"
    match: "d3\\.Timecode\\s*\\("
    related_files: ["cuelist-query.md", "timeline-export-cues.md"]
    required: false
---

# Cuelist Query

## Purpose

Build a cuelist view that combines sections, cue notes/tags, timecode
strings, and the layers that start inside each section.

This extends the confirmed cue access in
[timeline-export-cues.md](timeline-export-cues.md) with a UI grouping rule:
layers belong to the section where their `tStart` falls.

## Track and Section Walk

```python
import d3

track = resourceManager.load(str(track_path), d3.Track)
clock_type = guisystem.currentTransportManager.smpteClockType()

sections = []
section_count = int(track.nSections())
for index in range(section_count):
    beat = float(track.sectionToBeat(index))
    length = float(track.sectionLengthBeats(index))
    cue = track.cueAtBeat(beat)

    note = ""
    if cue is not None and cue.hasNote():
        note = str(cue.getNote())

    cue_tags = []
    if cue is not None and cue.hasTags():
        tags = cue.getTags()
        for tag_index in range(len(tags)):
            tag = tags[tag_index]
            cue_tags.append({
                "type": int(tag.type),  # 0=TC, 1=CUE, 2=MIDI
                "text": str(tag.text),
            })

    global_time = track.beatToGlobalTime(beat, clock_type, False)
    tc = str(d3.Timecode(global_time, clock_type).asString(False))

    sections.append({
        "index": index,
        "beat": beat,
        "length": length,
        "note": note,
        "tags": cue_tags,
        "timecode": tc,
        "layers": [],
    })
```

## Assign Layers to Sections

Use index-based iteration for both top-level and leaf layers.

```python
def section_for_layer(sections, t_start):
    for section in sections:
        start = float(section["beat"])
        end = start + float(section["length"])
        if start <= float(t_start) and float(t_start) < end:
            return section
    return None

layers = track.layers
for layer_index in range(len(layers)):
    top_layer = layers[layer_index]
    try:
        leaves = top_layer.getLeafLayers()
    except:
        leaves = [top_layer]

    for leaf_index in range(len(leaves)):
        layer = leaves[leaf_index]
        try:
            section = section_for_layer(sections, float(layer.tStart))
        except:
            section = None
        if section is None:
            continue

        section["layers"].append({
            "name": str(getattr(layer, "name", "") or getattr(layer, "description", "")),
            "type": str(layer.moduleType.__name__),
            "tStart": float(layer.tStart),
        })
```

## File Name From the Video Sequence

Do not use `seq.key(0)` to find a file name. Video sequences may contain
`KeyAsKeyContainer` keys for indirection bindings, and that path has a known
native crash. Use `getSequencedValue(layer.tStart)` instead.

```python
file_name = ""
field = layer.findSequence("video")
if field is not None:
    value = field.getSequencedValue(float(layer.tStart))
    if value is not None and value.value is not None:
        file_name = str(value.value.description)
```

## Membership Rule

A layer belongs to a section when:

```text
section_beat <= layer.tStart < section_beat + section_length
```

Layers that span multiple sections are listed only under the section where they
start. That keeps the UI deterministic and avoids duplicate layer rows.


