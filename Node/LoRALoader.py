from __future__ import annotations
import comfy.utils   # type: ignore
import folder_paths  # type: ignore
import json
from comfy_api.latest import io  # type: ignore
from .Backend import LoRALoaderBackend


class JohnsLoRALoader(io.ComfyNode): 
	@classmethod
	def define_schema(cls) -> io.Schema: 
		return io.Schema(
			node_id        = "JohnsLoRALoader",
			display_name   = "John's LoRA Loader",
			category       = "John's",
			description    = "LoRA Loader",
			search_aliases = ["lora", "loader"],
			inputs         = [
				io.Model.Input ("Model"),
				io.Clip.Input  ("Clip"),
				io.String.Input("JohnsLoRALoaderContainer", default = "[]", multiline = True)
			],
			outputs = [
				io.Model.Output("Model"),
				io.Clip.Output ("Clip")
			]
		)

	@classmethod
	def execute(cls, Model, Clip, JohnsLoRALoaderContainer) -> io.NodeOutput: 
		entries = []
		try: 
			parsed = json.loads(JohnsLoRALoaderContainer) if isinstance(JohnsLoRALoaderContainer, str) else []
			if isinstance(parsed, list): 
				entries = parsed
		except Exception: 
			entries = []

		model = Model
		clip  = Clip

		for e in entries: 
			if  not isinstance(e, dict): 
					continue

			name = str(e.get("name", "") or "").strip()

			if not name: 
				continue

			sm = e.get("sm", 0.0)
			sc = e.get("sc", 0.0)

			try: 
				sm = float(sm)
			except Exception: 
				sm = 0.0

			try: 
				sc = float(sc)
			except Exception: 
				sc = 0.0

			if sm == 0.0 and sc == 0.0:
				continue

			full_path = folder_paths.get_full_path("loras", name)
			
			if not full_path: 
				continue

			try: 
				lora        = comfy.utils.load_torch_file(full_path, safe_load = True)
				model, clip = comfy.sd.load_lora_for_models(model, clip, lora, sm, sc)
			except Exception: 
				continue

		return io.NodeOutput(model, clip)
