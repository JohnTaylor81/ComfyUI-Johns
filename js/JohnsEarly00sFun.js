import { app } from "/scripts/app.js";
import { getAll, subscribe } from "./JohnsSettingsState.js";

app.registerExtension({
	name: "JohnsEarly00sFun",
	async setup() {
		InitEarly00sFun();
	}
});

let chains = [];
let previousColumns = [];

function InitEarly00sFun() {
	let state = getAll();
	let danglyInstance = null;

	subscribe((newState) => {
		state = newState;
		Rebuild();
	});

	function Rebuild() {
		previousColumns = [];

		if (state.early00sFunDisableAll) {
			if (danglyInstance) {
				danglyInstance.Stop();
				danglyInstance = null;
			}
			return;
		}

		if (!danglyInstance) {
			danglyInstance = StartDangling(state);
		} else {
			danglyInstance.UpdateState(state);
		}
	}

	Rebuild();
}

function StartDangling(initialState) {
	let state   = initialState;
	let running = true;

	let mouseX = 0;
	let mouseY = 0;

	let runningNode = null;

	const trail = document.createElement("div");
	trail.id    = "johns-dangly-trail";
	document.body.appendChild(trail);

	let fontSize = state.early00sFunFontSize;

	const style = document.createElement("style");
	document.head.appendChild(style);

	function UpdateStyle() {
		style.textContent = `
		#johns-dangly-trail span {
			position: absolute;
			left: 0;
			top: 0;
			font-family: 'IBM Plex Mono', Consolas, 'Courier New', monospace;
			letter-spacing: -1px;
			font-size: ${fontSize}px;
			pointer-events: none;
			z-index: 999999;
			white-space: pre;
		}
	`;
	}

	UpdateStyle();

	document.head.appendChild(style);

	function onMouseMove(e) {
		mouseX = e.clientX + 16;
		mouseY = e.clientY + 16;
	}

	document.addEventListener("mousemove", onMouseMove);

	function onExecuting(event) {
		const nodeId = event.detail;
		runningNode = nodeId != null
			? app.graph.getNodeById(nodeId)
			: null;
	}

	app.api.addEventListener("executing", onExecuting);

	function GetWorkflowName() {
		try {
			const raw = localStorage.getItem("Comfy.PreviousWorkflow");

			if (!raw) return "Unknown";

			return raw.replace(/\.json$/i, "");
		} catch {
			return "Unknown";
		}
	}

	let lastExecTime    = null;
	let execStartTime   = null;
	let queueLength     = 0;
	let lastQueueUpdate = 0;
	let hoveredNode     = null;
	let fps             = 0;
	let frameCount      = 0;
	let lastFPSUpdate   = performance.now();
	let linkCount       = 0;

	function onExecuting(event) {
		const nodeId = event.detail;

		if (nodeId != null && execStartTime === null) {
			execStartTime = performance.now();
		}

		if (nodeId == null && execStartTime !== null) {
			lastExecTime  = ((performance.now() - execStartTime) / 1000).toFixed(2) + "s";
			execStartTime = null;
		}

		runningNode = nodeId != null ? app.graph.getNodeById(nodeId) : null;
	}

	function UpdateFPS(now) {
		frameCount++;
		if (now - lastFPSUpdate > 1000) {
			fps           = frameCount;
			frameCount    = 0;
			lastFPSUpdate = now;
		}
	}

	function UpdateHoveredNode() {
		const n = app.canvas?.node_over;

		if (!n) {
			hoveredNode = null;
			return;
		}

		hoveredNode = {
			id: n.id,
			type: n.type,
			title: n.title
		};
	}

	async function UpdateQueueAndLinks() {
		const now = Date.now();
		if (now - lastQueueUpdate < 1000) return;
		lastQueueUpdate = now;

		try {
			const response = await fetch("/api/jobs?status=in_progress,pending&limit=200");

			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

			const data = await response.json();
			queueLength = data.jobs ? data.jobs.length : (Array.isArray(data) ? data.length : 0);
		} catch (e) {
			console.warn("Queue sync failed. Is ComfyUI running?", e);
			queueLength = 0;
		}

		linkCount = Object.keys(app.graph.links || {}).length;
	}

	function BuildColumns() {
		const cols = [];

		if (state.early00sFunWorkflowName) {
			cols.push(GetWorkflowName());
		}

		const nodes = app.graph?.nodes?.length ?? 0;
		if (state.early00sFunNumNodes && nodes > 0) {
			cols.push(`${nodes} Nodes`);
		}

		if (state.early00sFunLinks && linkCount != 0) {
			cols.push(`${linkCount} Links`);
		}

		if (state.early00sFunRunningNode && runningNode?.title) {
			cols.push(`${runningNode?.title} is running`);
		}

		if (state.early00sFunLastExecTime && lastExecTime !== null && lastExecTime !== undefined) {
			cols.push(`Last Run Took ${lastExecTime}`);
		}

		if (state.early00sFunQueueLength && queueLength != 0) {
			cols.push(`${queueLength} Jobs in Queue`);
		}

		if (state.early00sFunHoveredNode && hoveredNode) {
			cols.push(`${hoveredNode.type} (ID ${hoveredNode.id})`);
		}

		if (state.early00sFunFPS) {
			cols.push(`${fps} FPS`);
		}

		if (state.early00sNotFun) {
			cols.push(`You can disable this silly thing in the settings`);
		}

		return cols;
	}

	function RebuildChains() {
		const columns = BuildColumns();

		const changed = columns.length !== previousColumns.length || columns.some((c, i) => c !== previousColumns[i]);

		if (!changed) return;

		previousColumns = columns;

		trail.innerHTML = "";
		chains = [];

		for (const col of columns) {
			const chars = [];

			for (let i = 0; i < col.length; i++) {
				const span = document.createElement("span");
				span.textContent = col[i];
				trail.appendChild(span);

				chars.push({
					el: span,
					x: mouseX,
					y: mouseY,
					vx: 0,
					vy: 0
				});
			}

			chains.push(chars);
		}
	}

	RebuildChains();

	let lastTime = performance.now();

	function Animate(now) {
		if (!running) return;

		const deltaTime = (now - lastTime) / 1000;

		lastTime  = now;
		UpdateFPS(now);
		UpdateHoveredNode();
		UpdateQueueAndLinks();

		RebuildChains();

		const stiffness     = state.early00sFunStiffness * deltaTime;
		const damping       = Math.pow(state.early00sFunDamping, deltaTime * 60);
		const letterSpacing = state.early00sFunLetterSpacing;
		const rowOffset     = state.early00sFunOffset;
		const gravity       = state.early00sFunGravity * deltaTime;
		const vertical      = state.early00sFunOrientation;
		const rainbow       = state.early00sFunRainbow;

		chains.forEach((chars, colIndex) => {

			const baseX = vertical ? mouseX + colIndex * rowOffset : mouseX;
			const baseY = vertical ? mouseY : mouseY + colIndex * rowOffset;

			let offsetAccumulator = 0;

			chars.forEach((c, i) => {

				const isSpace      = c.el.textContent === " ";
				const localSpacing = isSpace ? letterSpacing * 0.6 : letterSpacing;

				let targetX, targetY;

				if (vertical) {
					targetX = baseX;
					targetY = baseY + offsetAccumulator;
				} else {
					targetX = baseX + offsetAccumulator;
					targetY = baseY;
				}

				offsetAccumulator += localSpacing;

				const dx = targetX - c.x;
				const dy = targetY - c.y;

				const falloff = 1 - (i / chars.length) * 0.7;

				c.vx += dx * stiffness * falloff;
				c.vy += dy * stiffness * falloff + gravity;

				c.vx *= damping;
				c.vy *= damping;

				c.x += c.vx;
				c.y += c.vy;

				c.el.style.transform = `translate(${c.x}px, ${c.y}px)`;

				if (rainbow) {
					const hue = (performance.now() / 5 + i * 15) % 360;
					c.el.style.color = `hsl(${hue}, 100%, 50%)`;
				} else {
					c.el.style.color = "rgba(155, 155, 155, 1)";
				}
			});
		});

		requestAnimationFrame(Animate);
	}

	requestAnimationFrame(Animate);

	return {
		UpdateState(newState) {
			state = newState;

			fontSize = state.early00sFunFontSize;
			UpdateStyle();
		},

		Stop() {
			running = false;

			document.removeEventListener("mousemove", onMouseMove);
			app.api.removeEventListener("executing", onExecuting);

			trail.remove();
			style.remove();
		}
	};
}
