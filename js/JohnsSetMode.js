import { app } from "/scripts/app.js";

const MODE_NORMAL = 0;
const MODE_MUTE   = 2;
const MODE_BYPASS = 4;

const CLASS_MODE_OPTIONS = ["Enabled", "Muted", "Bypassed"];
const NO_CONNECTION      = "No Connection";

const modeChanges = new WeakMap();

function getGraphState(graph) {
	if (!graph) return null;

	let state = modeChanges.get(graph);

	if (!state) {
		state = { controllers: new Map() };
		modeChanges.set(graph, state);
	}
	return state;
}

function getControllerSet(graph, controllerId, create = true) {
	const state = getGraphState(graph);

	if (!state) return null;

	let set = state.controllers.get(controllerId);

	if (!set && create) {
		set = new Set();
		state.controllers.set(controllerId, set);
	}

	return set || null;
}

function getWidget(node, name) {
	return (node.widgets || []).find((w) => w.name === name);
}

function getClassName(node) {
	return node?.comfyClass || node?.type || "";
}

function getNodeName(node) {
	return node?.title || getClassName(node) || `#${node?.id ?? "?"}`;
}

function resolveLink(graph, linkId) {
	const links = graph?.links;

	if (!links || linkId == null) return null;

	if (!Array.isArray(links)) return links[linkId] || null;

	for (const l of links) {
		if (!l) continue;

		if (Array.isArray(l) && l[0] === linkId) {
			return {
				id         : l[0],
				origin_id  : l[1],
				origin_slot: l[2],
				target_id  : l[3],
				target_slot: l[4],
				type       : l[5],
			};
		}

		if (typeof l === "object" && l.id === linkId) return l;
	}

	return null;
}

function getConnectedControllerInputs(controllerNode) {
	if (!Array.isArray(controllerNode?.inputs)) return [];

	const all = [];

	for (let i = 0; i < controllerNode.inputs.length; i++) {
		const input    = controllerNode.inputs[i];
		const rawName  = (input?.name ?? "").toString().trim();
		const rawLabel = (input?.label ?? "").toString().trim();
		const name     = rawName || `${i}`;
		const entry    = { index: i, name, label: rawLabel, input };

		all.push(entry);
	}

	const withoutTail = all.length > 1 ? all.slice(0, -1) : [];

	return withoutTail.filter((slot) => slot?.input?.link != null);
}

function getConnectedSourceNodeIds(controllerNode, inputIndex) {
	const graph = controllerNode?.graph;

	if (!graph || !Number.isFinite(inputIndex)) return [];

	const input  = controllerNode?.inputs?.[inputIndex];
	const linkId = input?.link;

	if (linkId == null) return [];

	const link = resolveLink(graph, linkId);

	if (!link || link.origin_id == null || link.origin_id === controllerNode.id) return [];

	return [link.origin_id];
}

function getConnectedSourceNodes(controllerNode, inputIndex) {
	const graph = controllerNode?.graph;

	if (!graph) return [];

	return getConnectedSourceNodeIds(controllerNode, inputIndex).map((id) => graph.getNodeById(id)).filter(Boolean);
}

function getComboOptions(widget) {
	if (!widget) return [];
	if (Array.isArray(widget.options?.values)) return widget.options.values;
	if (Array.isArray(widget.options)) return widget.options;

	return [];
}

function setComboOptions(widget, values) {
	if (!widget) return;

	if (!widget.options || Array.isArray(widget.options)) {
		widget.options = { values: [...values] };
		return;
	}

	widget.options.values = [...values];
}

function makeCombo(node, label, initial, onChange, values) {
	const w = node.addWidget(
		"combo",
		label,
		initial,
		(v) => onChange?.((v ?? "").toString()),
		{ values: values || [initial] }
	);

	w.options.values = values || [initial];
	w.value          = initial;

	return w;
}

function getModeBackendWidget(node) {
	return node.JohnsSetModeBackendWidget || getWidget(node, "Mode");
}

