---
type: pattern
status: confirmed
tested: "2026-03-25"
api_coverage:
  - name: "stage.ledScreens"
    match: "stage\\.ledScreens|stage\\.surfaces"
    related_files: ["feed-scene-config.md"]
    required: false
  - name: "FeedScene"
    match: "\\bFeedScene\\b|\\bFeedRect\\b"
    related_files: ["feed-scene-config.md"]
    required: false
---

# Feed Scene Configuration

Configure output mapping regions, deformation, and head settings.

## Access Feed Scenes
```python
feed_scene = next((s for s in system.scenes if isinstance(s, FeedScene) and s.name == "MyFeedScene"), None)
```

## Create and Configure Feed Rectangles
```python
new_rect = feed_scene.add()
new_rect.screen = my_screen
new_rect.head = 0
new_rect.rect.x = 0
new_rect.rect.w = 1920
new_rect.screenRect.u = 0.0
new_rect.screenRect.uw = 1.0
```

## Assign Feed Scene to Layer
```python
# FeedScene -> FeedProjection -> Layer
feed_projection.feed_scene = feed_scene
video_layer.projection = feed_projection
```

## DeformStack (Warping)
```python
deform_stack = feed_rect.deformStack
deform_stack.clear()
lens = deform_stack.add(DeformStackItem_Lens)
lens.amount = 0.5
```

## Output Head Configuration
```python
head_config = feed_scene.ensureHeadConfig(0, Int2(1920, 1080))
head_config.resolution = Int2(1920, 1080)
head_config.framesLatency = 2
```

## FeedRect Routing Notes

For machine feed routing, read `machine.feed.feedRects` and
`machine.feed.headConfigs`. A `FeedRect` commonly carries:

- `head` - output head index.
- `screenRect` - source/display rectangle.
- `rect` - output/head rectangle.
- `referenceDisplay` - display/screen the rect references.
- `displayTarget` - target index used by capture/probe APIs.

Before adding a rect, ensure the head config exists with
`feed.ensureHeadConfig(head_index, Int2(width, height))`. When clearing a feed,
copy `feed.feedRects` to a native list first, then remove each existing rect.
