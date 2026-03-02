export const JOHNS_SETTINGS_EVENT = "JohnsSettings:Changed";

export const SETTINGS_SCHEMA = {

	early00sFunWorkflowName: {
		key: "JohnsEarly00sWorkflowName",
		default: true,
		type: "boolean",
		name: "Workflow Name",
		category: ["John's", "Early 00's Fun (Dangling Stats :)", "Workflow Name"],
		ui: { type: "boolean" }
	},

	early00sFunNumNodes: {
		key: "JohnsEarly00sNumNodes",
		default: true,
		type: "boolean",
		name: "Number of Nodes",
		category: ["John's", "Early 00's Fun (Dangling Stats :)", "Number of Nodes"],
		ui: { type: "boolean" }
	},

	early00sFunRunningNode: {
		key: "JohnsEarly00sRunningNode",
		default: true,
		type: "boolean",
		name: "Running Node",
		category: ["John's", "Early 00's Fun (Dangling Stats :)", "Running Node"],
		ui: { type: "boolean" }
	},
	
	early00sFunLastExecTime: {
		key: "JohnsEarly00sLastExecTime",
		default: true,
		type: "boolean",
		name: "Last Execution Time",
		category: ["John's", "Early 00's Fun (Dangling Stats :)", "Last Execution Time"],
		ui: { type: "boolean" }
	},

	early00sFunQueueLength: {
		key: "JohnsEarly00sQueueLength",
		default: true,
		type: "boolean",
		name: "Queue Length",
		category: ["John's", "Early 00's Fun (Dangling Stats :)", "Queue Length"],
		ui: { type: "boolean" }
	},

	early00sFunHoveredNode: {
		key: "JohnsEarly00sHoveredNode",
		default: true,
		type: "boolean",
		name: "Hovered Node",
		category: ["John's", "Early 00's Fun (Dangling Stats :)", "Hovered Node"],
		ui: { type: "boolean" }
	},

	early00sFunFPS: {
		key: "JohnsEarly00sFPS",
		default: true,
		type: "boolean",
		name: "FPS (Not recommended, causes frequent update)",
		category: ["John's", "Early 00's Fun (Dangling Stats :)", "FPS"],
		ui: { type: "boolean" }
	},

	early00sFunLinks: {
		key: "JohnsEarly00sLinks",
		default: true,
		type: "boolean",
		name: "Total Links",
		category: ["John's", "Early 00's Fun (Dangling Stats :)", "Links"],
		ui: { type: "boolean" }
	},

	early00sFunRainbow: {
		key: "JohnsEarly00sRainbow",
		default: false,
		type: "boolean",
		name: "Rainbow",
		category: ["John's", "Early 00's Fun (Dangling Stats :)", "Rainbow"],
		ui: { type: "boolean" }
	},

	early00sNotFun: {
		key: "JohnsEarly00sNotFun",
		default: true,
		type: "boolean",
		name: "Disabling Message",
		category: ["John's", "Early 00's Fun (Dangling Stats :)", "Not Fun"],
		ui: { type: "boolean" }
	},
	
	early00sFunStiffness: {
		key: "JohnsEarly00sFunStiffness",
		default: 15,
		type: "number",
		clamp: [1, 25],
		name: "Stiffness",
		category: ["John's", "Early 00's Fun (Dangling Stats :)", "Stiffness"],
		ui: { type: "slider", min: 1, max: 25, step: 0.5 }
	},
	
	early00sFunDamping: {
		key: "JohnsEarly00sFunDamping",
		default: 0.5,
		type: "number",
		clamp: [0.1, 0.9],
		name: "Damping",
		category: ["John's", "Early 00's Fun (Dangling Stats :)", "Damping"],
		ui: { type: "slider", min: 0.1, max: 0.9, step: 0.1 }
	},
	
	early00sFunGravity: {
		key: "JohnsEarly00sFunGravity",
		default: 15,
		type: "number",
		clamp: [0, 50],
		name: "Gravity",
		category: ["John's", "Early 00's Fun (Dangling Stats :)", "Gravity"],
		ui: { type: "slider", min: 0, max: 50, step: 1 }
	},
	
	early00sFunLetterSpacing: {
		key: "JohnsEarly00sFunLetterSpacing",
		default: 10,
		type: "number",
		clamp: [5, 25],
		name: "Letter Spacing",
		category: ["John's", "Early 00's Fun (Dangling Stats :)", "Letter Spacing"],
		ui: { type: "slider", min: 5, max: 25, step: 1 }
	},
	
	early00sFunOffset: {
		key: "JohnsEarly00sFunOffset",
		default: 10,
		type: "number",
		clamp: [5, 50],
		name: "Offset",
		category: ["John's", "Early 00's Fun (Dangling Stats :)", "Offset"],
		ui: { type: "slider", min: 5, max: 50, step: 1 }
	},
	
	early00sFunFontSize: {
		key: "JohnsEarly00sFunFontSize",
		default: 10,
		type: "number",
		clamp: [5, 25],
		name: "Font Size",
		category: ["John's", "Early 00's Fun (Dangling Stats :)", "Font Size"],
		ui: { type: "slider", min: 5, max: 25, step: 1 }
	},
	
	early00sFunOrientation: {
		key: "JohnsEarly00sFunOrientation",
		default: false,
		type: "boolean",
		name: "Vertical",
		category: ["John's", "Early 00's Fun (Dangling Stats :)", "Orientation"],
		ui: { type: "boolean" }
	},

	early00sFunDisableAll: {
		key: "JohnsEarly00sFunDisableAll",
		default: false,
		type: "boolean",
		name: "Disable All",
		category: ["John's", "Early 00's Fun (Dangling Stats :)", "Disable All"],
		ui: { type: "boolean" }
	},

	originAxesWidth: {
		key     : "JohnsOriginAxesLineWidth",
		default : 2.0,
		type    : "number",
		clamp   : [1, 10],
		name    : "Line Width",
		category: ["John's", "Origin Axes", "Line Width"],
		ui      : { type: "slider", min: 1, max: 10, step: 0.5 }
	},

	originAxesSquare: {
		key     : "JohnsOriginAxesSquareSize",
		default : 4.0,
		type    : "number",
		clamp   : [1, 12],
		name    : "Origin Square Size",
		category: ["John's", "Origin Axes", "Square Size"],
		ui      : { type: "slider", min: 1, max: 12, step: 1 }
	},
	
	originAxesOpacity: {
		key     : "JohnsOriginAxesOpacity",
		default : 0.25,
		type    : "number",
		clamp   : [0, 1],
		name    : "Opacity",
		category: ["John's", "Origin Axes", "Opacity"],
		ui      : { type: "slider", min: 0, max: 1, step: 0.05 }
	},

	originAxesEnabled: {
		key     : "JohnsOriginAxesToggle",
		default : true,
		type    : "boolean",
		name    : "Enabled",
		category: ["John's", "Origin Axes", "Enabled"],
		ui      : { type: "boolean" }
	},

	imageComparerMaxLongEdge: {
		key     : "JohnsImageComparerMaxLongEdge",
		default : 768,
		type    : "number",
		clamp   : [64, 4096],
		name    : "Max Size (On Longer Side)",
		category: ["John's", "Image Comparer", "Max Size"],
		ui      : { type: "slider", min: 64, max: 4096, step: 64 }
	},

	imageComparerAutoResize: {
		key     : "JohnsImageComparerAutoResize",
		default : true,
		type    : "boolean",
		name    : "Auto Resize Node to ImageA",
		category: ["John's", "Image Comparer", "Auto Resize"],
		ui      : { type: "boolean" }
	},

	cornerRoundingMode: {
		key     : "JohnsCornerRoundingMode",
		default : "all",
		type    : "combo",
		name    : "Mode",
		category: ["John's", "Disable Corner Rounding", "Mode"],
		ui      : {
			type   : "combo",
			options: [
				{ text: "Disable",     value: "none" },
				{ text: "John's Only", value: "johns" },
				{ text: "All Nodes",   value: "all" }
			]
		}
	},

	customBorders: {
		key     : "JohnsCustomBorders",
		default : "johns",
		type    : "combo",
		name    : "Mode",
		category: ["John's", "Custom Borders", "Mode"],
		ui      : {
			type   : "combo",
			options: [
				{ text: "Disable",     value: "off" },
				{ text: "John's Only", value: "johns" },
				{ text: "All Nodes",   value: "all" }
			]
		}
	}

};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const readValue = (schema) => {
	const raw = localStorage.getItem(schema.key);
	if (raw === null) return schema.default;

	if (schema.type === "boolean") return raw === "true";

	if (schema.type === "combo") return raw;

	if (schema.type === "json") {
		try { return JSON.parse(raw); }
		catch { return schema.default; }
	}

	if (schema.type === "number") {
		const num = Number(raw);
		if (!Number.isFinite(num)) return schema.default;
		return schema.clamp ? clamp(num, schema.clamp[0], schema.clamp[1]) : num;
	}

	return raw;
};

