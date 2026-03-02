from __future__ import annotations
from comfy_api.latest import io  # type: ignore


@io.comfytype(io_type = "TileGuider")
class TileGuider:
	class Input(io.Input):
		def __init__(self, id: str, **kwargs):
			super().__init__(id, **kwargs)

	class Output(io.Output):
		def __init__(self, **kwargs):
			super().__init__(**kwargs)

TileGuider = io.Custom("TileGuider")


@io.comfytype(io_type = "TileSampler")
class TileSampler:
	class Input(io.Input):
		def __init__(self, id: str, **kwargs):
			super().__init__(id, **kwargs)

	class Output(io.Output):
		def __init__(self, **kwargs):
			super().__init__(**kwargs)

TileSampler = io.Custom("TileSampler")


@io.comfytype(io_type = "TileSigmas")
class TileSigmas:
	class Input(io.Input):
		def __init__(self, id: str, **kwargs):
			super().__init__(id, **kwargs)

	class Output(io.Output):
		def __init__(self, **kwargs):
			super().__init__(**kwargs)

TileSigmas = io.Custom("TileSigmas")
