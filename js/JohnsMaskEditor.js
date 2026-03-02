import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";
import { InsertSpacerAfterWidget, AdjustNodeSize } from "./JohnsWidgetHacks.js";
import { ShowToastAtMouse } from "./JohnsToast.js";

app.registerExtension({
	name: "JohnsMaskEditorPresets",
	async beforeRegisterNodeDef(nodeType, nodeData) {
		if (nodeData?.name !== "JohnsMaskEditor") return;

		const EMPTY_LABEL = "No Saved Preset(s)";

		const onNodeCreated = nodeType.prototype.onNodeCreated;

		nodeType.prototype.onNodeCreated = function () {
			const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;

			const widget = (name) =>
				(this.widgets || []).find((w) => w.name === name);

			const presetSelector = widget("PresetSelector");
			const presetTitle    = widget("PresetTitle");

			let isEmptyState = false;
			let isUpdateMode = false;
			let isTitleEmpty = true;

			let saveButtonWidget = null;

			const UpdateSaveButtonState = () => {
				if (!saveButtonWidget || !presetTitle || !presetSelector) return;

				const title    = presetTitle.value?.trim();
				const selected = presetSelector.value;

				isTitleEmpty = !title;
				isUpdateMode = !isEmptyState && title && selected && title === selected;

				saveButtonWidget.name = isUpdateMode ? "Update Preset" : "Save Preset";

				this.setDirtyCanvas(true, true);
			};

			if (presetSelector) {
				const originalCallback = presetSelector.callback;

				presetSelector.callback = function (value) {
					if (isEmptyState) {
						this.value = EMPTY_LABEL;
						return;
					}

					if (presetTitle && value && value !== EMPTY_LABEL) {
						presetTitle.value = value;
					}

					if (originalCallback) {
						originalCallback.call(this, value);
					}

					UpdateSaveButtonState();
				};
			}

			if (presetTitle) {
				const originalTitleCallback = presetTitle.callback;

				presetTitle.callback = function (v) {
					if (originalTitleCallback) {
						originalTitleCallback.call(this, v);
					}
					UpdateSaveButtonState();
				};
			}

			const RefreshPresets = async (selectTitle = null) => {
				const r = await api.fetchApi("/JohnsMaskEditorPresets");
				if (!r.ok) return;

				const data = await r.json();
				let titles = Array.isArray(data.titles) ? data.titles : [];

				titles.sort((a, b) =>
					a.localeCompare(b, undefined, { sensitivity: "base" })
				);

				if (!presetSelector) return;

				if (titles.length === 0) {
					isEmptyState = true;
					presetSelector.options.values = [EMPTY_LABEL];
					presetSelector.value = EMPTY_LABEL;
				} else {
					isEmptyState = false;
					presetSelector.options.values = titles;

					if (selectTitle && titles.includes(selectTitle)) {
						presetSelector.value = selectTitle;
					} else if (!titles.includes(presetSelector.value)) {
						presetSelector.value = titles[0];
					}
				}

				UpdateSaveButtonState();
				this.setDirtyCanvas(true, true);
			};

			const CollectPresetPayload = () => {
				const out = {};
				const advancedChildren = {};
				let advancedMode = null;

				for (const w of this.widgets) {
					if (!w?.name) continue;
					if (w.type === "button") continue;
					if (w.name.startsWith("$$")) continue;
					if (["PresetSelector", "PresetTitle", "UsePreset"].includes(w.name)) continue;

					if (w.name === "Advanced") {
						advancedMode = w.value;
					} else if (w.name.startsWith("Advanced.")) {
						const childName = w.name.substring("Advanced.".length);
						advancedChildren[childName] = structuredClone(w.value);
					} else {
						out[w.name] = structuredClone(w.value);
					}
				}

				if (advancedMode) {
					out["Advanced"] = {
						Advanced: advancedMode,
						...advancedChildren
					};
				}

				return out;
			};

			saveButtonWidget = this.addWidget("button", "Save Preset", null, async () => {
				const title = (presetTitle?.value ?? "").toString().trim();
				if (!title) return;
				const wasUpdateMode = isUpdateMode;

				await api.fetchApi("/JohnsMaskEditorPreset", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						title,
						payload: CollectPresetPayload()
					})
				});

				await RefreshPresets(title);
				
				ShowToastAtMouse(wasUpdateMode ? "Preset Updated" : "Preset Saved", "Success", { app });
			});
			
			const deleteButtonWidget = this.addWidget("button", "Delete Preset", null, async () => {
				const title = (presetSelector?.value ?? "").toString();

				if (!title || title === EMPTY_LABEL || isEmptyState) return;

				const confirmed = confirm(`Are you sure you want to delete Preset "${title}"?\n\nThis action cannot be undone.`);

				if (!confirmed) return;

				await api.fetchApi("/JohnsMaskEditorPreset", {
					method: "DELETE",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ title })
				});

				if (presetTitle) presetTitle.value = "";

				await RefreshPresets();

				ShowToastAtMouse("Preset Deleted", "Error", { app });
			});

			saveButtonWidget.draw = function (ctx, node, width, y, height) {
				ctx.save();

				const margin     = 10;
				const innerWidth = width - margin * 2;

				if (isUpdateMode) {
					ctx.fillStyle = "rgba(160, 130, 50, 0.6)";
				} else if (!isTitleEmpty) {
					ctx.fillStyle = "rgba(30, 110, 50, 0.6)";
				} else {
					ctx.fillStyle = "rgba(90, 90, 90, 0.2)";
				}
				ctx.fillRect(margin, y, innerWidth, height);

				if (isUpdateMode) {
					ctx.strokeStyle = "rgba(160, 130, 50, 1)";
				} else if (!isTitleEmpty) {
					ctx.strokeStyle = "rgba(30, 110, 50, 1)";
				} else {
					ctx.strokeStyle = "rgba(255, 140, 140, 0.2)";
				}
				ctx.lineWidth   = 1;
				ctx.strokeRect(margin + 0.5, y + 0.5, innerWidth - 1, height - 1);

				ctx.fillStyle = isTitleEmpty ? "rgba(255, 255, 255, 0.35)" : "rgba(250, 250, 250, 0.9)";
				ctx.textAlign    = "center";
				ctx.textBaseline = "middle";
				ctx.font         = "12px sans-serif";
				ctx.fillText(this.name, margin + innerWidth / 2, y + height / 2);

				ctx.restore();
			};

			deleteButtonWidget.draw = function (ctx, node, width, y, height) {
				ctx.save();
				const canDelete = !isEmptyState && presetSelector?.value && presetSelector.value !== EMPTY_LABEL;

				const margin     = 10;
				const innerWidth = width - margin * 2;

				ctx.fillStyle = canDelete ? "rgba(160, 40, 40, 0.35)" : "rgba(90, 90, 90, 0.25)";
				ctx.fillRect(margin, y, innerWidth, height);

				ctx.strokeStyle = canDelete ? "rgba(255,255,255,0.15)" : "rgba(255, 140, 140, 0.2)";
				ctx.lineWidth   = 1;
				ctx.strokeRect(margin + 0.5, y + 0.5, innerWidth - 1, height - 1);

				ctx.fillStyle    = !canDelete ? "rgba(255, 255, 255, 0.35)" : "rgba(250, 250, 250, 0.9)";
				ctx.textAlign    = "center";
				ctx.textBaseline = "middle";
				ctx.font         = "12px sans-serif";
				ctx.fillText(this.name, margin + innerWidth / 2, y + height / 2);

				ctx.restore();
			};

			InsertSpacerAfterWidget(this, "SmoothEdges");
			InsertSpacerAfterWidget(this, "MaskOpacity");
			InsertSpacerAfterWidget(this, "Advanced");
			InsertSpacerAfterWidget(this, "PresetTitle");
			AdjustNodeSize(this, { min_width: 400, min_height: 820 });

			RefreshPresets().catch(() => { });

			return r;
		};
	},
});
