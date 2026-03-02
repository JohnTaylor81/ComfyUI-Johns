from __future__ import annotations
from comfy_api.latest import io  # type: ignore
from .Backend.AnySwitchBackend import Run


class JohnsAnySwitch(io.ComfyNode): 
	@classmethod
	def define_schema(cls): 
		InputTemplate = io.Autogrow.TemplatePrefix(io.AnyType.Input("Input", optional = True), prefix = "", min = 1, max = 50)
		return io.Schema(
			node_id        = "JohnsAnySwitch",
			display_name   = "John's Any Switch",
			category       = "John's/Utilities",
			description    = "Plug in Anything of Any Type (Yes, can be Mixed), output Anything of Any Type with Selection index",
			search_aliases = ["switch", "any"],
			is_output_node = True,
			inputs         = [
				io.Autogrow.Input("Input",     template = InputTemplate),
				io.Int.Input     ("Selection", display_name = "Selection", default  = 0, min = 0, max = 64, step = 1)
			],
			outputs = [
				io.AnyType.Output("Output")
			]
		)

	@classmethod
	def execute(cls, Input: io.Autogrow.Type, Selection) -> io.NodeOutput:
		return io.NodeOutput(Run(Input, Selection))
