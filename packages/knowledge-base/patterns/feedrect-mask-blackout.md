---
type: pattern
status: confirmed
tested: "2026-04-11"
api_coverage:
  - name: "FeedRect.mask blackout"
    match: "\\.mask\\s*=|\\bDxTexture\\b|\\.resizeTarget\\s*\\("
    related_files: ["feedrect-mask-blackout.md"]
    required: false
  - name: "d3.Int2 for texture sizing"
    match: "d3\\.Int2\\s*\\("
    related_files: ["feedrect-mask-blackout.md"]
    required: false
  - name: "d3.Colour for texture clear"
    match: "d3\\.Colour\\s*\\("
    related_files: ["feedrect-mask-blackout.md"]
    required: false
---

# FeedRect Mask Blackout

## Purpose

Black out one output head by assigning a solid black 1x1 `DxTexture` to
`FeedRect.mask`. Restore output by assigning `None` back to the same mask
field.

## Key Facts

- `rect.mask` returns Python `None` when no mask is set. Do not compare it
  with `d3.DxTexture.null`.
- `rect.mask = None` clears an existing mask.
- Use `resourceManager.loadOrCreate(path, d3.DxTexture)` for the persistent
  black texture resource.
- Fill the texture with `resizeTarget(d3.Int2(1, 1), 0, 0, 0, 1, 1)` and
  `clear(d3.Colour(0, 0, 0, 1))`.
- Do not use `DxTexture.resize()` before `clear()`. It enters CPU pixel-write
  mode and can native-crash. See
  [dxtexture-resize-writing-pixels-crash.md](../bugs/dxtexture-resize-writing-pixels-crash.md).
- Persistence needs `markDirty(rect)`, the assignment, `markDirty(feed)`, then
  `feed.save()`.

## Pattern

```python
_black_tex = None

def get_black_texture():
    import d3
    global _black_tex

    if _black_tex is not None:
        try:
            _ = _black_tex.size
        except:
            _black_tex = None

    if _black_tex is None:
        tex = resourceManager.loadOrCreate(
            "objects/texture/probe_blackout_mask.apx",
            d3.DxTexture,
        )
        tex.resizeTarget(d3.Int2(1, 1), 0, 0, 0, 1, 1)
        tex.clear(d3.Colour(0, 0, 0, 1))
        tex.save()
        _black_tex = tex

    return _black_tex

def set_blackout(feed_path, blackout):
    import d3

    feed = resourceManager.loadOrCreate(feed_path, d3.FeedConfig)
    rect = feed.rect

    if blackout:
        tex = get_black_texture()
        markDirty(rect)
        rect.mask = tex
        markDirty(feed)
    else:
        if rect.mask is not None:
            markDirty(rect)
            rect.mask = None
            markDirty(feed)

    feed.save()
```

## Notes

- The module-level `_black_tex` cache is useful in registered modules, but keep
  the stale-reference guard. Designer module instances can outlive project
  reloads.
- ETF_NONE (`0`) is valid for the texture format in this 1x1 solid-color mask
  use case.
- Mark both the `FeedRect` and parent feed dirty. Marking only the feed was not
  enough for the mask assignment to persist.
