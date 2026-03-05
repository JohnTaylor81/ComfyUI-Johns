import { app } from "/scripts/app.js";

const MODE_NORMAL       = 0;
const MODE_MUTE         = 2;
const MAX_SWITCH_INPUTS = 50;

const modeChanges = new WeakMap();

function getWidget(node, name) {
	return (node.widgets || []).find((w) => w.name === name);
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

function getGraphState(graph) {
	if (!graph) return null;

	let state = modeChanges.get(graph);

	if (!state) {
		state = { controllers: new Map() };
		modeChanges.set(graph, state);
	}

	return state;
}

function getControllerKey(node) {
	return `JohnsAnySwitch:${node?.id ?? "unknown"}`;
}

function getControllerSet(graph, controllerKey, create = true) {
	const state = getGraphState(graph);

	if (!state) return null;

	let set = state.controllers.get(controllerKey);

	if (!set && create) {
		set = new Set();
		state.controllers.set(controllerKey, set);
	}

	return set || null;
}

function pushModeChange(node, controllerKey) {
	if (!node) return;

	if (!node.modeStack) {
		node.modeStack = [];
	}

	node.modeStack.push({ controllerId: controllerKey, previousMode: node.mode ?? MODE_NORMAL });
}

function popModeChangesForController(node, controllerKey) {
	if (!node || !node.modeStack) return;

	const stack = node.modeStack;

	for (let i = stack.length - 1; i >= 0; i--) {
		if (stack[i].controllerId === controllerKey) {
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

	const controllerKey = getControllerKey(controllerNode);
	const set           = state.controllers.get(controllerKey);

	if (!set) return;

	for (const nodeId of set) {
		const n = graph.getNodeById(nodeId);

		if (!n) continue;

		popModeChangesForController(n, controllerKey);
	}

	state.controllers.delete(controllerKey);
	graph.setDirtyCanvas(true, true);
}

function applyMuteToTargets(graph, controllerNode, targets) {
	if (!graph || !controllerNode || !targets?.length) return;

	const controllerKey = getControllerKey(controllerNode);
	const set           = getControllerSet(graph, controllerKey, true);

	if (!set) return;

	for (const n of targets) {
		if (!n || n.id === controllerNode.id) continue;

		pushModeChange(n, controllerKey);
		n.mode = MODE_MUTE;
		set.add(n.id);
	}

	graph.setDirtyCanvas(true, true);
}

function toInteger(value, fallback = 0) {
	const n = Number(value);

	if (!Number.isFinite(n)) return fallback;

	return Math.floor(n);
}

function asBoolean(value) {
	if (typeof value === "boolean") return value;
	if (typeof value === "number") return value !== 0;

	const text = (value ?? "").toString().trim().toLowerCase();

	return text === "true" || text === "1" || text === "yes" || text === "on";
}

function getSwitchInputSlots(node) {
	if (!Array.isArray(node?.inputs) || node.inputs.length === 0) return [];

	const slots = node.inputs
		.map((input, index) => ({
			index,
			input,
			name : (input?.name ?? "").toString().trim().toLowerCase(),
			label: (input?.label ?? "").toString().trim().toLowerCase(),
		}))
		.filter((slot) => slot.name  !== "selection")
		.filter((slot) => slot.name  !== "muteupstream")
		.filter((slot) => slot.label !== "selection")
		.filter((slot) => slot.label !== "mute upstream")
		.filter((slot) => slot.label !== "muteupstream");

	if (!slots.length) return [];

	const lastSlot = slots[slots.length - 1];
	const hasTail  = slots.length < MAX_SWITCH_INPUTS && lastSlot.input?.link == null;

	return hasTail ? slots.slice(0, -1) : slots;
}

function getConnectedSourceNodeIds(node, inputIndex) {
	const graph = node?.graph;

	if (!graph || !Number.isFinite(inputIndex)) return [];

	const input  = node?.inputs?.[inputIndex];
	const linkId = input?.link;

	if (linkId == null) return [];

	const link = resolveLink(graph, linkId);

	if (!link || link.origin_id == null || link.origin_id === node.id) return [];

	return [link.origin_id];
}

function collectUpstreamNodeIds(graph, rootNodeIds, stopNodeId) {
	const visited = new Set();
	const stack   = [...rootNodeIds];

	while (stack.length) {
		const nodeId = stack.pop();

		if (nodeId == null || nodeId === stopNodeId || visited.has(nodeId)) continue;

		visited.add(nodeId);

		const node = graph.getNodeById(nodeId);

		if (!node || !Array.isArray(node.inputs)) continue;

		for (const input of node.inputs) {
			const linkId = input?.link;

			if (linkId == null) continue;

			const link = resolveLink(graph, linkId);

			if (!link || link.origin_id == null) continue;

			if (link.origin_id === nodeId || link.origin_id === stopNodeId) continue;

			stack.push(link.origin_id);
		}
	}

	return visited;
}

function computeMuteTargets(controllerNode) {
	const graph = controllerNode?.graph;

	if (!graph) return [];

	const slots         = getSwitchInputSlots(controllerNode);
	const selectionW    = getWidget(controllerNode, "Selection");
	const selection     = toInteger(selectionW?.value, 0);
	const selectedRoots = new Set();
	const mutedRoots    = new Set();

	for (const slot of slots) {
		const sourceIds = getConnectedSourceNodeIds(controllerNode, slot.index);

		if (!sourceIds.length) continue;

		const targetSet = slot.index === selection ? selectedRoots : mutedRoots;

		for (const sourceId of sourceIds) {
			targetSet.add(sourceId);
		}
	}

	if (!mutedRoots.size) return [];

	const selectedTree = collectUpstreamNodeIds(graph, selectedRoots, controllerNode.id);
	const mutedTree    = collectUpstreamNodeIds(graph, mutedRoots, controllerNode.id);
	const targets      = [];

	for (const nodeId of mutedTree) {
		if (selectedTree.has(nodeId)) continue;

		const node = graph.getNodeById(nodeId);

		if (!node || node.id === controllerNode.id) continue;

		targets.push(node);
	}

	return targets;
}

function patchWidgetCallback(widget, onChange, flagName) {
	if (!widget || widget[flagName]) return;

	const oldCb = widget.callback;

	widget.callback = function () {
		if (oldCb) oldCb.apply(this, arguments);
		onChange?.();
	};

	widget[flagName] = true;
}

function ensureWidgetCallbacks(node, onChange) {
	patchWidgetCallback(getWidget(node, "Selection"), onChange, "JohnsAnySwitchSelectionCallbackPatched");
	patchWidgetCallback(getWidget(node, "MuteUpstream"), onChange, "JohnsAnySwitchMuteCallbackPatched");
}

function applyUpstreamMuting(controllerNode) {
	const graph = controllerNode?.graph;

	if (!graph) return;

	restoreControllerTargets(controllerNode);

	const muteW = getWidget(controllerNode, "MuteUpstream");

	if (!asBoolean(muteW?.value)) {
		graph.setDirtyCanvas(true, true);

		return;
	}

	const targets = computeMuteTargets(controllerNode);

	if (!targets.length) {
		graph.setDirtyCanvas(true, true);

		return;
	}

	applyMuteToTargets(graph, controllerNode, targets);
}

function hookAnySwitchNode(node) {
	if (!node || node.JohnsAnySwitchHooked) return;

	node.JohnsAnySwitchHooked = true;

	const runApply = () => {
		ensureWidgetCallbacks(node, runApply);
		queueMicrotask(() => applyUpstreamMuting(node));
	};

	runApply();

	const origOnAdded = node.onAdded;
	node.onAdded = function () {
		const result = origOnAdded ? origOnAdded.apply(this, arguments) : undefined;
		runApply();

		return result;
	};

	const origOnConnectionsChange = node.onConnectionsChange;
	node.onConnectionsChange = function () {
		const result = origOnConnectionsChange ? origOnConnectionsChange.apply(this, arguments) : undefined;
		runApply();

		return result;
	};

	const origRemoved = node.onRemoved;
	node.onRemoved = function () {
		restoreControllerTargets(node);
		node.graph?.setDirtyCanvas(true, true);

		if (origRemoved) return origRemoved.apply(this, arguments);
	};
}

app.registerExtension({
	name: "JohnsAnySwitchUI",
	async beforeRegisterNodeDef(nodeType, nodeData) {
		if (nodeData?.name !== "JohnsAnySwitch") return;

		const origOnNodeCreated = nodeType.prototype.onNodeCreated;

		nodeType.prototype.onNodeCreated = function () {
			const result = origOnNodeCreated ? origOnNodeCreated.apply(this, arguments) : undefined;

			hookAnySwitchNode(this);

			return result;
		};
	},
});
