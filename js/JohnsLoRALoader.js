import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";
import { getAll, set } from "./JohnsSettingsState.js";


const EXTENSION_NAME     = "JohnsLoRALoader";
const DEFAULT_STRENGTH   = 1;
const STEP               = 0.05;
const CTRL_STEP          = 0.25;
const MIN_VALUE          = -4.0;
const MAX_VALUE          = 4.0;
const NODE_PADDING       = 10;
const HEADER_PADDING     = 35;
const BUTTON_HEIGHT      = 24;
const ROW_HEIGHT         = 24;
const ARROW_BUTTON_WIDTH = 18;
const VALUE_WIDTH        = 32;
const CHECKBOX_SIZE      = 14;
const SCROLLBAR_WIDTH    = 12;
const GAP                = 4;

const COLOR_BUTTON_FILL_ACTIVE      = "rgba(0,0,0,0.35)";
const COLOR_BUTTON_FILL_INACTIVE    = "rgba(0,0,0,0.05)";
const COLOR_BUTTON_STROKE_ACTIVE    = "rgba(255,255,255,0.8)";
const COLOR_BUTTON_STROKE_INACTIVE  = "rgba(255,255,255,0.35)";
const COLOR_TEXT_ACTIVE             = "rgba(255,255,255,0.9)";
const COLOR_TEXT_INACTIVE           = "rgba(255,255,255,0.6)";
const COLOR_ROW_ALTERNATE           = "rgba(255,255, 255, 0.1)";
const COLOR_ROW_NORMAL              = "rgba(255,255,255,0.01)";
const COLOR_ROW_BORDER              = "rgba(255,255,255,0.25)";
const COLOR_TEXT_ENABLED            = "rgba(255,255,255,0.95)";
const COLOR_TEXT_DISABLED           = "rgba(255,255,255,0.35)";
const COLOR_CHECKBOX_BACKGROUND     = "rgba(0,0,0,0.15)";
const COLOR_CHECKBOX_BORDER         = "rgba(255,255,255,0.8)";
const COLOR_CHECKBOX_CHECK          = "rgba(255,255,255,0.95)";
const COLOR_LIST_BACKGROUND         = "rgba(0,0,0,0.25)";
const COLOR_LIST_BORDER             = "rgba(255,255,255,0.75)";
const COLOR_ERROR_TEXT              = "rgba(255,120,120,0.95)";
const COLOR_SCROLLBAR_TRACK_BG      = "rgba(0,0,0,0.15)";
const COLOR_SCROLLBAR_TRACK_BORDER  = "rgba(255,255,255,0.35)";
const COLOR_SCROLLBAR_HANDLE        = "rgba(255,255,255,0.25)";
const COLOR_SCROLLBAR_HANDLE_STROKE = "rgba(255,255,255,0.6)";

function clamp(v, a, b) {
	v = Number(v);

	if (!Number.isFinite(v)) v = 0;

	return Math.max(a, Math.min(b, v));
}

function round2(v) {
	return Math.round(v * 100) / 100;
}

function fmt(v) {
	v = round2(v);

	if (Object.is(v, -0)) v = 0;

	const s = v.toFixed(2);

	return s.endsWith(".00") ? String(parseInt(s, 10)): s.replace(/0$/, "");
}

function drawRect(ctx, rect, fillStyle, strokeStyle) {
	ctx.beginPath();
	ctx.rect(rect.x, rect.y, rect.w, rect.h);
	ctx.fillStyle = fillStyle;
	ctx.fill();
	ctx.strokeStyle = strokeStyle;
	ctx.stroke();
}

