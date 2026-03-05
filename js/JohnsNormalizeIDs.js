import { app } from "/scripts/app.js";
import { ComfyButtonGroup } from "/scripts/ui/components/buttonGroup.js";
import { ComfyButton } from "/scripts/ui/components/button.js";

const BUTTON_GROUP_CLASS  = "normalize-ids-top-menu-group";
const TOOLTIP             = "Normalize Node IDs - Selected nodes prioritized";
const MAX_ATTACH_ATTEMPTS = 120;

function addNodeId(idSet, rawId) {
	const id = Number(rawId);

	if (Number.isFinite(id)) {
		idSet.add(id);
	}
}

function getSelectedNodeIds() {
	const ids      = new Set();
	const canvas   = globalThis.LGraphCanvas?.active_canvas ?? app.canvas;
	const selected = canvas?.selected_nodes;

	if (Array.isArray(selected)) {
		for (const entry of selected) {
			if (entry && typeof entry === "object") {
				addNodeId(ids, entry.id);
			} else {
				addNodeId(ids, entry);
			}
		}
	} else if (selected && typeof selected === "object") {
		for (const [key, value] of Object.entries(selected)) {
			if (value && typeof value === "object" && "id" in value) {
				addNodeId(ids, value.id);
			} else {
				addNodeId(ids, key);
			}
		}
	}

	if (ids.size === 0 && Array.isArray(app.graph?._nodes)) {
		for (const node of app.graph._nodes) {
			if (node?.selected) {
				addNodeId(ids, node.id);
			}
		}
	}

	return ids;
}

function getNodePos(node) {
	const pos = node?.pos;

	if (Array.isArray(pos)) {
		return [Number(pos[0]) || 0, Number(pos[1]) || 0];
	}

	if (pos && typeof pos === "object") {
		return [Number(pos.x ?? pos[0]) || 0, Number(pos.y ?? pos[1]) || 0];
	}

	return [0, 0];
}

function compareByGraphPosition(a, b) {
	const [ax, ay] = getNodePos(a);
	const [bx, by] = getNodePos(b);

	if (ax !== bx) return ax - bx;
	if (ay !== by) return ay - by;

	return (Number(a?.id) || 0) - (Number(b?.id) || 0);
}

const EMPTY_ID_SET = new Set();

function normalizeGraphId(rawId) {
	if (rawId == null) return null;

	if (typeof rawId === "string" || typeof rawId === "number") {
		return String(rawId);
	}

	return null;
}

function getSelectionForGraph(graphData, selectedIds, activeGraphId, isRoot = false) {
	if (!(selectedIds instanceof Set) || selectedIds.size === 0) {
		return EMPTY_ID_SET;
	}

	if (activeGraphId != null) {
		const graphId = normalizeGraphId(graphData?.id);

		if (graphId != null) {
			return graphId === activeGraphId ? selectedIds : EMPTY_ID_SET;
		}

		return isRoot ? selectedIds : EMPTY_ID_SET;
	}

	return isRoot ? selectedIds : EMPTY_ID_SET;
}

function remapLink(link, idMap) {
	if (Array.isArray(link)) {
		const [id, origin, originSlot, target, targetSlot, type] = link;
		return [
			id,
			idMap[origin] ?? origin,
			originSlot,
			idMap[target] ?? target,
			targetSlot,
			type
		];
	}

	if (link && typeof link === "object") {
		const mapped = { ...link };

		if ("origin_id" in mapped) {
			mapped.origin_id = idMap[mapped.origin_id] ?? mapped.origin_id;
		}

		if ("target_id" in mapped) {
			mapped.target_id = idMap[mapped.target_id] ?? mapped.target_id;
		}

		if ("originId" in mapped) {
			mapped.originId = idMap[mapped.originId] ?? mapped.originId;
		}

		if ("targetId" in mapped) {
			mapped.targetId = idMap[mapped.targetId] ?? mapped.targetId;
		}

		return mapped;
	}

	return link;
}

function getLinkId(link, fallbackId = null) {
	if (Array.isArray(link)) {
		const id = Number(link[0]);

		return Number.isFinite(id) ? id : null;
	}

	if (link && typeof link === "object") {
		const id = Number(link.id ?? fallbackId);

		return Number.isFinite(id) ? id : null;
	}

	if (fallbackId != null) {
		const id = Number(fallbackId);

		return Number.isFinite(id) ? id : null;
	}

	return null;
}

function remapLinksAndFindMax(links, idMap) {
	if (Array.isArray(links)) {
		let maxLinkId = 0;
		const remapped = links.map((link) => {
			const mapped = remapLink(link, idMap);
			const linkId = getLinkId(mapped);

			if (linkId != null && linkId > maxLinkId) {
				maxLinkId = linkId;
			}

			return mapped;
		});

		return { links: remapped, maxLinkId };
	}

	if (links && typeof links === "object") {
		let maxLinkId  = 0;
		const remapped = {};

		for (const [key, link] of Object.entries(links)) {
			const mapped  = remapLink(link, idMap);
			remapped[key] = mapped;

			const linkId = getLinkId(mapped, key);

			if (linkId != null && linkId > maxLinkId) {
				maxLinkId = linkId;
			}
		}

		return { links: remapped, maxLinkId };
	}

	return { links, maxLinkId: 0 };
}

