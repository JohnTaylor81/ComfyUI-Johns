from __future__ import annotations
from comfy_api.latest import io  # type: ignore
from .Backend import TiledSamplerBackend
from .Backend import TileDiffusionMapBackend
from .Backend import CustomTypes


class JohnsTiledSampler(io.ComfyNode):
	@classmethod
	def define_schema(cls) -> io.Schema:
		GlobalPass  = io.DynamicCombo.Input(
			"GlobalPass",
			display_name = "Global Pass",
			options = [
				io.DynamicCombo.Option("Disable", []),
				io.DynamicCombo.Option(
					"Enable",
					[
						io.Float.Input  ("Target Megapixel",          default = 1.00, min = 1.00, max = 4.00, step = 0.01),
						io.Float.Input  ("Global Blend Strength",     default = 0.30, min = 0.00, max = 1.00, step = 0.01),
						io.Float.Input  ("Boundary Context Strength", default = 0.30, min = 0.00, max = 1.00, step = 0.01)
					]
				)
			]
		)

		return io.Schema(
			node_id        = "JohnsTiledSampler",
			display_name   = "John's Tiled Sampler",
			category       = "John's/Sampling",
			description    = "Tiled Sampler\nUse the John's Tile Diffusion Map Helper Node for Full Control",
			search_aliases = ["tiled", "sampler"],
			inputs         = [
				io.Noise.Input  ("Noise"),
				io.Guider.Input ("Guider",  display_name = "Global Guider"),
				io.Sampler.Input("Sampler", display_name = "Global Sampler"),
				io.Sigmas.Input ("Sigmas",  display_name = "Global Sigmas"),
				io.Latent.Input ("Latent"),
				GlobalPass,
				io.Combo.Input  ("TraversalMode",   display_name = "Traversal Mode",    default = "Horizontal Serpentine", options = ["Horizontal Serpentine", "Vertical Serpentine", "Row-Major", "Column-Major"]),
				io.Int.Input    ("HorizontalTiles", display_name = "Horizontal Tiles:", default = 2,    min = 1,    max = 8,   step = 1,                  display_mode = io.NumberDisplay.slider),
				io.Int.Input    ("VerticalTiles",   display_name = "Vertical Tiles:",   default = 2,    min = 1,    max = 8,   step = 1,                  display_mode = io.NumberDisplay.slider),
				io.Float.Input  ("Overlap",         display_name = "Overlap:",          default = 0.10, min = 0.0,  max = 0.5, step = 0.01, round = 0.01, display_mode = io.NumberDisplay.slider),
				io.Combo.Input  ("SeamRefinement",  display_name = "Seam Refinement",   default = "Seams with Intersections", options = ["None", "Seams", "Seams with Intersections", "Intersections"]),
				io.Float.Input  ("SeamStrength",    display_name = "Seam Strength:",    default = 0.50, min = 0.01, max = 1.0, step = 0.01, round = 0.01, display_mode = io.NumberDisplay.slider),
				io.Float.Input  ("SeamSteps",       display_name = "Seam Steps:",       default = 0.50, min = 0.10, max = 1.0, step = 0.01, round = 0.01, display_mode = io.NumberDisplay.slider),
				CustomTypes.TileGuider.Input ("TileGuiderMap",  display_name = "Guider Map",  optional = True, tooltip = "John's Tile Diffusion Map Node's Guider Map Output goes here"),
				CustomTypes.TileSampler.Input("TileSamplerMap", display_name = "Sampler Map", optional = True, tooltip = "John's Tile Diffusion Map Node's Sampler Map Output goes here"),
				CustomTypes.TileSigmas.Input ("TileSigmasMap",  display_name = "Sigmas Map",  optional = True, tooltip = "John's Tile Diffusion Map Node's Sigmas Map Output goes here")
			],
			outputs      = [
				io.Latent.Output("Latent")
			]
		)

	@classmethod
	def execute(
		cls,
		Noise,
		Guider,
		Sampler,
		Sigmas,
		Latent,
		GlobalPass,
		TraversalMode  : str   = "Horizontal Serpentine",
		HorizontalTiles: int   = 2,
		VerticalTiles  : int   = 2,
		Overlap        : float = 0.10,
		SeamRefinement : str   = "Seams with Intersections",
		SeamStrength   : float = 0.50,
		SeamSteps      : float = 0.50,
		TileGuiderMap  = None,
		TileSamplerMap = None,
		TileSigmasMap  = None
	) -> io.NodeOutput:
		latent = TiledSamplerBackend.JohnsTiledSampler(
			Noise,
			Guider,
			Sampler,
			Sigmas,
			Latent,
			str  (TraversalMode),
			int  (HorizontalTiles),
			int  (VerticalTiles),
			float(Overlap),
			str  (SeamRefinement),
			float(SeamStrength),
			float(SeamSteps),
			TileGuiderMap,
			TileSamplerMap,
			TileSigmasMap
		)
		return io.NodeOutput(latent)


