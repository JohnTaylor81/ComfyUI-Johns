from __future__ import annotations
from comfy_api.latest import io  # type: ignore
from .Backend import ImageComparerBackend


class JohnsImageComparer(io.ComfyNode): 
	@classmethod
	def define_schema(cls) -> io.Schema: 
		return io.Schema(
			node_id        = "JohnsImageComparer",
			display_name   = "John's Image Comparer",
			category       = "John's",
			description    = "Compare Two Images",
			search_aliases = ["image", "compare"],
			is_output_node = True,
			inputs         = [
				io.Image.Input("ImageA"),
				io.Image.Input("ImageB")
			],
			outputs = [
				io.Image.Output("ImageA")
			],
			hidden = [
				io.Hidden.unique_id
			]
		)

	@classmethod
	def execute(cls, ImageA, ImageB):
		NodeID = str(cls.hidden.unique_id)
		ImageComparerBackend.CacheAndEmitPreview(NodeID = NodeID, ImageA = ImageA, ImageB = ImageB)

		return io.NodeOutput(ImageA)