function modeWidgetNameForInput(inputIndex, inputLabel) {
	const label = (inputLabel ?? "").toString().trim();

	if (/^\d+$/.test(label)) {
		return label;
	}

	if (Number.isFinite(inputIndex)) {
		return `${inputIndex}`;
	}

	return "";
}

function isInputModeWidgetName(name) {
	const n = (name ?? "").toString().trim();
	return /^\d+$/.test(n);
}

function getInputModeWidgetEntries(controllerNode) {
	const inputs  = getConnectedControllerInputs(controllerNode);
	const entries = [];

	for (const slot of inputs) {
		const widgetName = modeWidgetNameForInput(slot.index, slot.label);
		const widget     = getWidget(controllerNode, widgetName);
		
		if (!widget) continue;

		entries.push({
			index: slot.index,
			widgetName,
			widget,
		});
	}

	return entries;
}

function getFirstInputModeWidget(node) {
	return getInputModeWidgetEntries(node)[0]?.widget || null;
}

function ensureInputModeWidget(controllerNode, inputIndex, onChange, initial = NO_CONNECTION) {
	const input      = controllerNode?.inputs?.[inputIndex];
	const inputLabel = (input?.label ?? "").toString().trim();
	const widgetName = modeWidgetNameForInput(inputIndex, inputLabel);
	let   widget     = getWidget(controllerNode, widgetName);

	if (widget) {
		if (!widget.JohnsSetModeInputCallbackPatched && onChange) {
			const old = widget.callback;

			widget.callback = function () {
				if (old) old.apply(this, arguments);

				onChange((this?.value ?? "").toString());
			};

			widget.JohnsSetModeInputCallbackPatched = true;
		}

		return widget;
	}

	widget = makeCombo(
		controllerNode,
		widgetName,
		initial,
		(value) => onChange?.(value),
		[initial]
	);

	widget.JohnsSetModeInputCallbackPatched = true;
	return widget;
}

function ensureInputModeWidgets(controllerNode, onChange) {
	const slots         = getConnectedControllerInputs(controllerNode);
	const expectedNames = new Set(
		slots.map((slot) => modeWidgetNameForInput(slot.index, slot.label))
	);

	let changed = false;

	if (Array.isArray(controllerNode?.widgets)) {
		for (let i = controllerNode.widgets.length - 1; i >= 0; i--) {
			const w    = controllerNode.widgets[i];
			const name = (w?.name ?? "").toString();

			if (!isInputModeWidgetName(name)) continue;

			if (!expectedNames.has(name)) {
				controllerNode.widgets.splice(i, 1);
				changed = true;

				continue;
			}
		}
	}

	const backendW        = getModeBackendWidget(controllerNode);
	const fallbackInitial = ((backendW?.value ?? NO_CONNECTION).toString() || NO_CONNECTION);
	const entries         = [];

	for (let i = 0; i < slots.length; i++) {
		const slot       = slots[i];
		const initial    = i === 0 ? fallbackInitial : NO_CONNECTION;
		const widgetName = modeWidgetNameForInput(slot.index, slot.label);
		const existed    = Boolean(getWidget(controllerNode, widgetName));
		const widget     = ensureInputModeWidget(controllerNode, slot.index, onChange, initial);
		
		if (!existed) {
			changed = true;
		}

		entries.push({ index: slot.index, widgetName, widget });
	}

	return entries;
}

function normalizeMode(selection) {
	const s = (selection ?? "").toString();
	if (s.includes("Muted")) return "Muted";
	if (s.includes("Bypassed")) return "Bypassed";

	return "Enabled";
}

function modeSelectionToNodeMode(selection) {
	const state = normalizeMode(selection);
	if (state === "Muted") return MODE_MUTE;
	if (state === "Bypassed") return MODE_BYPASS;

	return MODE_NORMAL;
}

function selectionState(selection) {
	return normalizeMode(selection);
}

function setBackendModeValue(node, value) {
	const backendW = getModeBackendWidget(node);

	if (!backendW) return;

	backendW.value = value;
}

