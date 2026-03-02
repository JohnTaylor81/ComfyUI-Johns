import { app } from "/scripts/app.js";
import { RemoveWidget } from "./JohnsWidgetHacks.js";

const MODE_NORMAL = 0;
const MODE_MUTE = 2;
const MODE_BYPASS = 4;

const CLASS_MODE_OPTIONS = ["Enabled", "Muted", "Bypassed"];
const NO_CONNECTION = "No Connection";

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
				id: l[0],
				origin_id: l[1],
				origin_slot: l[2],
				target_id: l[3],
				target_slot: l[4],
				type: l[5],
			};
		}

		if (typeof l === "object" && l.id === linkId) return l;
	}

	return null;
}

function getConnectedSourceNodeIds(controllerNode) {
	const graph = controllerNode?.graph;
	if (!graph || !controllerNode?.inputs?.length) return [];

	const input = controllerNode.inputs[0];
	const linkId = input?.link;
	if (linkId == null) return [];

	const link = resolveLink(graph, linkId);
	if (!link || link.origin_id == null || link.origin_id === controllerNode.id) return [];

	return [link.origin_id];
}

function getConnectedSourceNodes(controllerNode) {
	const graph = controllerNode?.graph;
	if (!graph) return [];

	return getConnectedSourceNodeIds(controllerNode)
		.map((id) => graph.getNodeById(id))
		.filter(Boolean);
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
	w.value = initial;

	return w;
}

function getModeBackendWidget(node) {
	return node.JohnsSetModeBackendWidget || getWidget(node, "Mode");
}

function getModeUIWidget(node) {
	return node.JohnsSetModeUIWidget || getWidget(node, "Mode");
}

function ensureModeComboWidget(node, onChange) {
	let uiW = node.JohnsSetModeUIWidget;
	if (uiW) return uiW;

	const backendW = getWidget(node, "Mode");
	if (!backendW) return null;

	node.JohnsSetModeBackendWidget = backendW;

	const initial = ((backendW.value ?? NO_CONNECTION).toString() || NO_CONNECTION);

	uiW = makeCombo(
		node,
		"Mode",
		initial,
		(value) => {
			setBackendModeValue(node, value);
			onChange?.(value);
		},
		[initial]
	);

	node.JohnsSetModeUIWidget = uiW;
	return uiW;
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

	if (!node._johnsModeStack) {
		node._johnsModeStack = [];
	}

	node._johnsModeStack.push({
		controllerId,
		previousMode: node.mode ?? MODE_NORMAL,
	});
}

function popModeChangesForController(node, controllerId) {
	if (!node || !node._johnsModeStack) return;

	const stack = node._johnsModeStack;
	for (let i = stack.length - 1; i >= 0; i--) {
		if (stack[i].controllerId === controllerId) {
			stack.splice(i, 1);
		}
	}

	const last = stack[stack.length - 1];
	node.mode = last ? last.previousMode : MODE_NORMAL;
}

