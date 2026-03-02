import { app } from "/scripts/app.js";
import { getAll, subscribe } from "./JohnsSettingsState.js";

(function JohnsCustomBorders() {

	let state = getAll();
	let mode  = state.customBorders;

	let currentRunningNode = null;

	let   rafId         = null;
	let   lastFrameTime = 0;
	const MIN_FRAME_MS  = 1000 / 30;

	function StartAnimationLoop() {
		if (rafId != null) return;

		lastFrameTime = performance.now();

		const loop = (now) => {
			rafId = requestAnimationFrame(loop);

			if (now - lastFrameTime < MIN_FRAME_MS) return;
			lastFrameTime = now;

			const canvas = globalThis.LGraphCanvas?.active_canvas;

			if (canvas) {
				try { canvas.setDirty(true, true); } catch (e) { /* ignore */ }
			}

			if (!currentRunningNode) {
				StopAnimationLoop();
			}
		};

		rafId = requestAnimationFrame(loop);
	}

	function StopAnimationLoop() {
		if (rafId == null) return;

		cancelAnimationFrame(rafId);
		rafId = null;
	}

	app.api.addEventListener("executing", (event) => {
		const nodeId       = event.detail;
		currentRunningNode = nodeId != null ? app.graph.getNodeById(nodeId) : null;

		if (currentRunningNode) {
			StartAnimationLoop();
		} else {
			const canvas = globalThis.LGraphCanvas?.active_canvas;

			if (canvas) canvas.setDirty(true, true);
			StopAnimationLoop();
		}
	});

	const ShouldApply = (node) => {
		if (mode === "off") return false;

		if (mode === "all") return true;

		return (
			node?.comfyClass?.startsWith("Johns") || node?.type?.startsWith("Johns")
		);
	};

	function IsNodeSelectedOnCanvas(node) {
		const LGC    = globalThis.LGraphCanvas;
		const canvas = LGC?.active_canvas;

		if (!canvas) return !!node.selected;

		const sel = canvas.selected_nodes;

		if (Array.isArray(sel)) {
			for (let s of sel) {
				if (s === node || s === node.id) return true;
			}
		}

		if (sel && typeof sel === "object") {
			if (node.id in sel) return true;
		}

		return !!node.selected;
	}

	function DrawBorders(node, ctx, selected, isRunning) {
		if (selected) {
			ctx.save();
			ctx.strokeStyle   = "rgba(60, 160, 255, 1)";
			ctx.lineWidth     = 3;
			ctx.shadowColor   = "rgba(60, 160, 255, 1)";
			ctx.shadowOffsetX = 0;
			ctx.shadowOffsetY = 0;
			ctx.shadowBlur    = 10;

			ctx.strokeRect(
				-4,
				-34,
				node.size[0] + 8,
				node.size[1] + 38
			);

			ctx.restore();
		}

		if (isRunning) {
			const now   = performance.now();
			const pulse = (Math.sin(now / 200) + 1) / 2;
			const width = 3 + pulse * 3;

			ctx.save();
			ctx.strokeStyle   = "rgba(255, 180, 50, 1)";
			ctx.lineWidth     = width;
			ctx.shadowColor   = "rgba(255, 180, 50, 1)";
			ctx.shadowOffsetX = 0;
			ctx.shadowOffsetY = 0;
			ctx.shadowBlur    = 10 + pulse * 6;

			ctx.strokeRect(
				-6,
				-36,
				node.size[0] + 12,
				node.size[1] + 42
			);

			ctx.restore();
		}
	}

	const DisableNativeBorders = () => {
		const LGC = globalThis.LGraphCanvas;

		if (!LGC?.prototype) return false;

		if (LGC.prototype.JohnsBorderPatched) return true;

		const origDrawNode = LGC.prototype.drawNode;

		if (typeof origDrawNode !== "function") {
			LGC.prototype.JohnsBorderPatched = true;
			return true;
		}

		LGC.prototype.drawNode = function (node, ctx) {
			if (!ShouldApply(node)) {
				return origDrawNode.call(this, node, ctx);
			}

			const prevSelected = node.selected;
			node.selected      = false;

			try {
				origDrawNode.call(this, node, ctx);
			} finally {
				node.selected = prevSelected;
			}

			const selectedNow = IsNodeSelectedOnCanvas(node);
			const isRunning   = currentRunningNode && currentRunningNode.id === node.id;

			DrawBorders(node, ctx, selectedNow, isRunning);
		};

		LGC.prototype.JohnsBorderPatched = true;

		return true;
	};

	const PatchNodeForeground = () => {
		const proto = LiteGraph.LGraphNode.prototype;

		if (proto.JohnsDrawPatched) return true;

		proto.JohnsDrawPatched = true;

		const orig = proto.onDrawForeground;

		proto.onDrawForeground = function (ctx) {
			if (orig) orig.call(this, ctx);
		};

		return true;
	};

	let tries = 0;

	const timer = setInterval(() => {
		const ok1 = DisableNativeBorders();
		const ok2 = PatchNodeForeground();

		if (ok1 && ok2) {
			clearInterval(timer);
		}

		if (++tries > 40) clearInterval(timer);
	}, 250);

	subscribe((newState) => {
		state = newState;
		mode  = state.customBorders;

		const canvas = globalThis.LGraphCanvas?.active_canvas;

		if (canvas) canvas.setDirty(true, true);
	});

})();
