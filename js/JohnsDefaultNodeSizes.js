import { app } from "/scripts/app.js";

app.registerExtension({
	name: "JohnsDefaultNodeSizes",
	async nodeCreated(node) {
		const JohnsNodeSizes = {
			"JohnsPromptLibrary"             : [400, 500],
			"JohnsPipeAll"                   : [200, 170],
			"SmallPipeNodes"                 : [200, 30],
			"JohnsSetModeByClass"            : [350, 60],
			"JohnsSetModeConnected"          : [350, 60],
			"JohnsResolutionCalculator"      : [350, 200],
			"JohnsAnySwitch"                 : [300, 60],
			"JohnsImageComparer"             : [300, 330],
			"JohnsLoRALoader"                : [500, 300],
			"JohnsTiledSampler"              : [400, 800],
			"JohnsTileDiffusionMap"          : [400, 600],
			"JohnsMaskEditor"                : [400, 820],
			"JohnsPrimitiveMultilineString"  : [400, 200],
			"JohnsPrimitiveIntMinMax"        : [250, 110],
			"JohnsPrimitiveIntSliderMinMax"  : [250, 110],
			"JohnsPrimitiveFloatMinMax"      : [250, 110],
			"JohnsPrimitiveFloatSliderMinMax": [250, 110],
			"SmallPrimitiveNodes"            : [250, 60],
			"JohnsMathExpression"            : [300, 200],
			"JohnsWorkflowLoopStart"         : [250, 60],
			"JohnsWorkflowLoopEnd"           : [250, 30]
		};

		let size = JohnsNodeSizes[node.comfyClass];

		if (!size) {
			if (node.comfyClass.startsWith("JohnsPipe")) {
				size = JohnsNodeSizes["SmallPipeNodes"];
			} else if (node.comfyClass.startsWith("JohnsPrimitive")) {
				size = JohnsNodeSizes["SmallPrimitiveNodes"];
			}
		}

		if (size) {
			node.size = size;
		}
	}
});