function normalizeGraphContainer(graphData, selectedIds = EMPTY_ID_SET) {
	if (!graphData || !Array.isArray(graphData.nodes) || graphData.nodes.length === 0) {
		return { normalized: false, hasSelection: false };
	}

	let hasSelection = false;

	if (selectedIds.size > 0) {
		hasSelection = graphData.nodes.some((node) => selectedIds.has(Number(node?.id)));
	}

	const sortedNodes = [...graphData.nodes].sort((a, b) => {
		if (hasSelection) {
			const aSelected = selectedIds.has(Number(a?.id));
			const bSelected = selectedIds.has(Number(b?.id));

			if (aSelected !== bSelected) return aSelected ? -1 : 1;
		}

		return compareByGraphPosition(a, b);
	});

	const idMap = {};
	sortedNodes.forEach((node, index) => {
		idMap[node.id] = index + 1;
	});

	graphData.nodes = sortedNodes.map((node) => ({
		...node,
		id: idMap[node.id]
	}));

	const { links: remappedLinks, maxLinkId } = remapLinksAndFindMax(graphData.links, idMap);
	graphData.links = remappedLinks;

	if ("last_node_id" in graphData || !graphData.state) {
		graphData.last_node_id = graphData.nodes.length;
	}

	if ("last_link_id" in graphData || !graphData.state) {
		graphData.last_link_id = maxLinkId;
	}

	if (graphData.state && typeof graphData.state === "object") {
		graphData.state.lastNodeId = graphData.nodes.length;
		graphData.state.lastLinkId = maxLinkId;
	}

	return { normalized: true, hasSelection };
}

function getSubgraphContainers(workflow) {
	const results = [];
	const seen = new WeakSet();

	const addList = (list) => {
		if (!Array.isArray(list)) return;

		for (const graph of list) {
			if (!graph || typeof graph !== "object") continue;
			if (seen.has(graph)) continue;

			seen.add(graph);
			results.push(graph);
		}
	};

	addList(workflow?.subgraphs);
	addList(workflow?.definitions?.subgraphs);

	return results;
}

function normalizeWorkflow() {
	const raw = localStorage.getItem("workflow");

	if (!raw) {
		alert("No workflow found in localStorage.");

		return;
	}

	let wf;
	try {
		wf = JSON.parse(raw);
	} catch (error) {
		console.error("Failed to parse workflow JSON.", error);
		alert("Failed to parse workflow in localStorage.");

		return;
	}

	if (!Array.isArray(wf.nodes) || wf.nodes.length === 0) {
		alert("Workflow has no nodes to normalize.");

		return;
	}

	const selectedIds   = getSelectedNodeIds();
	const activeGraphId = normalizeGraphId(app.graph?.id);

	const rootSelection = getSelectionForGraph(wf, selectedIds, activeGraphId, true);
	const rootResult    = normalizeGraphContainer(wf, rootSelection);

	const subgraphs       = getSubgraphContainers(wf);
	let selectedSubgraphs = 0;

	for (const subgraph of subgraphs) {
		const subgraphSelection = getSelectionForGraph(subgraph, selectedIds, activeGraphId, false);
		const result            = normalizeGraphContainer(subgraph, subgraphSelection);

		if (result.hasSelection) {
			selectedSubgraphs += 1;
		}
	}

	localStorage.setItem("workflow", JSON.stringify(wf));

	app.graph.clear();
	app.loadGraphData(wf, false);
	app.graph.setDirtyCanvas(true, true);

	const modeLabel = rootResult.hasSelection || selectedSubgraphs > 0 ? "Selected first" : "All";
	console.log(
		`Workflow IDs normalized (${modeLabel}, sorted by graph position, subgraphs normalized: ${subgraphs.length}).`
	);
}

const CreateButton = () => {
	const button = new ComfyButton({
		tooltip: TOOLTIP,
		app,
		enabled: true,
		classList: "comfyui-button comfyui-menu-mobile-collapse"
	});

	button.element.classList.add("normalize-ids-btn");
	button.element.setAttribute("aria-label", TOOLTIP);
	button.element.title = TOOLTIP;
	button.element.textContent = "ID";

	button.element.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		normalizeWorkflow();
	});

	return button;
};

const AttachButton = (attempt = 0) => {
	if (document.querySelector(`.${BUTTON_GROUP_CLASS}`)) return;

	const settingsGroup = app.menu?.settingsGroup;

	if (!settingsGroup?.element?.parentElement) {
		if (attempt >= MAX_ATTACH_ATTEMPTS) return;

		requestAnimationFrame(() => AttachButton(attempt + 1));

		return;
	}

	const button = CreateButton();
	const group  = new ComfyButtonGroup(button);

	group.element.classList.add(BUTTON_GROUP_CLASS);
	settingsGroup.element.before(group.element);
};

app.registerExtension({
	name: "JohnsNormalizeIDs",
	async setup() {
		AttachButton();
	}
});
