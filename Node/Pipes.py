from __future__ import annotations
from comfy_api.latest import io  # type: ignore


class JohnsPipeModel(io.ComfyNode): 
	@classmethod
	def define_schema(cls) -> io.Schema: 
		return io.Schema(
			node_id        = "JohnsPipeModel",
			display_name   = "Model Pipe",
			category       = "John's/Pipes",
			description    = "Re-Route | Pipe | Passthrough",
			search_aliases = ["pipe", "reroute", "passthrough", "model"],
			inputs         = [
				io.Model.Input("Model")
			],
			outputs = [
				io.Model.Output("Model")
			]
		)

	@classmethod
	def execute(cls, Model) -> io.NodeOutput: 
		return io.NodeOutput(Model)


class JohnsPipeClip(io.ComfyNode): 
	@classmethod
	def define_schema(cls) -> io.Schema: 
		return io.Schema(
			node_id        = "JohnsPipeClip",
			display_name   = "Clip Pipe",
			category       = "John's/Pipes",
			description    = "Re-Route | Pipe | Passthrough",
			search_aliases = ["pipe", "reroute", "passthrough", "clip"],
			inputs         = [
				io.Clip.Input("Clip")
			],
			outputs = [
				io.Clip.Output("Clip")
			]
		)

	@classmethod
	def execute(cls, Clip) -> io.NodeOutput: 
		return io.NodeOutput(Clip)


class JohnsPipeVAE(io.ComfyNode): 
	@classmethod
	def define_schema(cls) -> io.Schema: 
		return io.Schema(
			node_id        = "JohnsPipeVAE",
			display_name   = "VAE Pipe",
			category       = "John's/Pipes",
			description    = "Re-Route | Pipe | Passthrough",
			search_aliases = ["pipe", "reroute", "passthrough", "vae"],
			inputs         = [
				io.Vae.Input("VAE")
			],
			outputs = [
				io.Vae.Output("VAE")
			]
		)

	@classmethod
	def execute(cls, VAE) -> io.NodeOutput: 
		return io.NodeOutput(VAE)


class JohnsPipeNoise(io.ComfyNode): 
	@classmethod
	def define_schema(cls) -> io.Schema: 
		return io.Schema(
			node_id        = "JohnsPipeNoise",
			display_name   = "Noise Pipe",
			category       = "John's/Pipes",
			description    = "Re-Route | Pipe | Passthrough",
			search_aliases = ["pipe", "reroute", "passthrough", "noise"],
			inputs         = [
				io.Noise.Input("Noise")
			],
			outputs = [
				io.Noise.Output("Noise")
			]
		)

	@classmethod
	def execute(cls, Noise) -> io.NodeOutput: 
		return io.NodeOutput(Noise)


class JohnsPipeGuider(io.ComfyNode): 
	@classmethod
	def define_schema(cls) -> io.Schema: 
		return io.Schema(
			node_id        = "JohnsPipeGuider",
			display_name   = "Guider Pipe",
			category       = "John's/Pipes",
			description    = "Re-Route | Pipe | Passthrough",
			search_aliases = ["pipe", "reroute", "passthrough", "guider"],
			inputs         = [
				io.Guider.Input("Guider")
			],
			outputs = [
				io.Guider.Output("Guider")
			]
		)

	@classmethod
	def execute(cls, Guider) -> io.NodeOutput: 
		return io.NodeOutput(Guider)


class JohnsPipeSampler(io.ComfyNode): 
	@classmethod
	def define_schema(cls) -> io.Schema: 
		return io.Schema(
			node_id        = "JohnsPipeSampler",
			display_name   = "Sampler Pipe",
			category       = "John's/Pipes",
			description    = "Re-Route | Pipe | Passthrough",
			search_aliases = ["pipe", "reroute", "passthrough", "sampler"],
			inputs         = [
				io.Sampler.Input("Sampler")
			],
			outputs = [
				io.Sampler.Output("Sampler")
			]
		)

	@classmethod
	def execute(cls, Sampler) -> io.NodeOutput: 
		return io.NodeOutput(Sampler)


class JohnsPipeSigmas(io.ComfyNode): 
	@classmethod
	def define_schema(cls) -> io.Schema: 
		return io.Schema(
			node_id        = "JohnsPipeSigmas",
			display_name   = "Sigmas Pipe",
			category       = "John's/Pipes",
			description    = "Re-Route | Pipe | Passthrough",
			search_aliases = ["pipe", "reroute", "passthrough", "sigmas", "scheduler", "steps", "denoise"],
			inputs         = [
				io.Sigmas.Input("Sigmas")
			],
			outputs = [
				io.Sigmas.Output("Sigmas")
			]
		)

	@classmethod
	def execute(cls, Sigmas) -> io.NodeOutput: 
		return io.NodeOutput(Sigmas)


class JohnsPipeLatent(io.ComfyNode): 
	@classmethod
	def define_schema(cls) -> io.Schema: 
		return io.Schema(
			node_id        = "JohnsPipeLatent",
			display_name   = "Latent Pipe",
			category       = "John's/Pipes",
			description    = "Re-Route | Pipe | Passthrough",
			search_aliases = ["pipe", "reroute", "passthrough", "latent"],
			inputs         = [
				io.Latent.Input("Latent")
			],
			outputs = [
				io.Latent.Output("Latent")
			]
		)

	@classmethod
	def execute(cls, Latent) -> io.NodeOutput: 
		return io.NodeOutput(Latent)


