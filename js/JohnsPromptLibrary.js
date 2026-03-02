import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";
import { InsertSpacerAfterWidget } from "./JohnsWidgetHacks.js";
import { ShowToastAtMouse } from "./JohnsToast.js";

const PLACEHOLDER_ADD_NEW_PROMPT  = "Add New Prompt";
const PLACEHOLDER_NO_PROMPTS      = "No Saved Prompts";
const PLACEHOLDER_SELECT_CATEGORY = "Select Category";
const PLACEHOLDER_NO_CATEGORIES   = "No Categories";

(function InjectPromptLibraryStyles() {
	if (document.getElementById("johns-prompt-library")) return;

	const style             = document.createElement("style");
	      style.id          = "johns-prompt-library";
	      style.textContent = `
	textarea.comfy-multiline-input[placeholder="Prompt..."] {
		background-color: rgba(0, 255, 0, 0.08) !important;
		border          : 1px solid rgba(0, 255, 0, 0.6);
		color           : rgba(0, 200, 0, 0.8);
		text-align      : justify;
	}

	textarea.comfy-multiline-input[placeholder="Negative..."] {
		background-color: rgba(255, 0, 0, 0.08) !important;
		border          : 1px solid rgba(255, 0, 0, 0.6);
		color           : rgba(255, 80, 80, 0.8);
		text-align      : justify;
	}

	textarea.comfy-multiline-input[placeholder="Prompt..."]:focus {
		background-color: rgba(0, 255, 0, 0.14) !important;
		font-weight     : bold;
	}

	textarea.comfy-multiline-input[placeholder="Negative..."]:focus {
		background-color: rgba(255, 0, 0, 0.14) !important;
		font-weight     : bold;
	}

	textarea.comfy-multiline-input[placeholder="Prompt..."]::placeholder {
		color: rgba(0, 200, 0, 0.8);
	}

	textarea.comfy-multiline-input[placeholder="Negative..."]::placeholder {
		color: rgba(255, 80, 80, 0.8);
	}
	`;

	document.head.appendChild(style);
})();

function NormalizePath(s) {
	return (s ?? "").toString().split("|").map((p) => p.trim()).filter(Boolean).join("|");
}

function BuildCategoryOptions(paths) {
	const norm = (paths || []).map(NormalizePath).filter(Boolean);
	const all  = new Set();

	for (const p of norm) {
		const parts = p.split("|");

		for (let i = 1; i <= parts.length; i++)
			all.add(parts.slice(0, i).join("|"));
	}

	const arr = [...all].sort((a, b) => {
		const ap = a.split("|"), bp = b.split("|");
		const n  = Math.min(ap.length, bp.length);

		for (let i = 0; i < n; i++) {
			const c = ap[i].localeCompare(bp[i], undefined, {
				sensitivity: "base"
			});

			if (c) return c;
		}

		if (ap.length !== bp.length) return ap.length - bp.length;

		return a.localeCompare(b, undefined, { sensitivity: "base" });
	});

	return arr.map((path) => {
		const depth  = path.split("|").length - 1;
		const name   = path.split("|").slice(-1)[0];
		const indent = "\xa0\xa0\xa0\xa0".repeat(depth);

		//return { value: path, label: `${indent}${name}` };
		return { value: path, label: path };
	});
}

function SetCategoryOptions(categoriesWidget, options) {
	categoriesWidget.Titles         = options;
	categoriesWidget.options.values = options.map((o) => o.label);
}

function LabelToValue(categoriesWidget, label) {
	const hit = (categoriesWidget.Titles || []).find((o) => o.label === label);

	return hit ? hit.value: null;
}

function ValueToLabel(categoriesWidget, value) {
	const hit = (categoriesWidget.Titles || []).find((o) => o.value === value);

	return hit ? hit.label: null;
}

async function FetchCategories() {
	const r = await api.fetchApi("/JohnsProptLibraryCategories");

	if (!r.ok) return HandleApiError(r);

	const data = await r.json();

	return Array.isArray(data.categories) ? data.categories: [];
}

async function FetchTitles(category) {
	const r = await api.fetchApi(`/JohnsProptLibraryPrompts?categories=${encodeURIComponent(category || "")}`);

	if (!r.ok) return HandleApiError(r);

	const data = await r.json();

	return Array.isArray(data.titles) ? data.titles: [];
}

