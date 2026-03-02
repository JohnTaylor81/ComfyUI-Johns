import { app } from "/scripts/app.js";
import { InsertSpacerAfterWidget, AdjustNodeSize } from "./JohnsWidgetHacks.js";

app.registerExtension({
	name: "JohnsMathExpression",
	async beforeRegisterNodeDef(nodeType, nodeData) {
		if (nodeData.name !== "JohnsMathExpression") return;

		const onComputeSize = nodeType.prototype.computeSize;
		nodeType.prototype.computeSize = function () {
			if (this.flags.collapsed) return [this.size[0], 20];

			let size = onComputeSize ? onComputeSize.apply(this, arguments) : [this.size[0], 100];

			const visibleCount = this.outputs
				? this.outputs.reduce((n, o) => n + (o._is_hidden === false ? 1 : 0), 0) || 1
				: 1;

			size[1] = Math.max(100, (visibleCount * 20) + 80);

			return size;
		};

		nodeType.prototype.updateOutputsFromExpression = function () {
			const exprWidget = this.widgets.find(w => w.name === "Expression");
			const text = String(exprWidget?.value || "");
			const regexIndices = /\bout_(\d+)\b/gi;
			const typeSpecRegex = /\bout_(\d+)\s*\(\s*(int|i|float|f|bool|b)\s*\)/gi;

			const activeIndices = new Set();
			let match;
			while ((match = regexIndices.exec(text)) !== null) {
				activeIndices.add(parseInt(match[1], 10));
			}

			const typeOverrides = new Map();
			while ((match = typeSpecRegex.exec(text)) !== null) {
				const idx = parseInt(match[1], 10);
				const t = String(match[2] || "").toLowerCase();
				let mapped = null;
				if (t === "int" || t === "i") mapped = "Int";
				if (t === "float" || t === "f") mapped = "Float";
				if (t === "bool" || t === "b") mapped = "Bool";
				if (mapped && idx >= 1 && idx <= 12) typeOverrides.set(idx, mapped);
			}

			if (activeIndices.size === 0 && typeOverrides.size === 0) activeIndices.add(1);

			let visibleIdx = 0;

			this.outputs?.forEach((output) => {
				const nameMatch = output.name.match(/([A-Za-z]+)[ _](\d+)$/);
				const socketType = nameMatch ? String(nameMatch[1]).trim() : null;
				const num = nameMatch ? parseInt(nameMatch[2], 10) : null;
				const hasLinks = Array.isArray(output.links) && output.links.length > 0;

				let shouldBeVisible = false;

				if (num !== null && typeOverrides.has(num)) {
					const override = typeOverrides.get(num);
					shouldBeVisible = (socketType === override);
				} else {
					if (hasLinks) shouldBeVisible = true;
					else if (num !== null && activeIndices.has(num)) shouldBeVisible = true;
					else shouldBeVisible = false;
				}

				output._is_hidden = !shouldBeVisible;

				if (shouldBeVisible) {
					output._visual_slot = visibleIdx++;
				}
			});

			this.setDirtyCanvas(true, true);
		};

		const onDrawForeground = nodeType.prototype.onDrawForeground;
		nodeType.prototype.onDrawForeground = function (ctx) {
			if (this.flags.collapsed) return;

			this.outputs?.forEach((output) => {
				if (output._is_hidden) {
					output.pos = [-100000, -100000];
				} else {
					output.pos = [this.size[0] - 8, (output._visual_slot * 20) + 14];
				}
			});

			if (onDrawForeground) onDrawForeground.apply(this, arguments);
		};

		const onNodeCreated = nodeType.prototype.onNodeCreated;
		nodeType.prototype.onNodeCreated = function () {
			if (onNodeCreated) onNodeCreated.apply(this, arguments);

			InsertSpacerAfterWidget(this, "RoundInt", { height: 5, draw_line: false });
			AdjustNodeSize(this, { min_width: 300, min_height: 200, max_width: 400, max_height: 500 });

			const widget = this.widgets.find(w => w.name === "Expression");
			if (widget) {
				widget.callback = () => this.updateOutputsFromExpression();
			}
			setTimeout(() => this.updateOutputsFromExpression(), 20);
		};

		const onConfigure = nodeType.prototype.onConfigure;
		nodeType.prototype.onConfigure = function () {
			if (onConfigure) onConfigure.apply(this, arguments);

			this.updateOutputsFromExpression();
		};
	}
});
