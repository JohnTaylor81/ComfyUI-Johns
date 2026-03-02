import { app } from "/scripts/app.js";

app.registerExtension({
	name: "JohnsRuntimeNumberMinMax",
	async beforeRegisterNodeDef(nodeType, nodeData) {
		const supportedNodes = new Set([
			"JohnsPrimitiveIntMinMax",
			"JohnsPrimitiveIntSliderMinMax",
			"JohnsPrimitiveFloatMinMax",
			"JohnsPrimitiveFloatSliderMinMax"
		]);

		if (!supportedNodes.has(nodeData.name)) return;

		const onNodeCreated = nodeType.prototype.onNodeCreated;

		nodeType.prototype.onNodeCreated = function () {
			if (onNodeCreated) onNodeCreated.apply(this, arguments);

			const valueWidget = this.widgets.find(w => w.name === "Value");
			const minWidget   = this.widgets.find(w => w.name === "Min");
			const maxWidget   = this.widgets.find(w => w.name === "Max");

			if (!valueWidget || !minWidget || !maxWidget) return;

			let lastMin = minWidget.value;
			let lastMax = maxWidget.value;

			const updateConstraints = () => {
				const newMin = minWidget.value;
				const newMax = maxWidget.value;

				const minChanged = newMin !== lastMin;
				const maxChanged = newMax !== lastMax;

				if (minChanged && newMin > newMax) {
					maxWidget.value = newMin;
				}

				if (maxChanged && newMax < newMin) {
					minWidget.value = newMax;
				}

				valueWidget.options.min = minWidget.value;
				valueWidget.options.max = maxWidget.value;

				if (valueWidget.value < minWidget.value) {
					valueWidget.value = minWidget.value;
				} else if (valueWidget.value > maxWidget.value) {
					valueWidget.value = maxWidget.value;
				}

				lastMin = minWidget.value;
				lastMax = maxWidget.value;

				this.setDirtyCanvas(true, true);
			};

			minWidget.callback = updateConstraints;
			maxWidget.callback = updateConstraints;

			updateConstraints();
		};
	}
});
