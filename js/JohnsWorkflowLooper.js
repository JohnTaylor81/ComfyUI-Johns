import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";

const STATE = {
	active           : false,
	iter             : 0,
	count            : 1,
	startNode        : null,
	endNode          : null,
	loadNode         : null,
	originalLoadValue: null,
	lastRelPath      : null
};

function FindSingleNodeByClass(comfyClass) {
	const nodes = (app.graph?._nodes || []).filter((n) => n?.comfyClass === comfyClass);

	return nodes.length ? nodes[0]: null;
}

function GetInputLinkOriginNode(node, inputIndex = 0) {
	if (!node?.inputs?.[inputIndex]) return null;

	const linkId = node.inputs[inputIndex].link;

	if (linkId == null) return null;

	const link = app.graph?.links?.[linkId];

	if (!link) return null;

	const originId = link.origin_id;

	return app.graph?._nodes_by_id?.[originId] || (app.graph?._nodes || []).find((n) => n?.id === originId) || null;
}

function FindUpstreamNodeWithWidget(node, widgetName, inputIndex = 0, maxNodes = 256) {
	const start = GetInputLinkOriginNode(node, inputIndex);

	if (!start) return null;

	const q       = [start];
	const visited = new Set();

	while (q.length && visited.size < maxNodes) {
		const cur = q.shift();

		if (!cur || visited.has(cur.id)) continue;

		visited.add(cur.id);

		if (GetWidget(cur, widgetName)) return cur;

		const inputs = cur?.inputs || [];

		for (let i = 0; i < inputs.length; i++) {
			const up = GetInputLinkOriginNode(cur, i);

			if (up && !visited.has(up.id)) q.push(up);
		}
	}

	return null;
}

function GetWidget(node, name) {
	return (node?.widgets || []).find((w) => w?.name === name) || null;
}

function SetWidgetValue(node, name, value) {
	const w = GetWidget(node, name);

	if (!w) return false;

	w.value = value;
	node.setDirtyCanvas(true, true);
	app.graph.setDirtyCanvas(true, true);
	app.graph.change();

	return true;
}

function QueuePrompt() {
	try {
		if (typeof app.queuePrompt === "function") {
			if (app.queuePrompt.length >= 1) app.queuePrompt(0);
			else app.queuePrompt();
			
			return;
		}

		if (typeof app.queuePromptAsync === "function") {
			app.queuePromptAsync();
		}
	} catch (_) { }
}

function ResetState() {
	STATE.active            = false;
	STATE.iter              = 0;
	STATE.count             = 1;
	STATE.startNode         = null;
	STATE.endNode           = null;
	STATE.loadNode          = null;
	STATE.originalLoadValue = null;
	STATE.lastRelPath       = null;
}

function EnsureWired() {
	STATE.startNode = FindSingleNodeByClass("JohnsWorkflowLoopStart");
	STATE.endNode   = FindSingleNodeByClass("JohnsWorkflowLoopEnd");

	if (!STATE.startNode || !STATE.endNode) return false;

	      STATE.loadNode = FindUpstreamNodeWithWidget(STATE.startNode, "image", 0);
	const loadWidget     = STATE.loadNode ? GetWidget(STATE.loadNode, "image") : null;

	if (!loadWidget) return false;

	STATE.originalLoadValue = loadWidget.value;

	return true;
}

api.addEventListener("/JohnsWorkflowLoopStart", ({ detail }) => {
	const startNode = FindSingleNodeByClass("JohnsWorkflowLoopStart");

	if (!startNode) return;

	startNode.properties           = startNode.properties || {};
	startNode.properties.BackendID = detail.NodeID;

	const countWidget = GetWidget(startNode, "Count");
	const count       = Number.isFinite(Number(detail?.Count)) ? Number(detail.Count) : Number(countWidget?.value || 1);

	if (!STATE.active) {
		if (!EnsureWired()) return;

		STATE.active = true;
		STATE.iter   = 0;
		STATE.count  = Math.max(1, Math.min(999, count || 1));
	} else {
		STATE.count = Math.max(1, Math.min(999, count || STATE.count));
	}
});

api.addEventListener("/JohnsWorkflowLoopEnd", ({ detail }) => {
	const endNode = FindSingleNodeByClass("JohnsWorkflowLoopEnd");

	if (!endNode) return;

	endNode.properties           = endNode.properties || {};
	endNode.properties.BackendID = detail.NodeID;

	if (!STATE.active) {
		if (!EnsureWired()) return;

		      STATE.active = true;
		      STATE.iter   = 0;
		const countWidget  = GetWidget(STATE.startNode, "Count");
		      STATE.count  = Math.max(1, Math.min(999, Number(countWidget?.value || 1)));
	}

	STATE.lastRelPath = detail?.RelPath || null;

	if (!STATE.lastRelPath) return;

	const nextIter = STATE.iter + 1;

	if (nextIter >= STATE.count) {
		ResetState();

		return;
	}

	STATE.iter = nextIter;

	if (!STATE.loadNode) {
		if (!EnsureWired()) return;
	}

	const ok = SetWidgetValue(STATE.loadNode, "image", STATE.lastRelPath);

	if (!ok) return;

	QueuePrompt();
});
