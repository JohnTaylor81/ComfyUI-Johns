import { app } from "/scripts/app.js";
import { InsertSpacerAfterWidget, AdjustNodeSize } from "./JohnsWidgetHacks.js";

const MAX_OUTPUTS = 12;
const TYPE_ALIASES = new Map([
	["i",       "Int"],
	["int",     "Int"],
	["f",       "Float"],
	["float",   "Float"],
	["b",       "Bool"],
	["bool",    "Bool"],
	["boolean", "Bool"]
]);

function parseSocketMeta(outputName) {
	const match = String(outputName || "").match(/^([A-Za-z]+)[ _](\d+)$/);

	if (!match) return null;

	const alias = TYPE_ALIASES.get(match[1].toLowerCase());
	const index = Number.parseInt(match[2], 10);

	if (!Number.isInteger(index)) return null;

	return { type: alias || match[1], index };
}

function normalizeLabel(value) {
	let   label  = String(value || "").trim();
	const quoted = label.match(/^"(.*)"$/) || label.match(/^'(.*)'$/);

	if (quoted) label = quoted[1];

	label = label.trim().replace(/[^\w \-]/g, "").slice(0, 40);

	return label || null;
}

function readBalancedParentheses(text, openIndex) {
	if (text[openIndex] !== "(") return null;

	let depth = 0;
	let quote = null;
	let start = -1;

	for (let i = openIndex; i < text.length; i++) {
		const ch = text[i];

		if (quote) {
			if (ch === "\\") {
				i++;
				continue;
			}
			if (ch === quote) quote = null;
			continue;
		}

		if (ch === "'" || ch === "\"") {
			quote = ch;
			continue;
		}

		if (ch === "(") {
			depth += 1;
			if (depth === 1) start = i + 1;
			continue;
		}

		if (ch === ")") {
			depth -= 1;
			if (depth === 0) {
				return {
					content: text.slice(start, i),
					closeIndex: i
				};
			}
		}
	}

	return null;
}

function splitTopLevelComma(text) {
	const parts = [];
	let   quote = null;
	let   depth = 0;
	let   start = 0;

	for (let i = 0; i < text.length; i++) {
		const ch = text[i];

		if (quote) {
			if (ch === "\\") {
				i++;
				continue;
			}
			if (ch === quote) quote = null;
			continue;
		}

		if (ch === "'" || ch === "\"") {
			quote = ch;
			continue;
		}

		if (ch === "(") {
			depth += 1;
			continue;
		}

		if (ch === ")" && depth > 0) {
			depth -= 1;
			continue;
		}

		if (ch === "," && depth === 0) {
			parts.push(text.slice(start, i));
			start = i + 1;
		}
	}

	parts.push(text.slice(start));
	return parts;
}

function parseAnnotationBody(bodyText) {
	const types = new Set();
	let   label = null;

	for (const rawPart of splitTopLevelComma(bodyText || "")) {
		const part = rawPart.trim();

		if (!part) continue;

		const labelMatch = part.match(/^label\s*=\s*(.+)$/i);

		if (labelMatch) {
			const parsedLabel = normalizeLabel(labelMatch[1]);
			if (parsedLabel) label = parsedLabel;

			continue;
		}

		const canonicalType = TYPE_ALIASES.get(part.toLowerCase());

		if (canonicalType) types.add(canonicalType);
	}

	return { label, types };
}

