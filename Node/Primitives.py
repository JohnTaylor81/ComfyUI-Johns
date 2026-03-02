from __future__ import annotations
import sys
from comfy_api.latest import io  # type: ignore


class JohnsPrimitiveInt(io.ComfyNode):
	@classmethod
	def define_schema(cls) -> io.Schema:
		return io.Schema(
			node_id        = "JohnsPrimitiveInt",
			display_name   = "Int",
			category       = "John's/Primitives",
			search_aliases = ["int", "number", "value"],
			inputs         = [
				io.Int.Input("Value", display_name = "Value", default = 0, min = -sys.maxsize, max = sys.maxsize, step = 1)
			],
			outputs = [
				io.Int.Output("Int")
			]
		)

	@classmethod
	def execute(cls, Value: int):
		return io.NodeOutput(Value)


class JohnsPrimitiveIntMinMax(io.ComfyNode):
	@classmethod
	def define_schema(cls) -> io.Schema:
		return io.Schema(
			node_id        = "JohnsPrimitiveIntMinMax",
			display_name   = "Int Min Max",
			category       = "John's/Primitives",
			search_aliases = ["int", "number", "value", "slider"],
			inputs         = [
				io.Int.Input("Value", display_name = "Value", default = 0,     min = -sys.maxsize, max = sys.maxsize, step = 1),
				io.Int.Input("Min",   display_name = "Min",   default = -1024, min = -sys.maxsize, max = sys.maxsize, step = 1),
				io.Int.Input("Max",   display_name = "Max",   default = 1024,  min = -sys.maxsize, max = sys.maxsize, step = 1)
			],
			outputs = [
				io.Int.Output("Int")
			]
		)

	@classmethod
	def execute(cls, Value: int, Min: int, Max: int):
		return io.NodeOutput(Value)


class JohnsPrimitiveIntSlider(io.ComfyNode):
	@classmethod
	def define_schema(cls) -> io.Schema:
		return io.Schema(
			node_id        = "JohnsPrimitiveIntSlider",
			display_name   = "Int Slider",
			category       = "John's/Primitives",
			search_aliases = ["int", "number", "value"],
			inputs         = [
				io.Int.Input("Value", display_name = "Value:", default = 0, min = -1024, max = 1024, step = 1, display_mode = io.NumberDisplay.slider)
			],
			outputs = [
				io.Int.Output("Int")
			]
		)

	@classmethod
	def execute(cls, Int: int):
		return io.NodeOutput(Int)

class JohnsPrimitiveIntSliderMinMax(io.ComfyNode):
	@classmethod
	def define_schema(cls) -> io.Schema:
		return io.Schema(
			node_id        = "JohnsPrimitiveIntSliderMinMax",
			display_name   = "Int Slider Min Max",
			category       = "John's/Primitives",
			search_aliases = ["int", "number", "value", "slider"],
			inputs         = [
				io.Int.Input("Value", display_name = "Value:", default = 0,     min = -1024,        max = 1024,        step = 1, display_mode = io.NumberDisplay.slider),
				io.Int.Input("Min",   display_name = "Min",    default = -1024, min = -sys.maxsize, max = sys.maxsize, step = 1),
				io.Int.Input("Max",   display_name = "Max",    default = 1024,  min = -sys.maxsize, max = sys.maxsize, step = 1)
			],
			outputs = [
				io.Int.Output("Int")
			]
		)

	@classmethod
	def execute(cls, Value: int, Min: int, Max: int):
		return io.NodeOutput(Value)


class JohnsPrimitiveFloat(io.ComfyNode):
	@classmethod
	def define_schema(cls) -> io.Schema:
		return io.Schema(
			node_id        = "JohnsPrimitiveFloat",
			display_name   = "Float .1",
			category       = "John's/Primitives",
			search_aliases = ["float", "number", "value"],
			inputs         = [
				io.Float.Input("Value", display_name = "Value", default = 0.0, min = -sys.maxsize, max = sys.maxsize, step = 0.1)
			],
			outputs = [
				io.Float.Output("Float")
			]
		)

	@classmethod
	def execute(cls, Value: float):
		return io.NodeOutput(Value)