function restoreControllerTargets(controllerNode) {
	const graph = controllerNode?.graph;
	if (!graph) return;

	const state = getGraphState(graph);
	if (!state) return;

	const controllerId = controllerNode.id;
	const set = state.controllers.get(controllerId);
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
	const set = getControllerSet(graph, controllerId, true);
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
	const modeW = getWidget(node, "Mode");

	const target = (targetW?.value ?? "").toString().trim();
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

	const state = readByClassState(node);
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

	const modeW = getWidget(node, "Mode");
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

	// Lifecycle-safe: run once after creation/configuration
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

function connectedModeOptions(controllerNode) {
	const connected = getConnectedSourceNodes(controllerNode);
	if (!connected.length) return [NO_CONNECTION];

	const name = getNodeName(connected[0]);
	return [`${name}: Enabled`, `${name}: Muted`, `${name}: Bypassed`];
}

function updateConnectedModeWidget(controllerNode) {
	const modeW = getModeUIWidget(controllerNode);
	const backendW = getModeBackendWidget(controllerNode);
	if (!modeW || !backendW) return;

	const previousState = selectionState(
		(modeW.value ?? backendW.value ?? "").toString()
	);

	const options = connectedModeOptions(controllerNode);
	setComboOptions(modeW, options);

	if (options.length === 1 && options[0] === NO_CONNECTION) {
		modeW.value = NO_CONNECTION;
		setBackendModeValue(controllerNode, NO_CONNECTION);
		controllerNode.setDirtyCanvas(true, true);
		return;
	}

	const preferred =
		options.find((o) => normalizeMode(o) === previousState) || options[0];

	modeW.value = preferred;
	setBackendModeValue(controllerNode, preferred);
	controllerNode.setDirtyCanvas(true, true);
}

function applyConnected(controllerNode) {
	const graph = controllerNode?.graph;
	if (!graph) return;

	const modeW = getModeUIWidget(controllerNode);
	const backendW = getModeBackendWidget(controllerNode);
	if (!modeW || !backendW) return;

	restoreControllerTargets(controllerNode);

	const selected = (modeW.value ?? NO_CONNECTION).toString();
	setBackendModeValue(controllerNode, selected);

	const newMode = modeSelectionToNodeMode(selected);
	if (newMode === MODE_NORMAL || selected === NO_CONNECTION) {
		graph.setDirtyCanvas(true, true);
		return;
	}

	const targets = getConnectedSourceNodes(controllerNode);
	if (!targets.length) {
		graph.setDirtyCanvas(true, true);
		return;
	}

	applyModesToTargets(graph, controllerNode, targets, newMode);
}

function hookSetModeConnected(node) {
	const modeW = ensureModeComboWidget(node, () => applyConnected(node));
	if (!modeW) return;

	// Defer until graph fully restored
	queueMicrotask(() => {
		updateConnectedModeWidget(node);
		applyConnected(node);
	});

	const origOnConnectionsChange = node.onConnectionsChange;
	node.onConnectionsChange = function () {
		const r = origOnConnectionsChange
			? origOnConnectionsChange.apply(this, arguments)
			: undefined;

		updateConnectedModeWidget(node);
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

	const modeProxy = proxies.find(
		(p) => Array.isArray(p) && p.length >= 2 && p[1] === "Mode"
	);
	if (!modeProxy) return;

	const subgraph = node.subgraph || node.subgraph_graph;
	if (!subgraph) return;

	const internalId = parseInt(modeProxy[0], 10);
	if (!Number.isFinite(internalId)) return;

	const proxyModeWidget = ensureModeComboWidget(node);
	if (!proxyModeWidget) return;

	function findInternalController() {
		const internal = subgraph.getNodeById(internalId);
		if (!internal) return null;
		if (getClassName(internal) !== "JohnsSetModeConnected") return null;
		return internal;
	}

	function syncAndApply() {
		const internal = findInternalController();
		if (!internal) {
			setComboOptions(proxyModeWidget, [NO_CONNECTION]);
			proxyModeWidget.value = NO_CONNECTION;
			node.setDirtyCanvas(true, true);
			return;
		}

		ensureModeComboWidget(internal, () => applyConnected(internal));
		updateConnectedModeWidget(internal);

		const internalModeUI = getModeUIWidget(internal);
		const internalModeBackend = getModeBackendWidget(internal);
		if (!internalModeUI || !internalModeBackend) return;

		const options = getComboOptions(internalModeUI);
		setComboOptions(proxyModeWidget, options);

		if (options.includes(proxyModeWidget.value)) {
			internalModeUI.value = proxyModeWidget.value;
			setBackendModeValue(internal, proxyModeWidget.value);
		} else {
			proxyModeWidget.value = internalModeUI.value;
		}

		applyConnected(internal);
		node.setDirtyCanvas(true, true);
	}

	// Try once on creation/configuration
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

	const oldCb = proxyModeWidget.callback;
	proxyModeWidget.callback = function () {
		if (oldCb) oldCb.apply(this, arguments);
		syncAndApply();
	};

	const origOnConnectionsChange = node.onConnectionsChange;
	node.onConnectionsChange = function () {
		const r = origOnConnectionsChange
			? origOnConnectionsChange.apply(this, arguments)
			: undefined;
		syncAndApply();
		return r;
	};
}

/* ---------- Extension registration ---------- */

app.registerExtension({
	name: "JohnsSetMode",
	async nodeCreated(node) {
		if (node.comfyClass === "JohnsSetModeByClass") {
			hookSetModeByClass(node);
			return;
		}

		if (node.comfyClass === "JohnsSetModeConnected") {
			hookSetModeConnected(node);
			RemoveWidget(node, "Mode");

			return;
		}

		hookSubgraphProxyNode(node);
	},
});