function drawButtonText(ctx, rect, text, active = true) {
	const fill      = active ? COLOR_BUTTON_FILL_ACTIVE : COLOR_BUTTON_FILL_INACTIVE;
	const stroke    = active ? COLOR_BUTTON_STROKE_ACTIVE : COLOR_BUTTON_STROKE_INACTIVE;
	const textColor = active ? COLOR_TEXT_ACTIVE : COLOR_TEXT_INACTIVE;

	drawRect(ctx, rect, fill, stroke);

	ctx.fillStyle    = textColor;
	ctx.textAlign    = "center";
	ctx.textBaseline = "middle";
	ctx.font         = "10px sans-serif";

	ctx.fillText(text, rect.x + rect.w / 2, rect.y + rect.h / 2 + 0.5);
}

function getViewItems(node) {
	return node.view?.items || [];
}

function getViewItemCount(node) {
	return getViewItems(node).length;
}

function getLoraCount(node) {
	return (node.loras || []).length;
}

function clampValue(value) {
	return clamp(value, MIN_VALUE, MAX_VALUE);
}

function adjustLoraValue(lora, field, delta) {
	const current = lora[field] || 0;
	lora  [field] = clampValue(round2(current + delta));
}

async function fetchLoras() {
	const r = await api.fetchApi("/JohnsLoRALoaderList");

	if (!r.ok) throw new Error(await r.text());

	const data = await r.json();

	return Array.isArray(data?.loras) ? data.loras: [];
}

function getConfigWidget(node) {
	return (node.widgets || []).find((w) => w?.name === "JohnsLoRALoaderContainer");
}

function readConfig(node) {
	const w   = getConfigWidget(node);
	const raw = (w?.value ?? node.properties?.JohnsLoRALoaderContainer ?? "").toString();

	if (!raw) return [];

	try {
		const parsed = JSON.parse(raw);

		return Array.isArray(parsed) ? parsed: [];
	} catch {
		return [];
	}
}

function writeConfig(node) {
	const configWidget   = getConfigWidget(node);
	const enabledEntries = (node.loras || [])
		.filter((lora) => (lora.en ?? false) && ((lora.sm || 0) !== 0 || (lora.sc || 0) !== 0))
		.map((lora) => ({ name: lora.name, sm: round2(lora.sm || 0), sc: round2(lora.sc || 0) }));
	const json = JSON.stringify(enabledEntries);

	if (configWidget) configWidget.value = json;

	node.properties                          = node.properties || {};
	node.properties.JohnsLoRALoaderContainer = json;
}

function ensureHiddenConfig(node) {
	const w = getConfigWidget(node);

	if (!w || w.hidden) return;

	w.type        = "hidden";
	w.computeSize = () => [0, 0];
	w.hidden      = true;
}

function initState(node) {
	if (node.inited) return;

	node.inited             = true;
	node.loras              = [];
	node.view               = { items: [], map: [] };
	node.scroll             = 0;
	node.folder_toggles     = null;
	node.folder_buttons     = [];
	node.loading            = false;
	node.error              = "";
	node.pending_state      = null;
	node.has_workflow_state = false;
}

function safeParseState(raw) {
	if (!raw) return null;

	try {
		const v = typeof raw === "string" ? JSON.parse(raw) : raw;
		if (!v || typeof v !== "object") return null;

		return v;
	} catch {
		return null;
	}
}

function loadLocalState() {
	const state = getAll();

	return state.loraLoaderState || null;
}

function saveLocalState(newState) {
	set({ loraLoaderState: newState });
}

function buildState(node) {
	const lorasState = {};

	for (const lora of node.loras || []) {
		lorasState[lora.name] = { en: !!lora.en, sm: round2(lora.sm || 0), sc: round2(lora.sc || 0) };
	}

	return {
		v      : 1,
		folders: node.folder_toggles ? { ...node.folder_toggles }: null,
		loras  : lorasState,
	};
}