class JohnsPrimitiveFloatP05(io.ComfyNode):
	@classmethod
	def define_schema(cls) -> io.Schema:
		return io.Schema(
			node_id        = "JohnsPrimitiveFloatP05",
			display_name   = "Float .05",
			category       = "John's/Primitives",
			search_aliases = ["float", "number", "value"],
			inputs         = [
				io.Float.Input("Value", display_name = "Value", default = 0.00, min = -sys.maxsize, max = sys.maxsize, step = 0.05)
			],
			outputs = [
				io.Float.Output("Float")
			]
		)

	@classmethod
	def execute(cls, Value: float):
		return io.NodeOutput(Value)


class JohnsPrimitiveFloatP01(io.ComfyNode):
	@classmethod
	def define_schema(cls) -> io.Schema:
		return io.Schema(
			node_id        = "JohnsPrimitiveFloatP01",
			display_name   = "Float .01",
			category       = "John's/Primitives",
			search_aliases = ["float", "number", "value"],
			inputs         = [
				io.Float.Input("Value", display_name = "Value", default = 0.00, min = -sys.maxsize, max = sys.maxsize, step = 0.01)
			],
			outputs = [
				io.Float.Output("Float")
			]
		)

	@classmethod
	def execute(cls, Value: float):
		return io.NodeOutput(Value)


class JohnsPrimitiveFloatMinMax(io.ComfyNode):
	@classmethod
	def define_schema(cls) -> io.Schema:
		return io.Schema(
			node_id        = "JohnsPrimitiveFloatMinMax",
			display_name   = "Float Min Max .1",
			category       = "John's/Primitives",
			search_aliases = ["float", "number", "value", "slider"],
			inputs         = [
				io.Float.Input("Value", display_name = "Value", default = 0.0,     min = -sys.maxsize, max = sys.maxsize, step = 0.1),
				io.Float.Input("Min",   display_name = "Min",   default = -1024.0, min = -sys.maxsize, max = sys.maxsize, step = 0.1),
				io.Float.Input("Max",   display_name = "Max",   default = 1024.0,  min = -sys.maxsize, max = sys.maxsize, step = 0.1)
			],
			outputs = [
				io.Float.Output("Float")
			]
		)

	@classmethod
	def execute(cls, Value: float, Min: float, Max: float):
		return io.NodeOutput(Value)


class JohnsPrimitiveFloatMinMaxP05(io.ComfyNode):
	@classmethod
	def define_schema(cls) -> io.Schema:
		return io.Schema(
			node_id        = "JohnsPrimitiveFloatMinMaxP05",
			display_name   = "Float Min Max .05",
			category       = "John's/Primitives",
			search_aliases = ["float", "number", "value", "slider"],
			inputs         = [
				io.Float.Input("Value", display_name = "Value", default = 0.00,     min = -sys.maxsize, max = sys.maxsize, step = 0.05),
				io.Float.Input("Min",   display_name = "Min",   default = -1024.00, min = -sys.maxsize, max = sys.maxsize, step = 0.05),
				io.Float.Input("Max",   display_name = "Max",   default = 1024.00,  min = -sys.maxsize, max = sys.maxsize, step = 0.05)
			],
			outputs = [
				io.Float.Output("Float")
			]
		)

	@classmethod
	def execute(cls, Value: float, Min: float, Max: float):
		return io.NodeOutput(Value)


