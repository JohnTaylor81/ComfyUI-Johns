from __future__ import annotations
import os
import time
import numpy             # type: ignore
import torch             # type: ignore
import folder_paths      # type: ignore
from   PIL import Image  # type: ignore
from datetime import datetime
from server import PromptServer  # type: ignore
from comfy_api.latest import io  # type: ignore


def TensorToPIL(img: torch.Tensor) -> Image.Image:
	arr = numpy.clip(255.0 * img[0].cpu().numpy(), 0, 255).astype(numpy.uint8)

	return Image.fromarray(arr)


def SaveLoopOutput(img: torch.Tensor, loop_id: str) -> str:
	input_dir = folder_paths.get_input_directory()
	subdir    = os.path.join(input_dir, "John's Loop")

	os.makedirs(subdir, exist_ok=True)

	ts       = datetime.now().strftime("%Y-%m-%d %H-%M-%S.%f")[:-3]
	filename = f"ID_{loop_id}_{ts}.png"
	path     = os.path.join(subdir, filename)

	TensorToPIL(img).save(path, format = "PNG")

	return f"John's Loop/{filename}"


class JohnsWorkflowLoopStart(io.ComfyNode):
	@classmethod
	def define_schema(cls) -> io.Schema:
		return io.Schema(
			node_id        = "JohnsWorkflowLoopStart",
			display_name   = "Workflow Loop Start",
			category       = "John's/Workflow",
			description    = "You Have To use this in Conjunction with Workflow Loop End\n" \
							 "Plug in the Image output of Your Load Image Node (or close to it ideally)\n" \
							 "Workflow Loop End Node will Automatically Save the Output Image of the Workflow\n" \
							 "This Node will Automatically Set the Load Image to the Saved Image\n" \
							 "Automatically Re-Runs the Workflow the Set Amount of Times\n" \
							 "Saving and Re-Loading the Output Image in each Loop",
			search_aliases = ["workflow", "loop", "image"],
			inputs         = [
				io.Image.Input("Image"),
				io.Int.Input  ("Count", display_name = "Runs", default = 1, min = 1, max = 12, step = 1)
			],
			outputs = [
				io.Image.Output("Image")
			],
			hidden = [
				io.Hidden.unique_id
			]
		)

	@classmethod
	def execute(cls, Image: torch.Tensor, Count: int):
		NodeID = str(cls.hidden.unique_id)

		PromptServer.instance.send_sync(
			"/JohnsWorkflowLoopStart",
			{
				"NodeID"   : NodeID,
				"Count"    : int(Count),
				"TimeStamp": time.time(),
			}
		)

		return io.NodeOutput(Image)


class JohnsWorkflowLoopEnd(io.ComfyNode):
	@classmethod
	def define_schema(cls) -> io.Schema:
		return io.Schema(
			node_id      = "JohnsWorkflowLoopEnd",
			display_name = "Workflow Loop End",
			category     = "John's/Workflow",
			description    = "You Have To use this in Conjunction with Workflow Loop Start\n" \
							 "Plug in the Image output of Your Workflow\n" \
							 "This Node will Automatically Save the Output Image of the Workflow\n" \
							 "Workflow Loop Start Node will Automatically Set the Load Image to the Saved Image\n" \
							 "Automatically Re-Runs the Workflow the Set Amount of Times\n" \
							 "Saving and Re-Loading the Output Image in each Loop",
			search_aliases = ["workflow", "loop", "image"],
			inputs       = [
				io.Image.Input("Image")
			],
			outputs = [
				io.Image.Output("Image")
			],
			hidden = [
				io.Hidden.unique_id
			]
		)

	@classmethod
	def execute(cls, Image: torch.Tensor):
		NodeID  = str(cls.hidden.unique_id)
		RelPath = SaveLoopOutput(Image, NodeID)
		Payload = {
			"NodeID"   : NodeID,
			"RelPath"  : RelPath,
			"TimeStamp": time.time()
		}

		PromptServer.instance.send_sync("/JohnsWorkflowLoopEnd", Payload)
		
		return io.NodeOutput(Image)