const writeValue = (schema, value) => {
	if (schema.type === "boolean") {
		localStorage.setItem(schema.key, value ? "true" : "false");
		return;
	}

	if (schema.type === "json") {
		localStorage.setItem(schema.key, JSON.stringify(value));
		return;
	}

	localStorage.setItem(schema.key, String(value));
};

export const getAll = () => {
	const out = {};

	for (const name in SETTINGS_SCHEMA) {
		out[name] = readValue(SETTINGS_SCHEMA[name]);
	}
	return out;
};

export const set = (partial) => {
	const current = getAll();
	const next    = { ...current, ...partial };

	for (const name in partial) {
		const schema = SETTINGS_SCHEMA[name];

		if (!schema) continue;

		let value = partial[name];

		if (schema.type === "number" && schema.clamp) {
			value = clamp(value, schema.clamp[0], schema.clamp[1]);
		}

		writeValue(schema, value);
	}

	document.dispatchEvent(
		new CustomEvent(JOHNS_SETTINGS_EVENT, { detail: next })
	);
};

export const subscribe = (callback) => {
	const handler = (e) => callback(e.detail);
	document.addEventListener(JOHNS_SETTINGS_EVENT, handler);
	return () => document.removeEventListener(JOHNS_SETTINGS_EVENT, handler);
};
