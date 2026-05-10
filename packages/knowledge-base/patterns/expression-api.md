---
type: pattern
status: documented
api_coverage:
  - name: "setExpression"
    match: "\\.setExpression\\s*\\("
    related_files: ["expression-api.md"]
    required: false
---

# Expression API

## setExpression on FieldSequence

Every FieldSequence supports `setExpression()` to drive the value dynamically.
The expression overrides keyframe values until cleared.

```python
fseq = layer.findSequence("brightness")

# Scale existing keyframe value
fseq.setExpression("self * 0.5")

# Time-based animation (math module available in expression context)
fseq.setExpression("0.5 + 0.5 * math.sin(time * math.pi)")

# Cross-layer link — reference another layer's property
fseq.setExpression("module:OtherLayerName.brightness")

# OSC input (note: / becomes . in expression syntax)
fseq.setExpression("osc:my.address")

# Conditional
fseq.setExpression("if(time > 5, 1, 0)")

# Clear expression — restore keyframe control
fseq.setExpression("self")
```

### Expression Context Variables
- `self` — current keyframe value
- `time` — current time in beats
- `math` — Python math module (sin, cos, pi, etc.)
- `module:LayerName.property` — cross-layer reference
- `osc:address.path` — OSC input (slashes become dots)

## ExpressionVariablesDevice — Custom Variables

Create named variables that can be referenced in any expression across the project.

```python
import d3

# Create or load the variable device resource
device_path = "devices/{}".format(device_name)
var_device = resourceManager.loadOrCreate(device_path, ExpressionVariablesDevice)

# Register device with Designer
device_manager = state.devices
if var_device not in device_manager.devices:
    device_manager.devices.append(var_device)

# Add a variable
var_container = var_device.container
var_container.variables.append(ExpressionVariable())
new_var = var_container.variables[-1]
new_var.name = "my_variable_name"
new_var.type = ExpressionVariable.FloatType
new_var.defaultFloat = 5

# Use the variable in any expression on any layer
fseq.setExpression("my_variable_name * 2")
```

### Variable Types
- `ExpressionVariable.FloatType` — numeric, set via `defaultFloat`
- Other types exist but Float is the most common for automation

Observed numeric type values:

| Value | Meaning | Default field |
|---|---|---|
| `0` | float | `defaultFloat` |
| `1` | string | `defaultString` |
| `2` | function | function body/string handling needs a focused probe before public use |

Register or remove an `ExpressionVariablesDevice` by reassigning
`state.devices.devices` as a complete list. Do not rely on in-place collection
mutation in portable plugin code.

When listing expressions on a layer, check the module fields and resolve each
field sequence with `layer.findSequence(field.name)`. Expression text may be
available as `expressionText` or via `getExpression()` depending on the surface;
treat `"self"` and empty strings as unpatched/default.

## Key Notes
- `device_manager.devices.append(device)` works for devices (unlike `ctrl.resources.append` which crashes)
- Setting expression to `"self"` effectively clears it (passes through keyframe value)
- OSC address `/show/selector` becomes expression `osc:show.selector`
- Not yet live-tested — confirm `setExpression` and `ExpressionVariablesDevice` before relying on them in production