function applyState(node, state) {
	const parseState = safeParseState(state);

	if (!parseState) return;

	if (parseState.folders && typeof parseState.folders === "object") {
		node.folder_toggles = { ...parseState.folders };
	}

	const loraStateMap = parseState.loras && typeof parseState.loras === "object" ? parseState.loras : null;

	if (loraStateMap) {
		for (const lora of node.loras || []) {
			const savedState = loraStateMap[lora.name];

			if (!savedState) continue;

			lora.en = !!savedState.en;
			lora.sm = clampValue(savedState.sm ?? lora.sm ?? 0);
			lora.sc = clampValue(savedState.sc ?? lora.sc ?? 0);
		}
	}
}

function persistState(node, alsoLocal = true) {
	const st = buildState(node);

	node.properties                      = node.properties || {};
	node.properties.JohnsLoRALoaderState = st;

	if (alsoLocal) saveLocalState(st);
}

function mergeSaved(loraNames, savedStates) {
	const savedStateMap = new Map();

	for (const savedLora of savedStates || []) {
		const name = (savedLora?.name ?? "").toString();

		if (!name) continue;

		savedStateMap.set(name, {
			sm: clampValue(savedLora?.sm ?? DEFAULT_STRENGTH),
			sc: clampValue(savedLora?.sc ?? DEFAULT_STRENGTH),
			en: !!savedLora?.en,
		});
	}

	return (loraNames || []).map((name) => {
		const savedState = savedStateMap.get(name);

		return {
			name,
			sm: savedState?.sm ?? DEFAULT_STRENGTH,
			sc: savedState?.sc ?? DEFAULT_STRENGTH,
			en: savedState?.en ?? false,
		};
	});
}

function folderKeyFor(name) {
	const s = (name || "").toString().replace(/\\/g, "/");
	const i = s.indexOf("/");

	return i === -1 ? "" : s.slice(0, i);
}

function displayNameFor(name) {
	const s         = (name || "").toString().replace(/\\/g, "/");
	const parts     = s.split("/");
	const last      = parts.pop() || "";
	const cleanLast = last.replace(/\.[^./\\]+$/, "");

	parts.push(cleanLast);

	return parts.join("/");
}

function computeFolders(loras) {
	const folderSet = new Set();

	for (const lora of loras || []) {
		const folderKey = folderKeyFor(lora?.name);
		if (folderKey) folderSet.add(folderKey);
	}

	return Array.from(folderSet).sort((a, b) => a.localeCompare(b));
}

function ensureFolderState(node) {
	const folders = computeFolders(node.loras);

	if (!folders.length) {
		node.folder_toggles = null;

		return;
	}
	if (!node.folder_toggles) node.folder_toggles = {};

	for (const folderKey of folders) {
		if (!(folderKey in node.folder_toggles))
			node.folder_toggles[folderKey] = true;
	}

	for (const key of Object.keys(node.folder_toggles)) {
		if (!folders.includes(key)) delete node.folder_toggles[key];
	}
}

function computeView(node) {
	const toggleState = node.folder_toggles;
	const items       = [];
	const indexMap    = [];

	for (let i = 0; i < getLoraCount(node); i++) {
		const lora = node.loras[i];

		if (!toggleState) {
			items.push(lora);
			indexMap.push(i);

			continue;
		}

		const folderKey = folderKeyFor(lora?.name);

		if (folderKey === "" || toggleState[folderKey]) {
			items.push(lora);
			indexMap.push(i);
		}
	}

	node.view = { items, map: indexMap };
}

function topInset(node) {
	const folders = computeFolders(node.loras);

	return HEADER_PADDING + (folders.length ? GAP + BUTTON_HEIGHT : 0);
}

function listRect(node) {
	const x = NODE_PADDING;
	const y = NODE_PADDING + topInset(node) + GAP;
	const w = node.size[0] - NODE_PADDING * 2;
	const h = node.size[1] - NODE_PADDING * 3 - topInset(node) - BUTTON_HEIGHT;

	return { x, y, w, h };
}

