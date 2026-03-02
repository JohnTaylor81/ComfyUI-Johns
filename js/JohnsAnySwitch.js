import { app } from "/scripts/app.js";
import { AdjustNodeSize } from "./JohnsWidgetHacks.js";

app.registerExtension({
	name: "JohnsAnySwitchUI",
	async beforeRegisterNodeDef(nodeType, nodeData) {
		if (nodeData?.name !== "JohnsAnySwitch") return;

		nodeType.prototype.onNodeCreated = function () {
			AdjustNodeSize(this, { min_width: 300 });
		};
	},
});
