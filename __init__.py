from __future__ import annotations
import os
from typing_extensions import override           # type: ignore
from comfy_api.latest import ComfyExtension, io  # type: ignore
from .Node.Backend.Logger import Console

from .Node.PromptLibrary import JohnsPromptLibrary
from .Node.Pipes import (
	JohnsPipeModel,
	JohnsPipeClip,
	JohnsPipeVAE,
	JohnsPipeNoise,
	JohnsPipeGuider,
	JohnsPipeSampler,
	JohnsPipeSigmas,
	JohnsPipeLatent,
	JohnsPipeImage,
	JohnsPipeMask,
	JohnsPipeConditioning,
	JohnsPipeString,
	JohnsPipeAny,
	JohnsPipeAll
)
from .Node.SetMode import (
	JohnsSetModeByClass,
	JohnsSetModeConnected
)
from .Node.ResolutionCalculator import JohnsResolutionCalculator
from .Node.ImageComparer import JohnsImageComparer
from .Node.LoRALoader import JohnsLoRALoader
from .Node.TiledSampler import (
	JohnsTiledSampler,
	JohnsTileDiffusionMap
)
from .Node.MaskEditor import JohnsMaskEditor
from .Node.Primitives import (
	JohnsPrimitiveInt,
	JohnsPrimitiveIntMinMax,
	JohnsPrimitiveIntSlider,
	JohnsPrimitiveIntSliderMinMax,
	JohnsPrimitiveFloat,
	JohnsPrimitiveFloatP05,
	JohnsPrimitiveFloatP01,
	JohnsPrimitiveFloatMinMax,
	JohnsPrimitiveFloatMinMaxP05,
	JohnsPrimitiveFloatMinMaxP01,
	JohnsPrimitiveFloatSlider,
	JohnsPrimitiveFloatSliderP05,
	JohnsPrimitiveFloatSliderP01,
	JohnsPrimitiveFloatSliderMinMax,
	JohnsPrimitiveFloatSliderMinMaxP05,
	JohnsPrimitiveFloatSliderMinMaxP01,
	JohnsPrimitiveBoolean,
	JohnsPrimitiveString,
	JohnsPrimitiveMultilineString
)
from .Node.MathExpression import JohnsMathExpression
from .Node.AnySwitch import JohnsAnySwitch
from .Node.WorkflowLooper import (
	JohnsWorkflowLoopStart,
	JohnsWorkflowLoopEnd
)
from .Node.Test import (
	JohnsTestNode
)


NODE_LIST = [
	JohnsPromptLibrary,
	JohnsPipeModel,
	JohnsPipeClip,
	JohnsPipeVAE,
	JohnsPipeNoise,
	JohnsPipeGuider,
	JohnsPipeSampler,
	JohnsPipeSigmas,
	JohnsPipeLatent,
	JohnsPipeImage,
	JohnsPipeMask,
	JohnsPipeConditioning,
	JohnsPipeString,
	JohnsPipeAny,
	JohnsPipeAll,
	JohnsSetModeByClass,
	JohnsSetModeConnected,
	JohnsResolutionCalculator,
	JohnsImageComparer,
	JohnsLoRALoader,
	JohnsTiledSampler,
	JohnsTileDiffusionMap,
	JohnsMaskEditor,
	JohnsPrimitiveInt,
	JohnsPrimitiveIntMinMax,
	JohnsPrimitiveIntSlider,
	JohnsPrimitiveIntSliderMinMax,
	JohnsPrimitiveFloat,
	JohnsPrimitiveFloatP05,
	JohnsPrimitiveFloatP01,
	JohnsPrimitiveFloatMinMax,
	JohnsPrimitiveFloatMinMaxP05,
	JohnsPrimitiveFloatMinMaxP01,
	JohnsPrimitiveFloatSlider,
	JohnsPrimitiveFloatSliderP05,
	JohnsPrimitiveFloatSliderP01,
	JohnsPrimitiveFloatSliderMinMax,
	JohnsPrimitiveFloatSliderMinMaxP05,
	JohnsPrimitiveFloatSliderMinMaxP01,
	JohnsPrimitiveBoolean,
	JohnsPrimitiveString,
	JohnsPrimitiveMultilineString,
	JohnsMathExpression,
	JohnsAnySwitch,
	JohnsWorkflowLoopStart,
	JohnsWorkflowLoopEnd,
	JohnsTestNode
]


WEB_DIRECTORY = "./js"


class JohnsExtensions(ComfyExtension): 
	@override
	async def get_node_list(self) -> list[type[io.ComfyNode]]: 
		return NODE_LIST


def JohnsExtensionList():
	Nodes   = len(NODE_LIST)
	Scripts = 0
	WebDir  = os.path.join(os.path.dirname(__file__), WEB_DIRECTORY)

	if os.path.exists(WebDir):
		Scripts = len([f for f in os.listdir(WebDir) if f.endswith('.js')])

	Console("ComfyUI-John's").Log("Loaded {BLUE}{BRIGHT}{nodes}{NORMAL}{INFO} nodes and {YELLOW}{BRIGHT}{scripts}{NORMAL}{INFO} scripts.", nodes = Nodes, scripts = Scripts, label = "INFO", color = "INFO")


async def comfy_entrypoint() -> JohnsExtensions: 
	JohnsExtensionList()
	return JohnsExtensions()

NODE_CLASS_MAPPINGS = {
	node.__name__: node for node in NODE_LIST
}

NODE_DISPLAY_NAME_MAPPINGS = {
	node.__name__: node for node in NODE_LIST
}

JohnsExtensionList()

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
