import { app } from "/scripts/app.js";
import { InsertSpacerAfterWidget, AdjustNodeSize } from "./JohnsWidgetHacks.js";

app.registerExtension({
	name: "JohnsTiledSamplerUI",
	nodeCreated(node) {
		if (node.comfyClass !== "JohnsTiledSampler") return;

		InsertSpacerAfterWidget(node, "GlobalPass");
		InsertSpacerAfterWidget(node, "TraversalMode");
		InsertSpacerAfterWidget(node, "VerticalTiles");
		InsertSpacerAfterWidget(node, "Overlap");
		AdjustNodeSize(node, { min_width: 400, min_height: 800 });
	}
});