function resetRect(node) {
	const r = listRect(node);
	const x = NODE_PADDING;
	const y = r.y + r.h + GAP;
	const w = Math.min(140, node.size[0] - NODE_PADDING * 2);
	const h = BUTTON_HEIGHT;

	return { x, y, w, h };
}

function maxScroll(node, rect) {
	const total = (node.view?.items?.length || 0) * ROW_HEIGHT;

	return Math.max(0, total - rect.h);
}

function setScroll(node, rect, v) {
	node.scroll = clamp(v, 0, maxScroll(node, rect));
}

function hitTest(node, pos, layout) {
	// Hit test folder buttons
	for (const button of layout.folderButtons) {
		if (inRect(pos, button.rect))
			return { kind: "folderbtn", key: button.key };
	}

	// Hit test reset button
	if (inRect(pos, layout.resetButton)) 
		return { kind: "reset", r: layout.resetButton };

	// Hit test list area and scrollbar
	const posX = pos[0];
	const posY = pos[1];

	if (posX < layout.listArea.x || posY < layout.listArea.y || posX > layout.listArea.x + layout.listArea.w || posY > layout.listArea.y + layout.listArea.h)
		return null;

	// Hit test scrollbar
	if (posX >= layout.scrollbar.scrollbarX)
		return {
			kind: "scrollbar",
			r: layout.listArea,
			sbW: layout.scrollbar.sbW,
			innerW: layout.scrollbar.innerWidth,
			sx: layout.scrollbar.scrollbarX
		};

	// Hit test rows
	for (const row of layout.rows) {
		if (inRect(pos, row.rect)) {
			return {
				kind: "row",
				r: layout.listArea,
				innerW: layout.scrollbar.innerWidth,
				idx: row.index,
				row: row.rect,
				lora: row.lora,
				layout: row.layout
			};
		}
	}

	return null;
}

function rowLayout(row) {
	const rowNameWidth = row.w - (((ARROW_BUTTON_WIDTH + VALUE_WIDTH + ARROW_BUTTON_WIDTH) * 2) + (GAP * 3));
	const x0           = row.x;
	const y0           = row.y;

	const checkbox = {
		x: x0 + GAP,
		y: y0 + Math.floor((row.h - CHECKBOX_SIZE) / 2),
		w: CHECKBOX_SIZE,
		h: CHECKBOX_SIZE
	};

	const nameBounds = {
		x: checkbox.x + checkbox.w + GAP,
		y: y0,
		w: Math.max(60, rowNameWidth - (checkbox.w + GAP * 4)),
		h: row.h
	};

	const modelStrengthX = x0 + rowNameWidth + (GAP * 2);
	const modelDecrement = {
		x: modelStrengthX,
		y: y0 + 2,
		w: ARROW_BUTTON_WIDTH,
		h: row.h - 4
	};
	const modelStrength = {
		x: modelDecrement.x + ARROW_BUTTON_WIDTH,
		y: modelDecrement.y,
		w: VALUE_WIDTH,
		h: modelDecrement.h
	};
	const modelIncrement = {
		x: modelStrength.x + VALUE_WIDTH,
		y: modelDecrement.y,
		w: ARROW_BUTTON_WIDTH,
		h: modelDecrement.h
	};

	const clipStrengthX = modelIncrement.x + ARROW_BUTTON_WIDTH;
	const clipDecrement = {
		x: clipStrengthX + GAP,
		y: modelDecrement.y,
		w: ARROW_BUTTON_WIDTH,
		h: modelDecrement.h
	};
	const clipStrength = {
		x: clipDecrement.x + ARROW_BUTTON_WIDTH,
		y: modelDecrement.y,
		w: VALUE_WIDTH,
		h: modelDecrement.h
	};
	const clipIncrement = {
		x: clipStrength.x + VALUE_WIDTH,
		y: modelDecrement.y,
		w: ARROW_BUTTON_WIDTH,
		h: modelDecrement.h
	};

	return {
		cb  : checkbox,
		name: nameBounds,
		mDec: modelDecrement,
		mVal: modelStrength,
		mInc: modelIncrement,
		cDec: clipDecrement,
		cVal: clipStrength,
		cInc: clipIncrement
	};
}

