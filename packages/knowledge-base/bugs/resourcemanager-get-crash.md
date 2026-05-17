---
type: bug
status: confirmed
severity: crash
tested: "2026-03-15"
crashers:
  - pattern: "d3\\.ResourceManager\\.get\\s*\\("
    message: "d3.ResourceManager.get() causes HTTP 500. Use the global 'resourceManager' object instead."
    severity: crash
---

# d3.ResourceManager.get() crashes

## Description

Calling `d3.ResourceManager.get()` (the static class method) causes an HTTP 500 error. The Python sandbox provides a global `resourceManager` object that should be used instead.

## Reproduction

```python
# This crashes:
rm = d3.ResourceManager.get()
```

## Workaround

Use the global `resourceManager` object directly:

```python
rm = resourceManager
res = rm.load("objects/indirection/my-resource.apx")
```
