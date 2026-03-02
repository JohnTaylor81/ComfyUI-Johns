(async () => {
	try {
		const { app } = await import("/scripts/app.js");
		const {
			getAll,
			set,
			subscribe
		} = await import("./JohnsSettingsState.js");

		const COLORS = {
			redAxis: (o) => `rgba(255, 0, 0, ${o})`,
			greenAxis: (o) => `rgba(0, 255, 0, ${o})`,
			squareEnabled : "rgba(0, 140, 255, 0.95)",
			squareDisabled: "rgba(0, 140, 255, 0.35)"
		};

		const CONFIG = {
			canvasWaitMs: 25,
			canvasWaitIter: 400,
			originOffset: 1
		};

		const waitForCanvas = async () => {
			const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
			for (let i = 0; i < CONFIG.canvasWaitIter && !app.canvas; i++) {
				await sleep(CONFIG.canvasWaitMs);
			}
			return app.canvas ?? null;
		};

		const getTargetCanvas = () => {
			const c = app.canvas;
			return (
				c.canvas ||
				c.ctx?.canvas ||
				Array.from(document.querySelectorAll("canvas")).sort(
					(a, b) => b.width * b.height - a.width * a.height
				)[0]
			);
		};

		const createOverlayCanvas = (targetCanvas) => {
			const overlay = document.createElement("canvas");
			Object.assign(overlay.style, {
				position     : "fixed",
				pointerEvents: "none",
				zIndex       : "0"
			});
			document.body.appendChild(overlay);
			return overlay;
		};

		const getPanZoom = () => {
			const c = app.canvas;
			return {
				scale : c.ds?.scale ?? c.scale ?? 1,
				offset: c.ds?.offset ?? c.offset ?? [0, 0]
			};
		};

		app.registerExtension({
			name: "JohnsOriginAxes",
			async setup() {
				const canvasWrapper = await waitForCanvas();
				if (!canvasWrapper) return;

				const targetCanvas = getTargetCanvas();
				if (!targetCanvas) return;

				if (targetCanvas.OriginAxesOverlayInstalled) return;
				targetCanvas.OriginAxesOverlayInstalled = true;

				let state = getAll();

				subscribe((newState) => {
					state = newState;
				});

				const overlay = createOverlayCanvas(targetCanvas);
				const octx    = overlay.getContext("2d");
				const dpr     = window.devicePixelRatio || 1;

				let lastOriginBox = null;

				const syncOverlayToTarget = () => {
					const rect = targetCanvas.getBoundingClientRect();

					Object.assign(overlay.style, {
						left  : `${rect.left}px`,
						top   : `${rect.top}px`,
						width : `${rect.width}px`,
						height: `${rect.height}px`
					});

					const w = Math.max(1, Math.floor(rect.width * dpr));
					const h = Math.max(1, Math.floor(rect.height * dpr));

					if (overlay.width !== w || overlay.height !== h) {
						overlay.width = w;
						overlay.height = h;
					}

					return rect;
				};

				const updateOriginBoxBounds = (rect, scale, offset) => {
					const half       = (state.originAxesSquare * scale) / 2;
					const oxViewport = rect.left + offset[0] * scale;
					const oyViewport = rect.top + offset[1] * scale;

					lastOriginBox = {
						left: oxViewport - half,
						top: oyViewport - half,
						right: oxViewport + half,
						bottom: oyViewport + half
					};
				};

				const pointInBox = (x, y, box) => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;

				const onClickCapture = (e) => {
					if (lastOriginBox && pointInBox(e.clientX, e.clientY, lastOriginBox)) {
						set({ originAxesEnabled: !state.originAxesEnabled });
						e.preventDefault();
						e.stopPropagation();
					}
				};

				document.addEventListener("click", onClickCapture, true);

				const draw = () => {
					const rect = syncOverlayToTarget();
					const { scale, offset } = getPanZoom();

					updateOriginBoxBounds(rect, scale, offset);

					octx.save();
					octx.setTransform(1, 0, 0, 1, 0, 0);
					octx.clearRect(0, 0, overlay.width, overlay.height);

					const ox = (offset[0] + CONFIG.originOffset) * scale * dpr;
					const oy = (offset[1] + CONFIG.originOffset) * scale * dpr;

					if (state.originAxesEnabled) {
						octx.lineWidth = state.originAxesWidth * scale * dpr;

						octx.strokeStyle = COLORS.redAxis(state.originAxesOpacity);
						octx.beginPath();
						octx.moveTo(ox, 0);
						octx.lineTo(ox, overlay.height);
						octx.stroke();

						octx.strokeStyle = COLORS.greenAxis(state.originAxesOpacity);
						octx.beginPath();
						octx.moveTo(0, oy);
						octx.lineTo(overlay.width, oy);
						octx.stroke();
					}

					const size = state.originAxesSquare * scale * dpr;
					const halfSize = size / 2;

					octx.fillStyle = state.originAxesEnabled
						? COLORS.squareEnabled
						: COLORS.squareDisabled;

					octx.fillRect(ox - halfSize, oy - halfSize, size, size);

					octx.restore();
					requestAnimationFrame(draw);
				};

				requestAnimationFrame(draw);

				window.addEventListener("resize", syncOverlayToTarget);
				window.addEventListener("scroll", syncOverlayToTarget, true);

				window.addEventListener("beforeunload", () => {
					document.removeEventListener("click", onClickCapture, true);
				});
			}
		});
	} catch (e) {
		console.error("JohnsOriginAxes extension crashed:", e);
	}
})();