function computeFullLayout(node, ctx) {
	const layout = {
		folderButtons: [],
		resetButton: resetRect(node),
		listArea: listRect(node),
		rows: []
	};

	ensureFolderState(node);
	const folders = computeFolders(node.loras);
	const toggles = node.folder_toggles || {};

	// Compute folder buttons
	if (folders.length) {
		const x0 = NODE_PADDING;
		const y0 = NODE_PADDING + HEADER_PADDING + GAP;
		const h  = BUTTON_HEIGHT;
		let   x  = x0;

		for (const folderName of folders) {
			const width = Math.ceil(ctx.measureText(folderName).width) + 12;
			const rect  = { x, y: y0, w: width, h };

			layout.folderButtons.push({
				key: folderName,
				rect: rect,
				active: toggles[folderName] !== false
			});

			x += width + GAP;
		}
	}

	// Compute rows
	const innerWidth = layout.listArea.w - SCROLLBAR_WIDTH - GAP;
	const firstRow   = Math.floor(node.scroll / ROW_HEIGHT);
	const lastRow    = Math.min(getViewItemCount(node) - 1, Math.ceil((node.scroll + layout.listArea.h) / ROW_HEIGHT));

	for (let i = firstRow; i <= lastRow; i++) {
		const rowY    = layout.listArea.y + i * ROW_HEIGHT - node.scroll;
		const rowRect = { x: layout.listArea.x, y: rowY, w: innerWidth, h: ROW_HEIGHT };

		layout.rows.push({
			index: i,
			lora: node.view.items[i],
			rect: rowRect,
			layout: rowLayout(rowRect)
		});
	}

	// Compute scrollbar
	const total        = getViewItemCount(node) * ROW_HEIGHT;
	const view         = layout.listArea.h;
	const maxScroll    = Math.max(0, total - view);
	const handleHeight = Math.max(24, Math.round((view / Math.max(view, total)) * view));
	const handleY      = layout.listArea.y + (maxScroll ? (node.scroll / maxScroll) * (view - handleHeight) : 0);
	const scrollbarX   = layout.listArea.x + innerWidth + GAP;

	layout.scrollbar = {
		innerWidth: innerWidth,
		scrollbarX: scrollbarX,
		sbW: SCROLLBAR_WIDTH,
		trackRect: { x: scrollbarX, y: layout.listArea.y, w: SCROLLBAR_WIDTH, h: layout.listArea.h },
		handleRect: { x: scrollbarX + 1, y: handleY + 1, w: SCROLLBAR_WIDTH - 2, h: handleHeight - 2 },
		maxScroll: maxScroll
	};

	return layout;
}

function inRect(point, rect) {
	return (point[0] >= rect.x && point[0] <= rect.x + rect.w && point[1] >= rect.y && point[1] <= rect.y + rect.h);
}

function drawFolderButtons(ctx, layout) {
	if (!layout.folderButtons.length) return;

	ctx.save();

	for (const button of layout.folderButtons) {
		drawButtonText(ctx, button.rect, button.key, button.active);
	}

	ctx.restore();
}

function drawResetButton(ctx, layout) {
	drawButtonText(ctx, layout.resetButton, "Reset", true);
}

