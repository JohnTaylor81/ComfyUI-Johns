from __future__ import annotations
from comfy_api.latest import io, UI  # type: ignore
from .Backend.MaskEditorBackend import Process, GetPreset, GetTitles


class JohnsMaskEditor(io.ComfyNode):
	@classmethod
	def define_schema(cls) -> io.Schema:
		MaskTemplate = io.Autogrow.TemplatePrefix(io.Mask.Input("Mask", optional = True), prefix = "Mask - ", min = 1, max = 50)

		MaskOptions  = io.DynamicCombo.Input(
			"Mask Options",
			options = [
				io.DynamicCombo.Option("Disable Mask", []),
				io.DynamicCombo.Option(
					"Overlay Mask",
					[
						io.Boolean.Input("Mask Mode",    default = False, label_off = "Brighten", label_on = "Darken"),
						io.Float.Input  ("Mask Opacity", default = 1.0, min = 0.0, max = 1.0, step = 0.01)
					]
				)
			]
		)

		BrCoGaDe    = [
			io.Float.Input("Brightness", default = 1.0, min = 0.5, max = 2.0, step = 0.01),
			io.Float.Input("Contrast",   default = 1.0, min = 0.5, max = 2.0, step = 0.01),
			io.Float.Input("Gamma",      default = 1.0, min = 0.5, max = 2.0, step = 0.01),
			io.Float.Input("Denoise",    default = 0.0, min = 0.0, max = 8.0, step = 0.01)
		]
		
		TargetHue   = io.DynamicCombo.Input(
			"Target Hue",
			options = [
				io.DynamicCombo.Option("Pick One", [
					io.Color.Input  ("Color 1", default = "#ffffff")
				]),
				io.DynamicCombo.Option("Pick Two", [
					io.Color.Input  ("Color 1", default = "#ffffff"),
					io.Color.Input  ("Color 2", default = "#ffffff")
				]),
				io.DynamicCombo.Option("Pick Three", [
					io.Color.Input  ("Color 1", default = "#ffffff"),
					io.Color.Input  ("Color 2", default = "#ffffff"),
					io.Color.Input  ("Color 3", default = "#ffffff")
				]),
				io.DynamicCombo.Option("Pick Four", [
					io.Color.Input  ("Color 1", default = "#ffffff"),
					io.Color.Input  ("Color 2", default = "#ffffff"),
					io.Color.Input  ("Color 3", default = "#ffffff"),
					io.Color.Input  ("Color 4", default = "#ffffff")
				]),
				io.DynamicCombo.Option("Pick Five", [
					io.Color.Input  ("Color 1", default = "#ffffff"),
					io.Color.Input  ("Color 2", default = "#ffffff"),
					io.Color.Input  ("Color 3", default = "#ffffff"),
					io.Color.Input  ("Color 4", default = "#ffffff"),
					io.Color.Input  ("Color 5", default = "#ffffff")
				])
			]
		)

		ModeSelector = io.DynamicCombo.Input(
			"Advanced",
			options = [
				io.DynamicCombo.Option("None", []),
				io.DynamicCombo.Option(
					"Levels",
					[
						io.Float.Input("Black Level", default = 1.0, min = 0.0,  max = 1.0, step = 0.01),
						io.Float.Input("White Level", default = 1.0, min = 0.0,  max = 1.0, step = 0.01),
						io.Float.Input("Gamma",       default = 1.0, min = 0.05, max = 2.0, step = 0.01)
					]
				),
				io.DynamicCombo.Option(
					"Luma",
					[
						io.Boolean.Input("Invert Luma", default = True, label_off = "False", label_on = "True"),
						*BrCoGaDe,
						MaskOptions
					]
				),
				io.DynamicCombo.Option(
					"Details",
					[
						io.Boolean.Input("Invert Details", default = True,  label_off = "False", label_on = "True"),
						io.Float.Input  ("Detail Blur",    default = 2.00,  min       = 0.00,    max      = 12.00, step = 0.01),
						*BrCoGaDe,
						MaskOptions
					]
				),
				io.DynamicCombo.Option(
					"Color Range (WIP: Experimental)",
					[
						TargetHue,
						io.Boolean.Input("Cluster",               default = True,  label_off = "False", label_on = "True"),
						io.Int.Input    ("Cluster Count",         default = 5,    min = 1,    max = 16,   step = 1),
						io.Float.Input  ("Cluster Strength",      default = 1.00, min = 0.00, max = 2.00, step = 0.01),
						io.Int.Input    ("Hue Tolerance",         default = 25,   min = 0,    max = 180,  step = 1),
						io.Float.Input  ("Saturation Threshold",  default = 0.50, min = 0.00, max = 1.00, step = 0.01),
						io.Int.Input    ("Softness / Feathering", default = 5,    min = 0,    max = 50,   step = 1),
						io.Boolean.Input("Invert Selection",      default = False,  label_off = "False", label_on = "True"),
						MaskOptions
					]
				),
				io.DynamicCombo.Option(
					"Texture / Frequency",
					[
						io.Combo.Input  ("Mode",                  default = "High Frequency", options = ["High Frequency", "Low Frequency", "Band Pass"]),
						io.Float.Input  ("Sensitivity",           default = 1.00, min = 0.00, max = 2.00, step = 0.01),
						io.Int.Input    ("Detail Scale",          default = 3,    min = 1,    max = 20,   step = 1),
						io.Int.Input    ("Softness / Feathering", default = 5,    min = 0,    max = 50,   step = 1),
						io.Boolean.Input("Invert Selection",      default = True, label_off = "False", label_on = "True"),
						MaskOptions
					]
				),
				io.DynamicCombo.Option(
					"Saliency",
					[
						io.Combo.Input  ("Method",                default = "Spectral Residual", options = ["Spectral Residual", "Fine-Grained"]),
						io.Float.Input  ("Sensitivity",           default = 1.00, min = 0.00, max = 2.00, step = 0.01),
						io.Int.Input    ("Softness / Feathering", default = 5,    min = 0,    max = 50,   step = 1),
						io.Boolean.Input("Invert Selection",      default = True, label_off = "False", label_on = "True"),
						MaskOptions
					]
				),
				io.DynamicCombo.Option(
					"Distance Transform",
					[
						io.Combo.Input  ("Source",                default = "Mask", options = ["Mask", "Inverted Mask"]),
						io.Int.Input    ("Max Distance",          default = 50, min = 1, max = 200, step = 1),
						io.Combo.Input  ("Curve",                 default = "Linear", options = ["Linear", "Quadratic", "Exponential"]),
						io.Int.Input    ("Softness / Feathering", default = 5, min = 0, max = 50,   step = 1),
						io.Boolean.Input("Invert Output",         default = True, label_off = "False", label_on = "True"),
						MaskOptions
					]
				),
				io.DynamicCombo.Option(
					"Structure",
					[
						io.Combo.Input  ("Mode",             default = "Edges", options = ["Edges", "Contours", "Hough Lines"]),
						io.Float.Input  ("Sensitivity",      default = 1.00, min = 0.00, max = 2.00, step = 0.01),
						io.Int.Input    ("Detail Scale",     default = 3,    min = 1,    max = 10,   step = 1),
						io.Boolean.Input("Invert Selection", default = True, label_off = "False", label_on = "True"),
						MaskOptions
					]
				)
			]
		)

		return io.Schema(
			node_id        = "JohnsMaskEditor",
			display_name   = "John's Mask Editor",
			category       = "John's",
			description    = "Semi-Advanced Mask Generator | Manipulator to use as Noise Mask",
			search_aliases = ["noise", "mask"],
			inputs         = [
				io.Autogrow.Input  ("Mask",           template = MaskTemplate),
				io.Image.Input     ("Image"),
				io.Latent.Input    ("Latent",         optional = True),
				io.Boolean.Input   ("InvertMask",     default  = False, label_off = "False", label_on = "True",            display_name = "Invert"),
				io.Boolean.Input   ("FillHoles",      default  = False, label_off = "False", label_on = "True",            display_name = "Fill Holes"),
				io.Int.Input       ("GrowMask",       default  = 0,     min       = -64,     max      = 64,   step = 1,    display_name = "Grow"),
				io.Int.Input       ("BlurMask",       default  = 0,     min       = 0,       max      = 64,   step = 1,    display_name = "Blur"),
				io.Int.Input       ("SmoothEdges",    default  = 0,     min       = 0,       max      = 64,   step = 1,    display_name = "Smooth Edges"),
				io.Boolean.Input   ("InvertAlpha",    default  = False, label_off = "False", label_on = "True",            display_name = "Invert Alpha (For Preview)"),
				io.Float.Input     ("MaskOpacity",    default  = 0.85,  min       = 0.01,    max      = 1.00, step = 0.01, display_name = "Mask Opacity (For Preview)"),
				ModeSelector,
				io.Boolean.Input   ("UsePreset",      default = False, label_off = "False", label_on = "True",             display_name = "Use Preset",    tooltip = "Presets affect backend execution only. Widget values will not visibly change (For Reasons :)"),
				io.Combo.Input     ("PresetSelector", default = "",    options   = GetTitles() or ["No Saved Preset(s)"],  display_name = "Select Preset", tooltip = "Presets affect backend execution only. Widget values will not visibly change (For Reasons :)"),
				io.String.Input    ("PresetTitle",    default = "",    multiline = False,                                  display_name = "Preset Title",  tooltip = "Presets affect backend execution only. Widget values will not visibly change (For Reasons :)")
			],
			outputs = [
				io.Latent.Output ("Latent"),
				io.Mask.Output ("Mask"),
				io.Image.Output("Preview")
			]
		)

	@classmethod
	def execute(
		cls,
		Mask  : io.Autogrow.Type,
		Image : io.Image.Type,
		InvertMask    : bool,
		FillHoles     : bool,
		GrowMask      : int,
		BlurMask      : int,
		SmoothEdges   : int,
		InvertAlpha   : bool,
		MaskOpacity   : float,
		Advanced,
		UsePreset     : bool,
		PresetSelector: str,
		PresetTitle   : str,
		Latent        = None
	) -> io.NodeOutput:
		if UsePreset and PresetSelector:
			preset_data = GetPreset(PresetSelector)
			
			if preset_data:
				InvertMask   = preset_data.get("InvertMask",  InvertMask)
				FillHoles    = preset_data.get("FillHoles",   FillHoles)
				GrowMask     = preset_data.get("GrowMask",    GrowMask)
				BlurMask     = preset_data.get("BlurMask",    BlurMask)
				SmoothEdges  = preset_data.get("SmoothEdges", SmoothEdges)
				InvertAlpha  = preset_data.get("InvertAlpha", InvertAlpha)
				MaskOpacity  = preset_data.get("MaskOpacity", MaskOpacity)
				Advanced     = preset_data.get("Advanced",    Advanced)

		latent_out, mask_out, preview_out = Process(
			Mask             = Mask,
			Image            = Image,
			InvertMask       = InvertMask,
			FillHolesToggle  = FillHoles,
			GrowMaskPixels   = GrowMask,
			BlurMaskPixels   = BlurMask,
			SmoothEdgesSigma = SmoothEdges,
			InvertAlpha      = InvertAlpha,
			MaskOpacity      = MaskOpacity,
			Advanced         = Advanced,
			Latent           = Latent
		)

		preview_mask = mask_out.detach().cpu()
	
		return io.NodeOutput(latent_out, mask_out, preview_out, ui = UI.PreviewMask(preview_mask))