class JohnsTileDiffusionMap(io.ComfyNode):
	@classmethod
	def define_schema(cls) -> io.Schema:
		GuiderTemplate  = io.Autogrow.TemplatePrefix(io.Guider.Input ("TileGuider",  optional = True), prefix = "G", min = 1, max = 64)
		SamplerTemplate = io.Autogrow.TemplatePrefix(io.Sampler.Input("TileSampler", optional = True), prefix = "S", min = 1, max = 64)
		SigmasTemplate  = io.Autogrow.TemplatePrefix(io.Sigmas.Input ("TileSigmas",  optional = True), prefix = "I", min = 1, max = 64)

		return io.Schema(
			node_id        = "JohnsTileDiffusionMap",
			display_name   = "John's Tile Diffusion Map",
			category       = "John's/Sampling",
			description    = "Collects Guiders, Samplers and Sigmas that John's Tiled Sampler consumes in Sequential Order Unless Retargeting Rules Specified\n" \
							 "Guiders, Samplers and Sigmas are Independent, i.e. You do NOT have to provide all three\n" \
							 "Retargeting is Independent, i.e. You do can retarget Anything to Anything\n" \
							 "Fallback Policy:\n" \
							 "Tiles with No Guiders assigned to them use Global Guider\n" \
							 "Tiles with No Samplers assigned to them use Global Sampler\n" \
							 "Tiles with No Sigmas assigned to them use Global Sigmas\n" \
							 "Invalid | Out Of Range Retarget rules Ignored and fall back to Global Guider | Sampler | Sigmas",
			search_aliases = ["tiled", "sampler", "map", "helper", "guider", "sigmas"],
			inputs         = [
				io.Image.Input   ("OverlayImage",    display_name = "Overlay Image", optional = True),
				io.Autogrow.Input("TileGuider",      template     = GuiderTemplate),
				io.Autogrow.Input("TileSampler",     template     = SamplerTemplate),
				io.Autogrow.Input("TileSigmas",      template     = SigmasTemplate),
				io.Combo.Input   ("TraversalMode",   display_name = "Traversal Mode",    default = "Horizontal Serpentine", options = ["Horizontal Serpentine", "Vertical Serpentine", "Row-Major", "Column-Major"]),
				io.Int.Input     ("HorizontalTiles", display_name = "Horizontal Tiles:", default = 2, min = 1, max = 8, display_mode = io.NumberDisplay.slider),
				io.Int.Input     ("VerticalTiles",   display_name = "Vertical Tiles:",   default = 2, min = 1, max = 8, display_mode = io.NumberDisplay.slider),
				io.Combo.Input   ("SeamRefinement",  display_name = "Seam Refinement",   default = "Seams with Intersections",  options = ["None", "Seams", "Seams with Intersections", "Intersections"]),
				io.Combo.Input   ("CropRegions",     display_name = "Cropped Regions",   default = "Disable", options = ["Disable", "Tiles Only", "Tiles and Seams Only", "Tiles, Seams and Intersections"]),
				io.String.Input  ("Retarget",        tooltip      = "Usage Example:\nG0 = T1\nG1 = T4\nS0 = T7\nS1 = T1\nI0 = T3", multiline = True, optional = True)
			],
			outputs = [
				CustomTypes.TileGuider.Output ("TileGuiderMap",  display_name = "Guider Map"),
				CustomTypes.TileSampler.Output("TileSamplerMap", display_name = "Sampler Map"),
				CustomTypes.TileSigmas.Output ("TileSigmasMap",  display_name = "Sigma Map"),
				io.Image.Output("OverlayCombined",               display_name = "Combined Overlay"),
				io.Image.Output("OverlayTiles",                  display_name = "Tiles Overlay"),
				io.Image.Output("OverlaySeams",                  display_name = "Seams Overlay"),
				io.Image.Output("OverlayIntersections",          display_name = "Intersections Overlay"),
				io.Image.Output("CropRegions",                   display_name = "Cropped Regions")
			]
		)

	@classmethod
	def execute(
		cls,
		OverlayImage         = None,
		TileGuider           = None,
		TileSampler          = None,
		TileSigmas           = None,
		TraversalMode  : str = "Horizontal Serpentine",
		HorizontalTiles: int = 2,
		VerticalTiles  : int = 2,
		SeamRefinement : str = "Seams with Intersections",
		CropRegions    : str = "Disable",
		Retarget       : str = None
	) -> io.NodeOutput:
		out_guider, out_sampler, out_sigmas, overlay, crops = TileDiffusionMapBackend.Run(
			TileGuider,
			TileSampler,
			TileSigmas,
			TraversalMode,
			CropRegions,
			HorizontalTiles,
			VerticalTiles,
			SeamRefinement,
			Retarget,
			OverlayImage
		)

		return io.NodeOutput(out_guider, out_sampler, out_sigmas, overlay[0], overlay[1], overlay[2], overlay[3], crops)
