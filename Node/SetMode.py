from __future__ import annotations
from comfy_api.latest import io  # type: ignore


class JohnsSetModeByClass(io.ComfyNode):
	@classmethod
	def define_schema(cls) -> io.Schema:
		return io.Schema(
			node_id        = "JohnsSetModeByClass",
			display_name   = "Set Mode By Class",
			category       = "John's/Utilities",
			description    = "Right click Any node -> Properties -> Type in what You see in 'Node name for S&R' To set Enabled | Muted | Bypassed for ALL Nodes of that type",
			search_aliases = ["mute", "bypass", "enable", "disable", "set", "node", "class"],
			is_output_node = False,
			inputs         = [
				io.String.Input("TargetClass", display_name = "Target Class", default = ""),
				io.Combo.Input ("Mode",        default      = "Enabled",      options = ["Enabled", "Muted", "Bypassed"])
			]
		)

	@classmethod
	def execute(cls, TargetClass, Mode = "Enabled"):
		return ()


class JohnsSetModeConnected(io.ComfyNode):
	@classmethod
	def define_schema(cls) -> io.Schema:
		InputTemplate = io.Autogrow.TemplatePrefix(io.AnyType.Input("AnyInput", optional = True), prefix = "", min = 1, max = 50)
		return io.Schema(
			node_id        = "JohnsSetModeConnected",
			display_name   = "Set Mode - Connected",
			category       = "John's/Utilities",
			description    = "Set Enabled | Muted | Bypassed on Any Node Connected to This Node",
			search_aliases = ["mute", "bypass", "enable", "disable", "set", "node", "connected"],
			is_output_node = False,
			inputs         = [
				io.Autogrow.Input("AnyInput", template = InputTemplate)
			]
		)

	@classmethod
	def execute(cls, AnyInput):
		return
