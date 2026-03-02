from __future__ import annotations
from comfy_api.latest import io  # type: ignore
from .Backend import ResolutionCalculatorBackend


class JohnsResolutionCalculator(io.ComfyNode): 
	@classmethod
	def define_schema(cls) -> io.Schema: 
		return io.Schema(
			node_id        = "JohnsResolutionCalculator",
			display_name   = "John's Resolution Calculator",
			category       = "John's/Utilities",
			description    = "Resolution Calculator based on Various Imputs and Presets",
			search_aliases = ["resolution", "calculator", "aspect", "ratio", "preset"],
			inputs         = [
				io.Image.Input(
					"Image",
					optional     = True,
					tooltip      = "Optional Input: If an Image is connected, its dimensions will be used instead of the Width and Height inputs"
				),
				io.Combo.Input(
					"AspectRatio",
					options      = ResolutionCalculatorBackend.JohnsAspectRatios(),
					display_name = "Aspect Ratio",
					default      = "1:1 - Square",
					tooltip      = "Select the desired Aspect Ratio\nIf an Image is connected, this is ignored"
				),
				io.Int.Input(
					"Width",
					default      = 1024,
					min          = 0,
					max          = 8192,
					step         = 1,
					tooltip      = "Set to 0 to auto-calculate based on Height and Aspect Ratio\nIf an Image is connected, this is ignored"
				),
				io.Int.Input(
					"Height",
					default      = 0,
					min          = 0,
					max          = 8192,
					step         = 1,
					tooltip      = "Set to 0 to auto-calculate based on Width and Aspect Ratio\nIf an Image is connected, this is ignored"
				),
				io.Float.Input(
					"Multiplier",
					display_name = "Multiplier:",
					default      = 1.0,
					min          = 0.05,
					max          = 8.0,
					step         = 0.05,
					round        = 0.05,
					display_mode = io.NumberDisplay.slider,
					tooltip      = "Scale the final dimensions by this Multiplier\nIf an Image is connected, this is applied on the Image dimensions"
				),
				io.Int.Input(
					"DivisibleBy",
					display_name = "Divisible By:",
					default      = 64,
					min          = 0,
					max          = 128,
					step         = 8,
					display_mode = io.NumberDisplay.slider,
					tooltip      = "Adjust the final dimensions to be Divisible By This Number\nSet to 0 to Disable"
				)
			],
			outputs = [
				io.Image.Output("Image"),
				io.Int.Output  ("Width"),
				io.Int.Output  ("Height")
			]
		)

	@classmethod
	def execute(cls, Image = None, AspectRatio = "1:1 - Square", Width = 0, Height = 0, Multiplier = 1.0, DivisibleBy = 64) -> io.NodeOutput: 
		w, h = ResolutionCalculatorBackend.Compute(
			AspectRatio,
			int  (Width),
			int  (Height),
			float(Multiplier),
			int  (DivisibleBy),
			Image
		)
		
		return io.NodeOutput(Image, int(w), int(h))
