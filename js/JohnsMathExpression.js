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

		// Helper: parse annotation content inside parentheses for out_N
		function parseOutAnnotation(text) {
			// returns Map: index -> { types: Set("Int"|"Float"|"Bool"), label: string|null }
			const result = new Map();
			if (!text) return result;

			// Match occurrences like: out_1(...) capturing index and inner content
			const outerRegex = /\bout_(\d+)\s*\(\s*([^)]+?)\s*\)/gi;
			let m;
			while ((m = outerRegex.exec(text)) !== null) {
				const idx = parseInt(m[1], 10);
				if (!(idx >= 1 && idx <= 12)) continue;
				const inner = m[2]; // e.g. "I, F, B, label = Width"
				// Split by commas not inside quotes
				const parts = inner.match(/(?:'[^']*'|"[^"]*"|[^,])+/g) || [];
				const types = new Set();
				let label = null;
				for (let raw of parts) {
					raw = raw.trim();
					if (!raw) continue;
					// label assignment: label = value
					const labelMatch = raw.match(/^label\s*=\s*(.+)$/i);
					if (labelMatch) {
						let val = labelMatch[1].trim();
						// strip surrounding quotes if present
						const q = val.match(/^"(.*)"$/) || val.match(/^'(.*)'$/);
						if (q) val = q[1];
						// sanitize: allow letters, digits, space, underscore, hyphen; trim and cap length
						val = String(val).trim().replace(/[^\w \-]/g, '').slice(0, 40);
						if (val.length > 0) label = val;
						continue;
					}
					// type tokens
					const t = raw.toLowerCase();
					if (t === 'i' || t === 'int') types.add('Int');
					else if (t === 'f' || t === 'float') types.add('Float');
					else if (t === 'b' || t === 'bool') types.add('Bool');
					// ignore unknown tokens deterministically
				}
				result.set(idx, { types: types, label: label });
			}
			return result;
		}

		// Update outputs visibility and immediate display_name based on expression annotations
		nodeType.prototype.updateOutputsFromExpression = function () {
			const exprWidget = this.widgets.find(w => w.name === "Expression");
			const text = String(exprWidget?.value || "");

			// indices referenced without parentheses
			const regexIndices = /\bout_(\d+)\b/gi;
			const activeIndices = new Set();
			let match;
			while ((match = regexIndices.exec(text)) !== null) {
				activeIndices.add(parseInt(match[1], 10));
			}

			// parse annotations like out_1 (I, F, label = Width)
			const annotations = parseOutAnnotation(text);

			// If nothing referenced and no annotations, default to index 1 visible
			if (activeIndices.size === 0 && annotations.size === 0) activeIndices.add(1);

			let visibleSlot = 0;

			this.outputs?.forEach((output) => {
				// Accept both "Int_1" and "Int 1"
				const nameMatch = output.name.match(/([A-Za-z]+)[ _](\d+)$/);
				const socketType = nameMatch ? String(nameMatch[1]).trim() : null; // "Int"|"Float"|"Bool"
				const num = nameMatch ? parseInt(nameMatch[2], 10) : null;
				const hasLinks = Array.isArray(output.links) && output.links.length > 0;

				let shouldBeVisible = false;

				// If annotation exists for this index, use it
				if (num !== null && annotations.has(num)) {
					const ann = annotations.get(num);
					// If types specified, only show those types
					if (ann.types && ann.types.size > 0) {
						shouldBeVisible = ann.types.has(socketType);
					} else {
						// no types specified: show all socket types for that index
						shouldBeVisible = true;
					}
				} else {
					// fallback rules
					if (hasLinks) shouldBeVisible = true;
					else if (num !== null && activeIndices.has(num)) shouldBeVisible = true;
					else shouldBeVisible = false;
				}

				output._is_hidden = !shouldBeVisible;

				if (shouldBeVisible) {
					output._visual_slot = visibleSlot++;
				}

				// Apply immediate custom label if present for this index
				if (num !== null && annotations.has(num)) {
					const ann = annotations.get(num);
					if (ann.label) {
						// store custom label for later use
						output.localized_name = ann.label;
						// store original display name once
						if (output._orig_display_name === undefined) output._orig_display_name = output.display_name || output.name || "";
						// If only one type is shown for this index and this socket is that type, show label without suffix
						const onlyOneType = ann.types && ann.types.size === 1;
						if (onlyOneType) {
							// only set label on the socket that matches the single type
							if (ann.types.has(socketType)) output.display_name = ann.label;
							else {
								// other sockets (if visible) keep original name
								if (output._orig_display_name !== undefined) output.display_name = output._orig_display_name;
							}
						} else {
							// multiple types or no types specified: set base label now; final suffixing happens after execution
							output._orig_display_name = output._orig_display_name ?? (output.display_name || output.name || "");
							output.display_name = ann.label;
						}
					} else {
						// no label specified: ensure original name is present
						if (output._orig_display_name !== undefined) output.display_name = output._orig_display_name;
					}
				} else {
					// no annotation for this index: restore original display name if we changed it earlier
					if (output._orig_display_name !== undefined) output.display_name = output._orig_display_name;
				}
			});

			this.setDirtyCanvas(true, true);
		};

		// Update labels after execution; prefer custom label and append runtime value
		function formatSocketValue(v) {
			if (v === null || v === undefined) return null;
			if (typeof v === "boolean") return v ? "True" : "False";
			if (typeof v === "number") {
				if (Number.isInteger(v)) return String(v);
				let s = v.toPrecision(6);
				s = parseFloat(s).toString();
				return s;
			}
			let s = String(v);
			if (s.length > 30) s = s.slice(0, 27) + "...";
			return s;
		}

		nodeType.prototype.updateOutputLabelsFromValues = function () {
			if (!this.outputs) return;

			this.outputs.forEach((output) => {
				if (output._orig_display_name === undefined) output._orig_display_name = output.display_name || output.name || "";

				// read runtime value defensively
				let val = undefined;
				if (output.value !== undefined) val = output.value;
				else if (output._value !== undefined) val = output._value;
				else if (output.links && output.links.length > 0 && output.links[0].value !== undefined) val = output.links[0].value;

				const formatted = formatSocketValue(val);

				// Determine base label: prefer custom label if set, otherwise original
				const baseLabel = output.localized_name ?? output._orig_display_name;

				// If a custom label exists and multiple types are visible for the same index,
				// append type suffix for clarity (unless only one type was requested).
				let finalLabel = baseLabel;

				// Detect if this socket has a type suffix in its name (Int/Float/Bool)
				const typeMatch = output.name.match(/^([A-Za-z]+)[ _](\d+)$/);
				const socketType = typeMatch ? typeMatch[1] : null;

				// If a custom label exists and the original display name was a generic type name,
				// decide whether to append the type suffix:
				if (output.localized_name && socketType) {
					// If the display_name currently equals the custom label and there are other sockets
					// for the same index visible, append the type suffix unless only one type was requested.
					// We detect "only one type requested" by checking if any other output for same index has localized_name same.
					// Simpler deterministic rule: if the original name included the index number, and multiple sockets for that index are visible, append type.
					// Implement: check how many visible sockets share the same index.
					const idxMatch = output.name.match(/(\d+)$/);
					let idx = idxMatch ? idxMatch[1] : null;
					let visibleCountForIndex = 0;
					if (idx) {
						this.outputs.forEach(o => {
							const nm = o.name;
							if (nm && nm.endsWith(` ${idx}`) || nm && nm.endsWith(`_${idx}`)) {
								if (!o._is_hidden) visibleCountForIndex++;
							}
						});
					}
					// If more than one visible socket for this index, append type suffix
					if (visibleCountForIndex > 1 && socketType) finalLabel = `${baseLabel} ${socketType}`;
					else finalLabel = baseLabel;
				}

				if (formatted !== null) {
					output.display_name = `${finalLabel} ( ${formatted} )`;
				} else {
					output.display_name = finalLabel;
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