function drawRow(ctx, lora, rowLayout_obj, rect, rowIndex) {
	const enabled  = !!lora.en;
	const rowWidth = rect.w - (VALUE_WIDTH + GAP + ARROW_BUTTON_WIDTH + ARROW_BUTTON_WIDTH) * 2;

	drawRect(ctx, { x: rect.x, y: rect.y, w: rowWidth, h: rect.h }, rowIndex % 2 ? COLOR_ROW_ALTERNATE : COLOR_ROW_NORMAL, COLOR_ROW_BORDER);

	ctx.save();
	ctx.beginPath();
	ctx.rect(rect.x, rect.y, rowLayout_obj.name.w + VALUE_WIDTH, rect.h);
	ctx.clip();
	ctx.fillStyle    = enabled ? COLOR_TEXT_ENABLED : COLOR_TEXT_DISABLED;
	ctx.textAlign    = "left";
	ctx.textBaseline = "middle";
	ctx.font         = "10px sans-serif";
	ctx.fillText(displayNameFor(lora.name), rowLayout_obj.name.x, rect.y + rect.h / 2 + 0.5);
	ctx.restore();

	drawRect(ctx, rowLayout_obj.cb, COLOR_CHECKBOX_BACKGROUND, COLOR_CHECKBOX_BORDER);

	if (enabled) {
		ctx.strokeStyle = COLOR_CHECKBOX_CHECK;
		ctx.lineWidth   = 2;
		ctx.beginPath();
		ctx.moveTo(rowLayout_obj.cb.x + 3, rowLayout_obj.cb.y + rowLayout_obj.cb.h * 0.55);
		ctx.lineTo(rowLayout_obj.cb.x + rowLayout_obj.cb.w * 0.42, rowLayout_obj.cb.y + rowLayout_obj.cb.h - 4);
		ctx.lineTo(rowLayout_obj.cb.x + rowLayout_obj.cb.w - 3, rowLayout_obj.cb.y + 3);
		ctx.stroke();
		ctx.lineWidth = 1;
	}

	drawButtonText(ctx, rowLayout_obj.mDec, "◀", enabled);
	drawButtonText(ctx, rowLayout_obj.mVal, fmt(lora.sm), enabled);
	drawButtonText(ctx, rowLayout_obj.mInc, "▶", enabled);

	drawButtonText(ctx, rowLayout_obj.cDec, "◀", enabled);
	drawButtonText(ctx, rowLayout_obj.cVal, fmt(lora.sc), enabled);
	drawButtonText(ctx, rowLayout_obj.cInc, "▶", enabled);
}

function drawScrollbar(ctx, layout, node) {
	const track = layout.scrollbar.trackRect;

	drawRect(ctx, track, COLOR_SCROLLBAR_TRACK_BG, COLOR_SCROLLBAR_TRACK_BORDER);

	if (getViewItemCount(node) * ROW_HEIGHT <= 0) return;

	drawRect(ctx, layout.scrollbar.handleRect, COLOR_SCROLLBAR_HANDLE, COLOR_SCROLLBAR_HANDLE_STROKE);
}

function ensureLoaded(node) {
	if (node.loading || node.loras?.length) return;

	node.loading = true;
	node.error   = "";

	const saved = readConfig(node);

	fetchLoras()
		.then((list) => {
			node.loras = mergeSaved(list, saved);
			if (node.pending_state) {
				applyState(node, node.pending_state);
			}
			ensureFolderState(node);
			computeView(node);
			writeConfig(node);
		})
		.catch((e) => {
			node.error = (e?.message || "Failed to load LoRAs").toString();
			node.loras = mergeSaved([], saved);
			if (node.pending_state) {
				applyState(node, node.pending_state);
			}
			ensureFolderState(node);
			computeView(node);
		})
		.finally(() => {
			node.loading = false;
			node.setDirtyCanvas(true, true);
		});
}

const handleResetButton = (node) => {
	for (const lora of node.loras || []) {
		lora.sm = DEFAULT_STRENGTH;
		lora.sc = DEFAULT_STRENGTH;
		lora.en = false;
	}

	ensureFolderState(node);

	if (node.folder_toggles) {
		for (const key of Object.keys(node.folder_toggles)) {
			node.folder_toggles[key] = true;
		}
	}

	computeView(node);

	const rect = listRect(node);

	setScroll(node, rect, 0);
	writeConfig(node);
	persistState(node);

	node.setDirtyCanvas(true, true);
};