class JohnsPipeImage(io.ComfyNode): 
	@classmethod
	def define_schema(cls) -> io.Schema: 
		return io.Schema(
			node_id        = "JohnsPipeImage",
			display_name   = "Image Pipe",
			category       = "John's/Pipes",
			description    = "Re-Route | Pipe | Passthrough",
			search_aliases = ["pipe", "reroute", "passthrough", "image"],
			inputs         = [
				io.Image.Input("Image")
			],
			outputs = [
				io.Image.Output("Image")
			]
		)

	@classmethod
	def execute(cls, Image) -> io.NodeOutput: 
		return io.NodeOutput(Image)


class JohnsPipeMask(io.ComfyNode): 
	@classmethod
	def define_schema(cls) -> io.Schema: 
		return io.Schema(
			node_id        = "JohnsPipeMask",
			display_name   = "Mask Pipe",
			category       = "John's/Pipes",
			description    = "Re-Route | Pipe | Passthrough",
			search_aliases = ["pipe", "reroute", "passthrough", "mask"],
			inputs         = [
				io.Mask.Input("Mask")
			],
			outputs=[
				io.Mask.Output("Mask")
			]
		)

	@classmethod
	def execute(cls, Mask) -> io.NodeOutput: 
		return io.NodeOutput(Mask)


class JohnsPipeConditioning(io.ComfyNode): 
	@classmethod
	def define_schema(cls) -> io.Schema: 
		return io.Schema(
			node_id        = "JohnsPipeConditioning",
			display_name   = "Conditioning Pipe",
			category       = "John's/Pipes",
			description    = "Re-Route | Pipe | Passthrough",
			search_aliases = ["pipe", "reroute", "passthrough", "conditioning", "clip", "text", "encode", "prompt", "positive", "negative"],
			inputs         = [
				io.Conditioning.Input("Conditioning")
			],
			outputs = [
				io.Conditioning.Output("Conditioning")
			]
		)

	@classmethod
	def execute(cls, Conditioning) -> io.NodeOutput: 
		return io.NodeOutput(Conditioning)


class JohnsPipeString(io.ComfyNode): 
	@classmethod
	def define_schema(cls) -> io.Schema: 
		return io.Schema(
			node_id        = "JohnsPipeString",
			display_name   = "String Pipe",
			category       = "John's/Pipes",
			description    = "Re-Route | Pipe | Passthrough",
			search_aliases = ["pipe", "reroute", "passthrough", "string", "text", "prompt", "positive", "negative"],
			inputs         = [
				io.String.Input("String", force_input = True)
			],
			outputs = [
				io.String.Output("String")
			]
		)

	@classmethod
	def execute(cls, String) -> io.NodeOutput: 
		return io.NodeOutput(String)


class JohnsPipeAny(io.ComfyNode): 
	@classmethod
	def define_schema(cls) -> io.Schema: 
		return io.Schema(
			node_id        = "JohnsPipeAny",
			display_name   = "Any Pipe",
			category       = "John's/Pipes",
			description    = "Re-Route | Pipe | Passthrough",
			search_aliases = ["pipe", "reroute", "passthrough", "any"],
			inputs         = [
				io.AnyType.Input("AnyInput")
			],
			outputs = [
				io.AnyType.Output("Output")
			]
		)

	@classmethod
	def execute(cls, AnyInput) -> io.NodeOutput: 
		return io.NodeOutput(AnyInput)


class JohnsPipeAll(io.ComfyNode): 
	@classmethod
	def define_schema(cls) -> io.Schema: 
		return io.Schema(
			node_id        = "JohnsPipeAll",
			display_name   = "Pipe All*",
			category       = "John's/Pipes",
			description    = "Re-Route | Pipe | Passthrough",
			search_aliases = ["pipe", "reroute", "passthrough", "model", "clip", "vae", "latent", "image", "mask", "prompt", "negative", "prompt", "positive", "negative"],
			inputs         = [
				io.Model.Input ("Model",    optional = True),
				io.Clip.Input  ("Clip",     optional = True),
				io.Vae.Input   ("VAE",      optional = True),
				io.Latent.Input("Latent",   optional = True),
				io.Image.Input ("Image",    optional = True),
				io.Mask.Input  ("Mask",     optional = True),
				io.String.Input("Prompt",   optional = True, force_input = True),
				io.String.Input("Negative", optional = True, force_input = True)
			],
			outputs = [
				io.Model.Output ("Model"),
				io.Clip.Output  ("Clip"),
				io.Vae.Output   ("VAE"),
				io.Latent.Output("Latent"),
				io.Image.Output ("Image"),
				io.Mask.Output  ("Mask"),
				io.String.Output("Prompt"),
				io.String.Output("Negative")
			]
		)

	@classmethod
	def execute(cls, Model = None, Clip = None, VAE = None, Latent = None, Image = None, Mask = None, Prompt = None, Negative = None) -> io.NodeOutput: 
		return io.NodeOutput(Model, Clip, VAE, Latent, Image, Mask, Prompt, Negative)