class JohnsPrimitiveFloatMinMaxP01(io.ComfyNode):
	@classmethod
	def define_schema(cls) -> io.Schema:
		return io.Schema(
			node_id        = "JohnsPrimitiveFloatMinMaxP01",
			display_name   = "Float Min Max .01",
			category       = "John's/Primitives",
			search_aliases = ["float", "number", "value", "slider"],
			inputs         = [
				io.Float.Input("Value", display_name = "Value", default = 0.00,     min = -sys.maxsize, max = sys.maxsize, step = 0.01),
				io.Float.Input("Min",   display_name = "Min",   default = -1024.00, min = -sys.maxsize, max = sys.maxsize, step = 0.01),
				io.Float.Input("Max",   display_name = "Max",   default = 1024.00,  min = -sys.maxsize, max = sys.maxsize, step = 0.01)
			],
			outputs = [
				io.Float.Output("Float")
			]
		)

	@classmethod
	def execute(cls, Value: float, Min: float, Max: float):
		return io.NodeOutput(Value)


class JohnsPrimitiveFloatSlider(io.ComfyNode):
	@classmethod
	def define_schema(cls) -> io.Schema:
		return io.Schema(
			node_id        = "JohnsPrimitiveFloatSlider",
			display_name   = "Float Slider .1",
			category       = "John's/Primitives",
			search_aliases = ["float", "number", "value"],
			inputs         = [
				io.Float.Input("Value", display_name = "Value:", default = 0.0, min = -1024.0, max = 1024.0, step = 0.1, display_mode = io.NumberDisplay.slider)
			],
			outputs = [
				io.Float.Output("Float")
			]
		)

	@classmethod
	def execute(cls, Value: float):
		return io.NodeOutput(Value)


class JohnsPrimitiveFloatSliderP05(io.ComfyNode):
	@classmethod
	def define_schema(cls) -> io.Schema:
		return io.Schema(
			node_id        = "JohnsPrimitiveFloatSliderP05",
			display_name   = "Float Slider .05",
			category       = "John's/Primitives",
			search_aliases = ["float", "number", "value"],
			inputs         = [
				io.Float.Input("Value", display_name = "Value:", default = 0.00, min = -1024.00, max = 1024.00, step = 0.05, display_mode = io.NumberDisplay.slider)
			],
			outputs = [
				io.Float.Output("Float")
			]
		)

	@classmethod
	def execute(cls, Value: float):
		return io.NodeOutput(Value)


class JohnsPrimitiveFloatSliderP01(io.ComfyNode):
	@classmethod
	def define_schema(cls) -> io.Schema:
		return io.Schema(
			node_id        = "JohnsPrimitiveFloatSliderP01",
			display_name   = "Float Slider .01",
			category       = "John's/Primitives",
			search_aliases = ["float", "number", "value"],
			inputs         = [
				io.Float.Input("Value", display_name = "Value:", default = 0.00, min = -1024.00, max = 1024.00, step = 0.01, display_mode = io.NumberDisplay.slider)
			],
			outputs = [
				io.Float.Output("Float")
			]
		)

	@classmethod
	def execute(cls, Value: float):
		return io.NodeOutput(Value)


class JohnsPrimitiveFloatSliderMinMax(io.ComfyNode):
	@classmethod
	def define_schema(cls) -> io.Schema:
		return io.Schema(
			node_id        = "JohnsPrimitiveFloatSliderMinMax",
			display_name   = "Float Slider Min Max .1",
			category       = "John's/Primitives",
			search_aliases = ["float", "number", "value", "slider"],
			inputs         = [
				io.Float.Input("Value", display_name = "Value:", default = 0.0,     min = -1024.0,      max = 1024.0,      step = 0.1, display_mode = io.NumberDisplay.slider),
				io.Float.Input("Min",   display_name = "Min",    default = -1024.0, min = -sys.maxsize, max = sys.maxsize, step = 0.1),
				io.Float.Input("Max",   display_name = "Max",    default = 1024.0,  min = -sys.maxsize, max = sys.maxsize, step = 0.1)
			],
			outputs = [
				io.Float.Output("Float")
			]
		)

	@classmethod
	def execute(cls, Value: float, Min: float, Max: float):
		return io.NodeOutput(Value)


