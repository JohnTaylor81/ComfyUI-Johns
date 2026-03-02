import { app } from "/scripts/app.js";


function InsertSpacerAfterWidget(node, widgetName, {
	height        = 10,
	draw_line     = true,
	line_color    = "rgba(230, 200, 120, 0.85)"
} = {}) {
	const idx = node.widgets.findIndex(w => w.name === widgetName);
	if (idx === -1) return;

	const spacer       = node.addWidget("separator", "", null, null);
	spacer.computeSize = function (ctx, nodeRef) {
		return [Math.max(0, nodeRef?.size?.[0] || 0), height];
	};

	spacer.size  = [0, height];
	spacer._size = [0, height];

	if (draw_line) {
		spacer.draw = function (ctx, node) {
			if (!node || typeof this.last_y !== "number") return;
			const nodeWidth = node.size[0];
			const offsetX   = nodeWidth * 0.05;
			const drawWidth = nodeWidth * 0.9;
			const lineY     = this.last_y + height / 2;

			ctx.strokeStyle = line_color;
			ctx.lineWidth   = 1;
			ctx.beginPath();
			ctx.moveTo(offsetX, lineY);
			ctx.lineTo(offsetX + drawWidth, lineY);
			ctx.stroke();
		};
	}

	const last = node.widgets.pop();
	node.widgets.splice(idx + 1, 0, last);

	if (node.graph && node.graph._version !== undefined) {
		node.setDirtyCanvas(true, true);
	} else {
		setTimeout(() => node.setDirtyCanvas(true, true), 0);
	}
}


function RemoveWidget(node, widgetName, {
	mode = 'target'
} = {}) {
	const idx = node.widgets.findIndex(w => w.name === widgetName);
	if (idx === -1) return;

	let deleteIdx = idx;
	if (mode === 'before' && idx > 0) deleteIdx = idx - 1;
	else if (mode === 'after' && idx < node.widgets.length - 1) deleteIdx = idx + 1;
	node.widgets.splice(deleteIdx, 1);
}


function AdjustNodeSize(node, {
	min_width  = null,
	max_width  = null,
	min_height = null,
	max_height = null
} = {}) {

	const toNum = v => (typeof v === 'number' && Number.isFinite(v))
		? v
		: (v == null ? null : (Number(v) || null));

	min_width  = toNum(min_width);
	max_width  = toNum(max_width);
	min_height = toNum(min_height);
	max_height = toNum(max_height);

	const clamp = (w, h) => {
		let cw = Number.isFinite(w) ? w : 0;
		let ch = Number.isFinite(h) ? h : 0;

		if (min_width  !== null) cw = Math.max(cw, min_width);
		if (max_width  !== null) cw = Math.min(cw, max_width);
		if (min_height !== null) ch = Math.max(ch, min_height);
		if (max_height !== null) ch = Math.min(ch, max_height);

		return [cw, ch];
	};

	const oldOnResize = node.onResize;
	node.onResize = function (size) {
		try {
			const w = Array.isArray(size) ? size[0] : size?.[0];
			const h = Array.isArray(size) ? size[1] : size?.[1];
			const [cw, ch] = clamp(w, h);

			if (Array.isArray(size)) {
				size[0] = cw;
				size[1] = ch;
			} else if (typeof size === 'object' && size !== null) {
				size[0] = cw;
				size[1] = ch;
			}
		} catch (e) { }

		if (typeof oldOnResize === 'function') {
			oldOnResize.call(this, size);
		}
	};

	const oldCompute = typeof node.computeSize === 'function' ? node.computeSize.bind(node) : null;

	node.computeSize = function () {
		let baseW = 0, baseH = 0;

		if (oldCompute) {
			const s = oldCompute();
			baseW = Array.isArray(s) ? s[0] : (s?.w ?? s?.width  ?? node.width  ?? 0);
			baseH = Array.isArray(s) ? s[1] : (s?.h ?? s?.height ?? node.height ?? 0);
		} else {
			baseW = node.width ?? 0;
			baseH = node.height ?? 0;
		}

		const needW = (min_width  !== null && baseW < min_width)  || (max_width  !== null && baseW > max_width);
		const needH = (min_height !== null && baseH < min_height) || (max_height !== null && baseH > max_height);

		if (!needW && !needH) {
			return [baseW, baseH];
		}

		const finalW = needW ? (min_width  ?? baseW) : baseW;
		const finalH = needH ? (min_height ?? baseH) : baseH;

		return [finalW, finalH];
	};

	const applySize = (arr) => {
		try {
			if (typeof node.setSize === 'function') {
				try {
					node.setSize(...arr);
				} catch {
					node.setSize(arr);
				}
			} else {
				node.width  = arr[0];
				node.height = arr[1];
			}
		} catch { }
	};

	try {
		const size       = node.computeSize();
		const normalized = Array.isArray(size) ? size : [size?.w ?? size?.width ?? 0, size?.h ?? size?.height ?? 0];
		applySize(normalized);
	} catch { }

	return {
		remove() {
			try {
				if (oldOnResize) node.onResize = oldOnResize;
			} catch { }
		},
		updateHints(newHints = {}) {
			return AdjustNodeSize(node, {
				min_width,
				max_width,
				min_height,
				max_height,
				...newHints
			});
		}
	};
}


// WIP: Still not working
function CompactMultilineInput(node, widgetName) {
	const widget = node.widgets.find(w => w.name === widgetName);
	if (!widget) return;
	
	// Access the DOM element if it exists (for multiline inputs)
	const inputEl = widget.inputEl || (widget.element && widget.element.querySelector('textarea'));
	if (inputEl) {
		// Remove margins and padding that create gaps
		inputEl.style.margin       = '-10px 0px 220px 10px';
		inputEl.style.marginBottom = '-20px';
		inputEl.style.marginTop    = '-10px';
		console.log(`Compacted multiline input for widget "${widgetName}"`); // Debug log
	}
}

export { InsertSpacerAfterWidget, RemoveWidget, AdjustNodeSize, CompactMultilineInput };