function pushModeChange(node, controllerId) {
	if (!node) return;

	if (!node.modeStack) {
		node.modeStack = [];
	}

	node.modeStack.push({ controllerId, previousMode: node.mode ?? MODE_NORMAL });
}

function popModeChangesForController(node, controllerId) {
	if (!node || !node.modeStack) return;

	const stack = node.modeStack;
	for (let i = stack.length - 1; i >= 0; i--) {
		if (stack[i].controllerId === controllerId) {
			stack.splice(i, 1);
		}
	}

	const last = stack[stack.length - 1];
	node.mode  = last ? last.previousMode : MODE_NORMAL;
}

function restoreControllerTargets(controllerNode) {
	const graph = controllerNode?.graph;

	if (!graph) return;

	const state = getGraphState(graph);

	if (!state) return;

	const controllerId = controllerNode.id;
	const set          = state.controllers.get(controllerId);

	if (!set) return;

	for (const nodeId of set) {
		const n = graph.getNodeById(nodeId);

		if (!n) continue;

		popModeChangesForController(n, controllerId);
	}

	state.controllers.delete(controllerId);
	graph.setDirtyCanvas(true, true);
}

function applyModesToTargets(graph, controllerNode, targets, newMode) {
	if (!graph || !controllerNode || !targets?.length) return;

	const controllerId = controllerNode.id;
	const set          = getControllerSet(graph, controllerId, true);

	if (!set) return;

	for (const n of targets) {
		if (!n || n.id === controllerId) continue;

		pushModeChange(n, controllerId);
		n.mode = newMode;
		set.add(n.id);
	}

	graph.setDirtyCanvas(true, true);
}

/* ---------- ByClass controller ---------- */

function readByClassState(node) {
	const targetW = getWidget(node, "TargetClass");
	const modeW   = getWidget(node, "Mode");

	const target   = (targetW?.value ?? "").toString().trim();
	const selected = (modeW?.value ?? "Enabled").toString();

	return {
		target,
		selected,
		newMode: modeSelectionToNodeMode(selected),
	};
}

function findByClassTargets(node, state) {
	const graph = node?.graph;

	if (!graph) return [];

	if (!state.target || selectionState(state.selected) === "Enabled") return [];

	const targets = [];

	for (const n of graph._nodes || []) {
		if (!n || n.id === node.id) continue;

		if (getClassName(n) !== state.target) continue;

		targets.push(n);
	}

	return targets;
}

function applyByClass(node) {
	const graph = node?.graph;

	if (!graph) return;

	restoreControllerTargets(node);

	const state   = readByClassState(node);
	const targets = findByClassTargets(node, state);

	if (!targets.length || selectionState(state.selected) === "Enabled") {
		graph.setDirtyCanvas(true, true);

		return;
	}

	applyModesToTargets(graph, node, targets, state.newMode);
}

function hookSetModeByClass(node) {
	node.onResize = function () {
		this.size[1] = 80;
	};

	const modeW   = getWidget(node, "Mode");
	const targetW = getWidget(node, "TargetClass");

	if (modeW) {
		setComboOptions(modeW, CLASS_MODE_OPTIONS);

		if (!CLASS_MODE_OPTIONS.includes(modeW.value)) modeW.value = "Enabled";

		const old = modeW.callback;

		modeW.callback = function () {
			if (old) old.apply(this, arguments);
			applyByClass(node);
		};
	}

	if (targetW) {
		const old = targetW.callback;

		targetW.callback = function () {
			if (old) old.apply(this, arguments);

			applyByClass(node);
		};
	}

	if (!node.onAdded) {
		node.onAdded = function () {
			queueMicrotask(() => {
				applyByClass(node);
			});
		};
	} else {
		const orig = node.onAdded;
		node.onAdded = function () {
			orig.apply(this, arguments);
			queueMicrotask(() => {
				applyByClass(node);
			});
		};
	}

	const origRemoved = node.onRemoved;
	node.onRemoved = function () {
		restoreControllerTargets(node);
		node.graph?.setDirtyCanvas(true, true);

		if (origRemoved) return origRemoved.apply(this, arguments);
	};
}

