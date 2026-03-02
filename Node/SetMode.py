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
			inputs         = [
				io.String.Input("TargetClass", display_name = "Target Class", default = ""),
				io.Combo.Input ("Mode",        default      = "Enabled",      options = ["Enabled", "Muted", "Bypassed"])
			]
		)

	@classmethod
	def execute(cls, TargetClass, Mode = "Enabled") -> io.NodeOutput:
		return ()


class JohnsSetModeConnected(io.ComfyNode):
	@classmethod
	def define_schema(cls) -> io.Schema:
		return io.Schema(
			node_id        = "JohnsSetModeConnected",
			display_name   = "Set Mode - Connected",
			category       = "John's/Utilities",
			description    = "Set Enabled | Muted | Bypassed on Any Node Connected to This Node",
			search_aliases = ["mute", "bypass", "enable", "disable", "set", "node", "connected"],
			inputs         = [
				io.AnyType.Input("AnyInput"),
				io.String.Input ("Mode",     default  = "No Connection")
			],
			outputs = [
				io.AnyType.Output("Passthrough")
			]
		)

	@classmethod
	def execute(cls, AnyInput, Mode = "No Connection") -> io.NodeOutput:
		return io.NodeOutput(AnyInput)