async function FetchPrompt(category, title) {
	const r = await api.fetchApi(`/JohnsProptLibraryPrompt?categories=${encodeURIComponent(category || "")}&title=${encodeURIComponent(title)}`);

	if (!r.ok) return HandleApiError(r);

	return await r.json();
}

async function SavePrompt(category, title, positive, negative) {
	const r = await api.fetchApi("/JohnsProptLibraryPrompt", {
		method : "POST",
		headers: { "Content-Type": "application/json" },
		body   : JSON.stringify({ category, title, positive, negative })
	});

	if (!r.ok) return HandleApiError(r, "Save failed");

	document.dispatchEvent(new CustomEvent("JohnsPromptLibrary:changed"));

	return await r.json().catch(() => ({}));
}

async function DeletePrompt(category, title) {
	const r = await api.fetchApi("/JohnsProptLibraryPrompt", {
		method : "DELETE",
		headers: { "Content-Type": "application/json" },
		body   : JSON.stringify({ category, title })
	});

	if (!r.ok) return HandleApiError(r, "Delete failed");

	document.dispatchEvent(new CustomEvent("JohnsPromptLibrary:changed"));

	return await r.json().catch(() => ({}));
}

function MakeCombo(node, label, initial, onChange, values) {
	const w = node.addWidget(
		"combo",
		label,
		initial,
		async (v) => onChange?.((v ?? "").toString()),
		{ values: values || [initial] }
	);

	w.options.values = values || [initial];
	w.value          = initial;

	return w;
}

function GetWidget(node, name) {
	return (node.widgets || []).find((w) => w.name === name);
}

function SafeNormalize(value) {
	return NormalizePath((value ?? "").toString());
}

function IsPlaceholder(value, ...placeholders) {
	return placeholders.includes((value ?? "").toString());
}

function ClearFormFields(positiveWidget, negativeWidget, titleWidget) {
	positiveWidget.value = "";
	negativeWidget.value = "";
	titleWidget.value    = "";
}

function UpdateFormFromData(data, positiveWidget, negativeWidget, titleWidget, categoryWidget) {
	titleWidget.value    = data.title ?? "";
	positiveWidget.value = (data.positive ?? data.prompt ?? "").toString();
	negativeWidget.value = (data.negative ?? "").toString();
	categoryWidget.value = SafeNormalize(data.category ?? categoryWidget.value);
}

function HandleApiError(response, defaultMessage = "Request failed") {
	return response.json().catch(() => ({})).then((data) => {
			throw new Error(data?.error || defaultMessage);
		});
}

