from comfy_api.latest import io  # type: ignore
from .Backend.Logger import Console


class JohnsTestNode(io.ComfyNode): 
	@classmethod
	def define_schema(cls): 
		autogrow_template = io.Autogrow.TemplatePrefix(io.Mask.Input("Mask"), prefix = "Mask", min = 1, max = 50)
		return io.Schema(
			node_id        = "JohnsTestNode",
			display_name   = "JohnsTestNode",
			category       = "John's/Test",
			is_output_node = True,
			inputs         = [
				io.Autogrow.Input("Mask", template = autogrow_template),
				io.Color.Input("Color"),
				io.DynamicCombo.Input("combo", options = [
				io.DynamicCombo.Option("option1", [io.String.Input("string")]),
				io.DynamicCombo.Option("option2", [io.Int.Input("integer")]),
				io.DynamicCombo.Option("option3", [io.Image.Input("image")]),
				io.DynamicCombo.Option("option4", [
					io.DynamicCombo.Input("subcombo", options = [
						io.DynamicCombo.Option("opt1", [io.Float.Input("float_x"), io.Float.Input("float_y")]),
						io.DynamicCombo.Option("opt2", [io.Mask.Input("mask1", optional = True)])
					])
				])]
			)],
			outputs = [
				io.Mask.Output("Mask"),
				io.AnyType.Output("Color"),
				io.AnyType.Output()
			]
		)

	@classmethod
	def execute(cls, Mask: io.Autogrow.Type, Color, combo) -> io.NodeOutput:
		
		Console("JohnsTestNode").Log("Debug Message")
		Console("JohnsTestNode").Log("Info Message", timestamp = False, label = "INFO", color = "INFO")
		Console("JohnsTestNode").Log("Warning Message", label = "WARNING", color = "WARNING", year = True)
		Console("JohnsTestNode").Log("Error Message", label = "ERROR", color = "ERROR")
		Console("JohnsTestNode").Log("Success Message", label = "SUCCESS", color = "SUCCESS")
		int_variable = 5
		Console().Log("Something went wrong. Expected {GREEN}0 {BRIGHT}{ERROR}but{NORMAL} {WARNING}got {RED}{value}", value = int_variable, color = "WARNING")

		combo_val = combo["combo"]

		if combo_val == "option1":
			return io.NodeOutput(Mask, Color, combo["string"])
		elif combo_val == "option2":
			return io.NodeOutput(Mask, Color, combo["integer"])
		elif combo_val == "option3":
			return io.NodeOutput(Mask, Color, combo["image"])
		elif combo_val == "option4":
			return io.NodeOutput(Mask, Color, f"{combo['subcombo']}")
		else: 
			raise ValueError(f"Invalid combo: {combo_val}")