function parseOutAnnotations(expressionText) {
	const annotations = new Map();

	if (!expressionText) return annotations;

	const headRegex = /\bout_(\d+)\s*\(/gi;
	let match;

	while ((match = headRegex.exec(expressionText)) !== null) {
		const index = Number.parseInt(match[1], 10);

		if (!(index >= 1 && index <= MAX_OUTPUTS)) continue;

		const openParen = headRegex.lastIndex - 1;
		const parsed    = readBalancedParentheses(expressionText, openParen);
		
		if (!parsed) continue;

		annotations.set(index, parseAnnotationBody(parsed.content));
		headRegex.lastIndex = parsed.closeIndex + 1;
	}

	return annotations;
}

function collectReferencedOutputIndices(expressionText) {
	const indices = new Set();
	const regex   = /\bout_(\d+)\b/gi;
	let match;
	while ((match = regex.exec(expressionText)) !== null) {
		const index = Number.parseInt(match[1], 10);

		if (index >= 1 && index <= MAX_OUTPUTS) indices.add(index);
	}

	return indices;
}

function shouldShowOutput(output, annotation, activeIndices, socketMeta) {
	if (!socketMeta) return false;

	const hasLinks = Array.isArray(output.links) && output.links.length > 0;

	if (!annotation) return hasLinks || activeIndices.has(socketMeta.index);

	if (annotation.types.size === 0) return true;

	return annotation.types.has(socketMeta.type);
}

function resolveDisplayLabel(output, socketMeta, annotation) {
	if (output._orig_display_name === undefined) {
		output._orig_display_name = output.display_name || output.name || "";
	}

	if (!annotation?.label) {
		output.localized_name = undefined;
		output.label          = undefined;

		return output._orig_display_name;
	}

	let finalLabel = annotation.label;

	if (annotation.types.size > 1 && socketMeta?.type && annotation.types.has(socketMeta.type)) {
		finalLabel = `${annotation.label} ${socketMeta.type}`;
	}

	output.localized_name = finalLabel;
	output.label          = finalLabel;
	
	return finalLabel;
}

app.registerExtension({
	name: "JohnsMathExpression",
	async beforeRegisterNodeDef(nodeType, nodeData) {
		if (nodeData.name !== "JohnsMathExpression") return;

		const onComputeSize = nodeType.prototype.computeSize;

		nodeType.prototype.computeSize = function () {
			if (this.flags.collapsed) return [this.size[0], 20];

			let size = onComputeSize ? onComputeSize.apply(this, arguments) : [this.size[0], 100];

			const visibleCount = this.outputs ? this.outputs.reduce((n, o) => n + (o._is_hidden === false ? 1 : 0), 0) || 1 : 1;

			size[1] = Math.max(100, (visibleCount * 20) + 80);

			return size;
		};

		nodeType.prototype.updateOutputsFromExpression = function () {
			const expressionWidget = this.widgets?.find((widget) => widget.name === "Expression");
			const expressionText   = String(expressionWidget?.value || "");

			const activeIndices     = collectReferencedOutputIndices(expressionText);
			const annotations       = parseOutAnnotations(expressionText);
			this._johns_annotations = annotations;

			if (activeIndices.size === 0 && annotations.size === 0) activeIndices.add(1);

			let visibleSlot = 0;

			for (const output of this.outputs || []) {
				const socketMeta = parseSocketMeta(output.name);
				const annotation = socketMeta ? annotations.get(socketMeta.index) : null;

				const visible     = shouldShowOutput(output, annotation, activeIndices, socketMeta);
				output._is_hidden = !visible;

				if (visible) output._visual_slot = visibleSlot++;

				output.display_name = resolveDisplayLabel(output, socketMeta, annotation);
			}

			this.setDirtyCanvas(true, true);
		};

		const onDrawForeground = nodeType.prototype.onDrawForeground;
		nodeType.prototype.onDrawForeground = function () {
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

			const widget = this.widgets?.find((w) => w.name === "Expression");
			if (widget) {
				const previousCallback = widget.callback;

				widget.callback = (...args) => {
					if (previousCallback) previousCallback.apply(widget, args);

					this.updateOutputsFromExpression();
				};
			}

			const previousOnWidgetChanged = this.onWidgetChanged;
			
			this.onWidgetChanged = function (...args) {
				if (previousOnWidgetChanged) previousOnWidgetChanged.apply(this, args);
				this.updateOutputsFromExpression();
			};

			setTimeout(() => this.updateOutputsFromExpression(), 20);
		};

		const onConfigure = nodeType.prototype.onConfigure;
		nodeType.prototype.onConfigure = function () {
			if (onConfigure) onConfigure.apply(this, arguments);

			this.updateOutputsFromExpression();
		};
	}
});