/* ---------- Connected controller ---------- */

function connectedModeOptionsForInput(controllerNode, inputIndex) {
	const connected = getConnectedSourceNodes(controllerNode, inputIndex);

	if (!connected.length) return [NO_CONNECTION];

	const name = getNodeName(connected[0]);

	return [`${name}: Enabled`, `${name}: Muted`, `${name}: Bypassed`];
}

function updateConnectedModeWidgets(controllerNode) {
	const entries = ensureInputModeWidgets(
		controllerNode,
		() => applyConnected(controllerNode)
	);

	if (!entries.length) {
		setBackendModeValue(controllerNode, NO_CONNECTION);
		controllerNode.setDirtyCanvas(true, true);

		return;
	}

	for (const entry of entries) {
		const previousState = selectionState((entry.widget?.value ?? "").toString());
		const options = connectedModeOptionsForInput(controllerNode, entry.index);
		setComboOptions(entry.widget, options);

		if (options.length === 1 && options[0] === NO_CONNECTION) {
			entry.widget.value = NO_CONNECTION;

			continue;
		}

		const preferred = options.find((o) => normalizeMode(o) === previousState) || options[0];
		entry.widget.value = preferred;
	}

	setBackendModeValue(
		controllerNode,
		(entries[0].widget?.value ?? NO_CONNECTION).toString()
	);
	controllerNode.setDirtyCanvas(true, true);
}

function applyConnected(controllerNode) {
	const graph = controllerNode?.graph;

	if (!graph) return;

	const entries = ensureInputModeWidgets(
		controllerNode,
		() => applyConnected(controllerNode)
	);

	restoreControllerTargets(controllerNode);

	if (!entries.length) {
		setBackendModeValue(controllerNode, NO_CONNECTION);
		graph.setDirtyCanvas(true, true);

		return;
	}

	setBackendModeValue(controllerNode, (entries[0].widget?.value ?? NO_CONNECTION).toString());

	let appliedAny = false;

	for (const entry of entries) {
		const selected = (entry.widget?.value ?? NO_CONNECTION).toString();
		const newMode  = modeSelectionToNodeMode(selected);

		if (selected === NO_CONNECTION || newMode === MODE_NORMAL) continue;

		const targets = getConnectedSourceNodes(controllerNode, entry.index);

		if (!targets.length) continue;

		applyModesToTargets(graph, controllerNode, targets, newMode);
		appliedAny = true;
	}

	if (!appliedAny) {
		graph.setDirtyCanvas(true, true);
	}
}

function hookSetModeConnected(node) {
	const backendW = getWidget(node, "Mode");

	if (backendW) {
		node.JohnsSetModeBackendWidget = backendW;
	}

	ensureInputModeWidgets(node, () => applyConnected(node));

	queueMicrotask(() => {
		updateConnectedModeWidgets(node);
		applyConnected(node);
	});

	const origOnAdded = node.onAdded;
	node.onAdded = function () {
		if (origOnAdded) {
			origOnAdded.apply(this, arguments);
		}
		queueMicrotask(() => {
			updateConnectedModeWidgets(node);
			applyConnected(node);
		});
	};

	const origOnConnectionsChange = node.onConnectionsChange;
	node.onConnectionsChange = function () {
		const r = origOnConnectionsChange ? origOnConnectionsChange.apply(this, arguments) : undefined;

		updateConnectedModeWidgets(node);
		applyConnected(node);

		return r;
	};

	const origRemoved = node.onRemoved;
	node.onRemoved = function () {
		restoreControllerTargets(node);
		node.graph?.setDirtyCanvas(true, true);

		if (origRemoved) return origRemoved.apply(this, arguments);
	};
}

/* ---------- Subgraph proxy handling ---------- */