const handleFolderButtonClick = (node, folderKey) => {
	ensureFolderState(node);

	if (node.folder_toggles) {
		node.folder_toggles[folderKey] = !(node.folder_toggles[folderKey] !== false);
	}

	computeView(node);

	const rect = listRect(node);

	setScroll(node, rect, node.scroll);
	persistState(node);

	node.setDirtyCanvas(true, true);
};

const handleScrollbarClick = (node, hit, clickPos) => {
	const rect         = hit.r;
	const total        = getViewItemCount(node) * ROW_HEIGHT;
	const view         = rect.h;
	const maxScroll    = Math.max(0, total - view);
	const trackHeight  = rect.h;
	const handleHeight = Math.max(24, Math.round((view / Math.max(view, total)) * trackHeight));

	// Start scrollbar drag mode
	node._scrollbarDrag = {
		active: true,
		rect: rect,
		maxScroll: maxScroll,
		trackHeight: trackHeight,
		handleHeight: handleHeight,
	};

	// Calculate initial scroll position
	const localY = clickPos[1] - rect.y;
	const start  = clamp(localY - handleHeight / 2, 0, trackHeight - handleHeight);
	const scroll = maxScroll ? (start / (trackHeight - handleHeight)) * maxScroll : 0;

	setScroll(node, rect, scroll);
	node.setDirtyCanvas(true, true);
};

const handleRowClick = (lora, layout, clickPos, ctrlPressed) => {
	let changed = false;

	if (inRect(clickPos, layout.cb)) {
		lora.en = !lora.en;
		changed = true;
	} else if (!lora.en) {
		return false;
	}

	const step = ctrlPressed ? CTRL_STEP : STEP;

	if (!changed && inRect(clickPos, layout.mDec)) {
		adjustLoraValue(lora, "sm", -step);
		changed = true;
	} else if (!changed && inRect(clickPos, layout.mInc)) {
		adjustLoraValue(lora, "sm", step);
		changed = true;
	} else if (!changed && inRect(clickPos, layout.mVal)) {
		lora.sm = DEFAULT_STRENGTH;
		changed = true;
	} else if (!changed && inRect(clickPos, layout.cDec)) {
		adjustLoraValue(lora, "sc", -step);
		changed = true;
	} else if (!changed && inRect(clickPos, layout.cInc)) {
		adjustLoraValue(lora, "sc", step);
		changed = true;
	} else if (!changed && inRect(clickPos, layout.cVal)) {
		lora.sc = DEFAULT_STRENGTH;
		changed = true;
	}

	return changed;
};

