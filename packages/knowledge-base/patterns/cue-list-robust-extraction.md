---
type: pattern
status: observed
tested: "2026-05-03"
api_coverage:
  - name: "cue.getTag"
    match: "\\.getTag\\s*\\("
    related_files: ["cue-list-robust-extraction.md", "timeline-export-cues.md"]
    required: false
---

# Cue List Robust Extraction

## Purpose

Build a UI-friendly cue list with cue tags, notes, sections, seconds, and basic
diagnostics. Use the confirmed `track.cueBeats()` + `track.cueAtBeat()` path
first, then fall back for builds where direct cue methods return partial data.

## Primary Cue Walk

```python
def iter_items(seq):
    items = []
    if seq is None:
        return items
    try:
        count = int(len(seq))
    except:
        count = 0
    for i in range(count):
        try:
            items.append(seq[i])
        except:
            try:
                items.append(seq.at(i))
            except:
                pass
    return items

def beat_to_seconds(track, beat):
    try:
        return float(track.beatToTime(float(beat)))
    except:
        return None

result = {"tags": [], "notes": [], "sections": [], "diagnostics": {}}
cue_beats = list(track.cueBeats())
resource_tags = iter_items(getattr(track, "tags", None))

for beat in cue_beats:
    try:
        beat_value = float(beat)
        cue = track.cueAtBeat(beat_value)
    except:
        continue

    try:
        if bool(cue.hasNote()):
            text = str(getattr(cue, "note", "") or "").strip()
            if text:
                result["notes"].append({
                    "beat": beat_value,
                    "seconds": beat_to_seconds(track, beat_value),
                    "text": text,
                })
    except:
        pass

    try:
        cue_tags = iter_items(cue.getTags())
    except:
        cue_tags = []

    for tag in cue_tags:
        try:
            label = str(getattr(tag, "text", "") or "").strip()
            tag_kind = int(getattr(tag, "type", 0) or 0)
        except:
            label = ""
            tag_kind = 0
        if not label and tag_kind > 0 and tag_kind <= len(resource_tags):
            try:
                label = str(getattr(resource_tags[tag_kind - 1], "name", "") or "").strip()
            except:
                label = ""
        if label:
            result["tags"].append({
                "beat": beat_value,
                "seconds": beat_to_seconds(track, beat_value),
                "label": label,
            })

    try:
        if bool(cue.isSection()):
            section_index = int(track.beatToSection(beat_value))
            result["sections"].append({
                "beat": beat_value,
                "seconds": beat_to_seconds(track, beat_value),
                "label": "Section {0}".format(section_index),
            })
    except:
        pass
```

## Fallback: `cue.getTag(index)`

Some builds may return an empty `cue.getTags()` list while `cue.getTag(index)`
still resolves individual tag slots. Probe before depending on this, but this
fallback was observed in working code.

```python
if not cue_tags:
    for tag_index in range(0, 9):
        try:
            tag = cue.getTag(tag_index)
        except:
            tag = None
        if tag is None:
            continue
        try:
            label = str(getattr(tag, "text", "") or "").strip()
        except:
            label = ""
        if label:
            result["tags"].append({
                "beat": beat_value,
                "seconds": beat_to_seconds(track, beat_value),
                "label": label,
            })
```

## Fallback: Sections Only

```python
if not result["sections"]:
    try:
        section_count = int(track.nSections())
    except:
        section_count = 0
    for section_index in range(section_count):
        try:
            beat = float(track.sectionToBeat(section_index))
            result["sections"].append({
                "beat": beat,
                "seconds": beat_to_seconds(track, beat),
                "label": "Section {0}".format(section_index),
            })
        except:
            pass
```

## Notes

- `track.beatToTime(beat)` gives seconds for UI display; do not assume
  beats equal seconds.
- Existing confirmed pattern `timeline-export-cues.md` remains the primary
  source of truth. This entry records additional defensive fallbacks.