function hookSubgraphProxyNode(node) {
	const proxies = node?.properties?.proxyWidgets;

	if (!Array.isArray(proxies) || proxies.length === 0) return;

	const subgraph = node.subgraph || node.subgraph_graph;

	if (!subgraph) return;

	const modeProxies = proxies
		.map((p) => {
			if (!Array.isArray(p) || p.length < 2) return null;

			return {
				internalId: parseInt(p[0], 10),
				widgetName: (p[1] ?? "").toString(),
			};
		})
		.filter((p) => p && Number.isFinite(p.internalId))
		.filter((p) => {
			const internal = subgraph.getNodeById(p.internalId);
			if (!internal || getClassName(internal) !== "JohnsSetModeConnected") {
				return false;
			}

			const widgetName = p.widgetName;

			return widgetName === "Mode" || isInputModeWidgetName(widgetName);
		})
		.map((p) => ({ internalId: p.internalId, widgetName: p.widgetName }));

	if (!modeProxies.length) return;

	function findInternalController(internalId) {
		const internal = subgraph.getNodeById(internalId);

		if (!internal) return null;

		if (getClassName(internal) !== "JohnsSetModeConnected") return null;

		return internal;
	}

	function syncAndApply() {
		const touchedControllers = new Set();

		for (const proxy of modeProxies) {
			const proxyWidget = getWidget(node, proxy.widgetName);

			if (!proxyWidget) continue;

			const internal = findInternalController(proxy.internalId);

			if (!internal) {
				setComboOptions(proxyWidget, [NO_CONNECTION]);
				proxyWidget.value = NO_CONNECTION;

				continue;
			}

			ensureInputModeWidgets(internal, () => applyConnected(internal));
			updateConnectedModeWidgets(internal);

			const internalWidget = proxy.widgetName === "Mode" ? getFirstInputModeWidget(internal) : getWidget(internal, proxy.widgetName);

			if (!internalWidget) {
				setComboOptions(proxyWidget, [NO_CONNECTION]);
				proxyWidget.value = NO_CONNECTION;

				continue;
			}

			const options = getComboOptions(internalWidget);
			setComboOptions(proxyWidget, options);

			if (options.includes(proxyWidget.value)) {
				internalWidget.value = proxyWidget.value;
			} else {
				proxyWidget.value = internalWidget.value;
			}

			touchedControllers.add(internal.id);
		}

		for (const internalId of touchedControllers) {
			const internal = subgraph.getNodeById(internalId);
			if (!internal) continue;
			applyConnected(internal);
		}

		node.setDirtyCanvas(true, true);
	}

	if (!node.onAdded) {
		node.onAdded = function () {
			syncAndApply();
		};
	} else {
		const orig = node.onAdded;
		node.onAdded = function () {
			orig.apply(this, arguments);
			syncAndApply();
		};
	}

	for (const proxy of modeProxies) {
		const proxyWidget = getWidget(node, proxy.widgetName);

		if (!proxyWidget || proxyWidget.JohnsSetModeProxyCallbackPatched) continue;

		const oldCb = proxyWidget.callback;

		proxyWidget.callback = function () {
			if (oldCb) oldCb.apply(this, arguments);
			syncAndApply();
		};

		proxyWidget.JohnsSetModeProxyCallbackPatched = true;
	}

	const origOnConnectionsChange = node.onConnectionsChange;

	node.onConnectionsChange = function () {
		const r = origOnConnectionsChange ? origOnConnectionsChange.apply(this, arguments) : undefined;
		syncAndApply();

		return r;
	};
}

app.registerExtension({
	name: "JohnsSetMode",
	async nodeCreated(node) {
		if (node.comfyClass === "JohnsSetModeByClass") {
			hookSetModeByClass(node);
			
			return;
		}

		if (node.comfyClass === "JohnsSetModeConnected") {
			hookSetModeConnected(node);
			//RemoveWidget(node, "Mode");

			return;
		}

		hookSubgraphProxyNode(node);
	},
});