class JohnsPrimitiveFloatSliderMinMaxP05(io.ComfyNode):
	@classmethod
	def define_schema(cls) -> io.Schema:
		return io.Schema(
			node_id        = "JohnsPrimitiveFloatSliderMinMaxP05",
			display_name   = "Float Slider Min Max .05",
			category       = "John's/Primitives",
			search_aliases = ["float", "number", "value", "slider"],
			inputs         = [
				io.Float.Input("Value", display_name = "Value:", default = 0.00,     min = -1024.00,     max = 1024.00,     step = 0.05, display_mode = io.NumberDisplay.slider),
				io.Float.Input("Min",   display_name = "Min",    default = -1024.00, min = -sys.maxsize, max = sys.maxsize, step = 0.05),
				io.Float.Input("Max",   display_name = "Max",    default = 1024.00,  min = -sys.maxsize, max = sys.maxsize, step = 0.05)
			],
			outputs = [
				io.Float.Output("Float")
			]
		)

	@classmethod
	def execute(cls, Value: float, Min: float, Max: float):
		return io.NodeOutput(Value)


class JohnsPrimitiveFloatSliderMinMaxP01(io.ComfyNode):
	@classmethod
	def define_schema(cls) -> io.Schema:
		return io.Schema(
			node_id        = "JohnsPrimitiveFloatSliderMinMaxP01",
			display_name   = "Float Slider Min Max .01",
			category       = "John's/Primitives",
			search_aliases = ["float", "number", "value", "slider"],
			inputs         = [
				io.Float.Input("Value", display_name = "Value:", default = 0.00,     min = -1024.00,     max = 1024.00,     step = 0.01, display_mode = io.NumberDisplay.slider),
				io.Float.Input("Min",   display_name = "Min",    default = -1024.00, min = -sys.maxsize, max = sys.maxsize, step = 0.01),
				io.Float.Input("Max",   display_name = "Max",    default = 1024.00,  min = -sys.maxsize, max = sys.maxsize, step = 0.01)
			],
			outputs = [
				io.Float.Output("Float")
			]
		)

	@classmethod
	def execute(cls, Value: float, Min: float, Max: float):
		return io.NodeOutput(Value)


class JohnsPrimitiveBoolean(io.ComfyNode):
	@classmethod
	def define_schema(cls):
		return io.Schema(
			node_id        = "JohnsPrimitiveBoolean",
			display_name   = "Boolean",
			category       = "John's/Primitives",
			search_aliases = ["bool", "true", "false"],
			inputs         = [
				io.Boolean.Input(
					"Boolean", display_name = "Boolean", default = False, label_off = "False", label_on = "True")
			],
			outputs = [
				io.Boolean.Output("Boolean")
			]
		)

	@classmethod
	def execute(cls, Boolean: bool) -> io.NodeOutput:
		return io.NodeOutput(Boolean)


class JohnsPrimitiveString(io.ComfyNode):
	@classmethod
	def define_schema(cls):
		return io.Schema(
			node_id        = "JohnsPrimitiveString",
			display_name   = "String",
			category       = "John's/Primitives",
			search_aliases = ["string", "text"],
			inputs         = [
				io.String.Input("String")
			],
			outputs = [
				io.String.Output("String")
			]
		)

	@classmethod
	def execute(cls, String: str) -> io.NodeOutput:
		return io.NodeOutput(String)


class JohnsPrimitiveMultilineString(io.ComfyNode):
	@classmethod
	def define_schema(cls):
		return io.Schema(
			node_id        = "JohnsPrimitiveMultilineString",
			display_name   = "Multiline String",
			category       = "John's/Primitives",
			search_aliases = ["string", "text", "multiline"],
			inputs         = [
				io.String.Input("String", multiline = True)
			],
			outputs = [
				io.String.Output("String")
			]
		)

	@classmethod
	def execute(cls, String: str) -> io.NodeOutput:
		return io.NodeOutput(String)