app.registerExtension({
	name: EXTENSION_NAME,
	async beforeRegisterNodeDef(nodeType, nodeData) {
		if (nodeData?.name !== "JohnsLoRALoader") return;

		const origCreated = nodeType.prototype.onNodeCreated;

		nodeType.prototype.onNodeCreated = function () {
			const r = origCreated?.apply(this, arguments);

			initState(this);

			if (!this.pending_state) {
				this.pending_state = loadLocalState();
			}

			ensureHiddenConfig(this);
			ensureLoaded(this);

			return r;
		};

		const origConfigure = nodeType.prototype.onConfigure;

		nodeType.prototype.onConfigure = function () {
			const r = origConfigure?.apply(this, arguments);
			initState(this);
			const cfg = arguments?.length ? arguments[0] : null;
			const wf  = safeParseState(cfg?.properties?.JohnsLoRALoaderState ?? this.properties?.JohnsLoRALoaderState);

			if (wf) {
				this.pending_state      = wf;
				this.has_workflow_state = true;
			} else if (!this.pending_state) {
				this.pending_state = loadLocalState();
			}

			ensureHiddenConfig(this);
			ensureLoaded(this);

			return r;
		};

		nodeType.prototype.onDrawForeground = function (ctx) {
			initState(this);
			ensureHiddenConfig(this);
			ensureLoaded(this);

			ctx.save();

			try {
				computeView(this);

				// Compute layout once (single source of truth)
				const layout = computeFullLayout(this, ctx);
				this._lastLayout = layout; // Cache for hit testing

				drawFolderButtons(ctx, layout);

				const listArea = layout.listArea;

				setScroll(this, listArea, this.scroll);

				ctx.save();

				drawRect(ctx, listArea, COLOR_LIST_BACKGROUND, COLOR_LIST_BORDER);

				ctx.restore();

				if (this.error) {
					ctx.fillStyle    = COLOR_ERROR_TEXT;
					ctx.font         = "14px sans-serif";
					ctx.textAlign    = "left";
					ctx.textBaseline = "top";
					ctx.fillText(this.error, listArea.x + 6, listArea.y + 6);

					return;
				}

				const innerWidth = layout.scrollbar.innerWidth;
				const clipArea   = { x: listArea.x, y: listArea.y, w: innerWidth + GAP, h: listArea.h };

				ctx.save();
				ctx.beginPath();
				ctx.rect(clipArea.x, clipArea.y, clipArea.w, clipArea.h);
				ctx.clip();

				// Draw rows using pre-computed layout
				for (const row of layout.rows) {
					drawRow(ctx, row.lora, row.layout, row.rect, row.index);
				}

				ctx.restore();

				drawScrollbar(ctx, layout, this);
				drawResetButton(ctx, layout);
			} finally {
				ctx.restore();
			}
		};

		window.addEventListener(
			"wheel",
			function (event) {
				if (!app?.canvas) return;

				const graphMousePos = app.canvas.graph_mouse;

				if (!graphMousePos || graphMousePos.length < 2) return;

				const loraNodes = app.graph._nodes || [];

				for (const node of loraNodes) {
					if (node.type !== "JohnsLoRALoader") continue;

					initState(node);
					
					const localMousePos = [
						graphMousePos[0] - node.pos[0],
						graphMousePos[1] - node.pos[1]
					];

					if (
						localMousePos[0] < 0 ||
						localMousePos[1] < 0 ||
						localMousePos[0] > node.size[0] ||
						localMousePos[1] > node.size[1]
					)
						continue;

					computeView(node);

					// We need to check if mouse is within list area
					const listArea = listRect(node);
					if (
						localMousePos[0] < listArea.x ||
						localMousePos[1] < listArea.y ||
						localMousePos[0] > listArea.x + listArea.w ||
						localMousePos[1] > listArea.y + listArea.h
					)
						continue;

					event.preventDefault();
					event.stopImmediatePropagation();

					const scrollDelta = -(event.deltaY || 0) * -0.5;

					setScroll(node, listArea, node.scroll + scrollDelta);

					node.setDirtyCanvas(true, true);

					return;
				}
			},
			{ capture: true, passive: false },
		);

		nodeType.prototype.onMouseDown = function (e, pos) {
			initState(this);

			// Recompute layout for hit testing (or use cached if available)
			const layout = this._lastLayout;
			if (!layout) return;

			const hit = hitTest(this, pos, layout);

			if (!hit) return;

			if (hit.kind === "reset") {
				handleResetButton(this);

				return true;
			}

			if (hit.kind === "folderbtn") {
				handleFolderButtonClick(this, hit.key);

				return true;
			}

			if (hit.kind === "scrollbar") {
				handleScrollbarClick(this, hit, pos);

				return true;
			}

			if (hit.kind !== "row") return;

			const lora = hit.lora;
			const layout_obj = hit.layout;

			if (handleRowClick(lora, layout_obj, pos, e.ctrlKey)) {
				writeConfig(this);
				persistState(this);
				this.setDirtyCanvas(true, true);

				return true;
			}
		};
	},
});
