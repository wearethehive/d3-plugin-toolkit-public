---
type: pattern
status: confirmed
tested: "2026-03-25"
---

# Video Input Configuration

Access and configure live video input sources on VideoClip resources.

## Find Live Input Clips
```python
all_clips = resourceManager.allResources(VideoClip)
live_clips = [c for c in all_clips if c.isVideoIn]
```

## Read Input Properties
```python
name = clip.Video_Input.localVideoIn.name
hw_id = clip.Video_Input.localVideoIn.hardwareId
res = clip.Video_Input.localVideoIn.videoInFormat.resolution
fps = clip.Video_Input.localVideoIn.videoInFormat.framerate
fmt = clip.Video_Input.localVideoIn.videoInFormat.pixelFormat
```

## Configure Input
```python
clip.Video_Input.localVideoIn.setFormat(Vec2(1920, 1080), False, "YUV422")
clip.Video_Input.localVideoIn.cropRectangle = Rect(0, 0, 640, 480)
```

## System-Level Access
```python
channels = VideoInSystem.inputChannels
device = VideoInSystem.findVideoIn(hardwareId)
```
