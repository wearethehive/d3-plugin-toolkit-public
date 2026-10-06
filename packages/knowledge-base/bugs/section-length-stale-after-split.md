---
type: bug
status: confirmed
severity: error
tested: "2026-07-14"
api_coverage:
  - name: "Track.sectionLengthBeats after split"
    match: "sectionLengthBeats\\s*\\(|splitSectionAtBeat\\s*\\("
    related_files: ["section-length-stale-after-split.md", "cuelist-query.md"]
    required: false
---

# `sectionLengthBeats()` Can Stay Stale After Splitting a Section

## Symptom

After a new section is split out of an existing section, the preceding
section's `sectionLengthBeats(i)` can retain its original length. Its reported
range then overlaps one or more later sections.

This was confirmed in a live show where one section's stored end extended 69
beats past the next section's actual start. A beat-by-beat audit of 89 sections
found the remaining sections contiguous and non-overlapping.

Code that buckets layers using this range can assign content to the wrong
section:

```python
start = float(track.sectionToBeat(i))
end = start + float(track.sectionLengthBeats(i))  # can overlap later sections
```

## Workaround

For every section except the last, use the next section's start beat as the
effective upper bound. Fall back to the stored length only for the final
section:

```python
section_count = int(track.nSections())
starts = [float(track.sectionToBeat(i)) for i in range(section_count)]

for i in range(section_count):
    start = starts[i]
    if i + 1 < section_count:
        end = starts[i + 1]
    else:
        end = start + float(track.sectionLengthBeats(i))
```

Use the half-open interval `[start, end)` when assigning layers to sections.

## Impact

The stale value was observed after later timeline edits introduced new section
boundaries inside an older section. Treat `sectionLengthBeats()` as display
metadata for non-final sections, not as the authoritative next boundary.

## Related

- `patterns/cuelist-query.md`
- `patterns/cue-section-authoring.md`