app.registerExtension({
	name: "JohnsPromptLibrary",
	async beforeRegisterNodeDef(nodeType, nodeData) {
		if (nodeData?.name !== "JohnsPromptLibrary") return;

		const onNodeCreated = nodeType.prototype.onNodeCreated;

		nodeType.prototype.onNodeCreated = function () {
			const r              = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
			const categoryWidget = GetWidget(this, "category");
			const titleWidget    = GetWidget(this, "title");
			const positiveWidget = GetWidget(this, "prompt");
			const negativeWidget = GetWidget(this, "negative");
			
			const categoriesWidget = MakeCombo(
				this,
				"Category",
				PLACEHOLDER_SELECT_CATEGORY,
				async (choiceLabel) => {
					if (IsPlaceholder(choiceLabel, PLACEHOLDER_SELECT_CATEGORY, PLACEHOLDER_NO_CATEGORIES))
						return;

					const path = LabelToValue(categoriesWidget, choiceLabel);

					if (!path) return;

					categoryWidget.value = path;

					await RefreshTitles();

					titlesWidget.value = PLACEHOLDER_ADD_NEW_PROMPT;

					ClearFormFields(positiveWidget, negativeWidget, titleWidget);

					this.setDirtyCanvas(true, true);
				},
				[PLACEHOLDER_SELECT_CATEGORY]
			);

			const titlesWidget = MakeCombo(
				this,
				"Prompt",
				PLACEHOLDER_ADD_NEW_PROMPT,
				async (choice) => {
					if (IsPlaceholder(choice, PLACEHOLDER_ADD_NEW_PROMPT, PLACEHOLDER_NO_PROMPTS))
					{
						if (choice === PLACEHOLDER_ADD_NEW_PROMPT)
							ClearFormFields(positiveWidget, negativeWidget, titleWidget);

						this.setDirtyCanvas(true, true);

						return;
					}

					const cat  = SafeNormalize(categoryWidget?.value);
					const data = await FetchPrompt(cat, choice);

					UpdateFormFromData(data, positiveWidget, negativeWidget, titleWidget, categoryWidget);

					categoriesWidget.value = ValueToLabel(categoriesWidget, SafeNormalize(categoryWidget.value)) || PLACEHOLDER_SELECT_CATEGORY;

					this.setDirtyCanvas(true, true);
				},
				[PLACEHOLDER_ADD_NEW_PROMPT]
			);

			const RefreshCategories = async () => {
				const rawCats = (await FetchCategories()).map((c) => SafeNormalize(c)).filter(Boolean);

				if (rawCats.length === 0) {
					SetCategoryOptions(categoriesWidget, [
						{ value: "", label: PLACEHOLDER_NO_CATEGORIES }
					]);

					categoriesWidget.value = PLACEHOLDER_NO_CATEGORIES;
				} else {
					const opts = BuildCategoryOptions(rawCats);

					SetCategoryOptions(categoriesWidget, [
						{ value: "", label: PLACEHOLDER_SELECT_CATEGORY },
						...opts
					]);

					const current          = SafeNormalize(categoryWidget?.value);
					categoriesWidget.value = current ? ValueToLabel(categoriesWidget, current) : PLACEHOLDER_SELECT_CATEGORY;
				}
				this.setDirtyCanvas(true, true);
			};

			const RefreshTitles = async () => {
				const cat    = SafeNormalize(categoryWidget?.value);
				const titles = (await FetchTitles(cat)).map((t) => (t ?? "").toString().trim()).filter(Boolean);

				titlesWidget.options.values = titles.length === 0 ? [PLACEHOLDER_NO_PROMPTS, PLACEHOLDER_ADD_NEW_PROMPT] : [PLACEHOLDER_ADD_NEW_PROMPT, ...titles];

				if (!titles.includes(titlesWidget.value))
					titlesWidget.value = PLACEHOLDER_ADD_NEW_PROMPT;

				this.setDirtyCanvas(true, true);
			};

			const RefreshAll = async () => {
				await RefreshCategories();
				await RefreshTitles();
			};

			const savePromptButton = this.addWidget("button", "Save Prompt", null, async () => {
				try {
					const category = SafeNormalize(categoryWidget?.value);
					const categories = (categoriesWidget?.value ?? "").toString().trim();
					const title = (titleWidget?.value ?? "").toString().trim();
					const titles = (titlesWidget?.value ?? "").toString().trim();
					const positive = (positiveWidget?.value ?? "").toString();
					const negative = (negativeWidget?.value ?? "").toString();

					if (!positive.trim() && !negative.trim()) {
						ShowToastAtMouse("Positive and Negative cannot both be empty", "Error", { app });
						throw new Error("Positive and Negative cannot both be empty.");
					}

					await SavePrompt(category, title, positive, negative);

					const isUpdate = title === titles && category === categories;
					ShowToastAtMouse(isUpdate ? "Prompt Updated" : "Prompt Saved", "Success", { app });
					await RefreshAll();

					if (title && titlesWidget.options.values.includes(title)) {
						titlesWidget.value = title;

						const data = await FetchPrompt(category, title);
						UpdateFormFromData(data, positiveWidget, negativeWidget, titleWidget, categoryWidget);

						categoriesWidget.value = ValueToLabel(categoriesWidget, SafeNormalize(categoryWidget.value)) || PLACEHOLDER_SELECT_CATEGORY;
					} else {
						titlesWidget.value = PLACEHOLDER_ADD_NEW_PROMPT;
					}

					this.setDirtyCanvas(true, true);
				} catch (e) {
					ShowToastAtMouse(`Prompt Save Failed: ${e.message || e}`, "Error", { app });
					console.error(e);
				}
			});

			const deletePromptButton = this.addWidget("button", "Delete Selected", null, async () => {
				try {
					const sel = (titlesWidget.value ?? "").toString();

					if (IsPlaceholder(sel, PLACEHOLDER_ADD_NEW_PROMPT, PLACEHOLDER_NO_PROMPTS) || !sel)
						return;

					const category = SafeNormalize(categoryWidget?.value);

					const confirmed = confirm(`Are you sure you want to delete Prompt "${titlesWidget.value}"?\n\nThis action cannot be undone.`);

					if (!confirmed) return;

					await DeletePrompt(category, sel);
					await RefreshAll();

					titlesWidget.value = PLACEHOLDER_ADD_NEW_PROMPT;

					ClearFormFields(positiveWidget, negativeWidget, titleWidget);
					ShowToastAtMouse("Prompt Deleted", "Error", { app });

					this.setDirtyCanvas(true, true);
				} catch (e) {
					ShowToastAtMouse(`Prompt Delete Failed: ${e.message || e}`, "Error", { app });
					console.error(e);
				}
			});

			function ComputeSaveState() {
				const title      = (titleWidget?.value ?? "").toString().trim();
				const titles     = (titlesWidget?.value ?? "").toString().trim();
				const category   = (categoryWidget?.value ?? "").toString().trim();
				const categories = (categoriesWidget?.value ?? "").toString().trim();
				const positive   = (positiveWidget?.value ?? "").toString().trim();
				const negative   = (negativeWidget?.value ?? "").toString().trim();

				const hasTitle        = title    !== "";
				const hasAnySentiment = positive !== "" || negative !== "";

				const disabled = !(hasTitle && hasAnySentiment);
				const isUpdate = title === titles && category === categories;

				return { disabled, isUpdate };
			}

			savePromptButton.draw = function (ctx, node, width, y, height) {
				ctx.save();

				const { disabled, isUpdate } = ComputeSaveState();

				const margin     = 10;
				const innerWidth = width - margin * 2;

				if (disabled) {
					ctx.fillStyle = "rgba(90, 90, 90, 0.2)";
				} else if (isUpdate) {
					ctx.fillStyle = "rgba(160, 130, 50, 0.6)";
				} else {
					ctx.fillStyle = "rgba(30, 110, 50, 0.6)";
				}
				ctx.fillRect(margin, y, innerWidth, height);

				if (disabled) {
					ctx.strokeStyle = "rgba(255, 140, 140, 0.2)";
				} else if (isUpdate) {
					ctx.strokeStyle = "rgba(160, 130, 50, 1)";
				} else {
					ctx.strokeStyle = "rgba(30, 110, 50, 1)";
				}
				ctx.lineWidth = 1;
				ctx.strokeRect(margin + 0.5, y + 0.5, innerWidth - 1, height - 1);

				ctx.fillStyle    = disabled ? "rgba(255, 255, 255, 0.35)" : "rgba(250, 250, 250, 0.9)";
				ctx.textAlign    = "center";
				ctx.textBaseline = "middle";
				ctx.font         = "12px sans-serif";

				const label = disabled ? PLACEHOLDER_ADD_NEW_PROMPT : isUpdate ? "Update Prompt" : this.name;

				ctx.fillText(label, margin + innerWidth / 2, y + height / 2);

				ctx.restore();
			};

			deletePromptButton.draw = function (ctx, node, width, y, height) {
				ctx.save();

				const sel = (titlesWidget.value ?? "").toString();
				const canDelete = !IsPlaceholder(sel, PLACEHOLDER_ADD_NEW_PROMPT, PLACEHOLDER_NO_PROMPTS) && sel;

				const margin     = 10;
				const innerWidth = width - margin * 2;

				ctx.fillStyle = canDelete ? "rgba(160, 40, 40, 0.35)" : "rgba(90, 90, 90, 0.25)";
				ctx.fillRect(margin, y, innerWidth, height);

				ctx.strokeStyle = canDelete ? "rgba(255,255,255,0.15)" : "rgba(255, 140, 140, 0.2)";
				ctx.lineWidth   = 1;
				ctx.strokeRect(margin + 0.5, y + 0.5, innerWidth - 1, height - 1);

				ctx.fillStyle    = canDelete ? "rgba(250, 250, 250, 0.9)" : "rgba(255, 255, 255, 0.35)";
				ctx.textAlign    = "center";
				ctx.textBaseline = "middle";
				ctx.font         = "12px sans-serif";

				const label = !canDelete ? "No Prompt Selected" : this.name;

				ctx.fillText(label, margin + innerWidth / 2, y + height / 2);

				ctx.restore();
			};

			const spacer = this.addWidget("separator", "", null, null);
			
			spacer.computeSize = () => [0, 6];

			RefreshAll().catch(console.error);

			const onChanged = () => RefreshAll().catch(() => { });

			document.addEventListener("JohnsPromptLibrary:changed", onChanged);

			this.onRemoved = ((orig) =>
				function () {
					try {
						document.removeEventListener("JohnsPromptLibrary:changed", onChanged);
					} catch { }

					return orig ? orig.apply(this, arguments): undefined;
				})(this.onRemoved);
			
			InsertSpacerAfterWidget(this, "Prompt");

			return r;
		};
	}
});
