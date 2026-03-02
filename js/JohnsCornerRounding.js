import { getAll, subscribe } from "./JohnsSettingsState.js";
import { app } from "/scripts/app.js";

(function JohnsCornerRounding() {
	let state        = getAll();
	let mode         = state.cornerRoundingMode;
	let patchApplied = false;

	const applyPatch = () => {
		if (patchApplied) return;

		patchApplied = true;

		const ctxProto = globalThis.CanvasRenderingContext2D?.prototype;

		if (ctxProto?.roundRect && !ctxProto.JohnsNodeRect) {
			Object.defineProperty(ctxProto, "JohnsNodeRect", {
				value: ctxProto.roundRect,
				configurable: true,
				enumerable  : false,
				writable    : false,
			});

			ctxProto.roundRect = function (x, y, w, h, r) {
				if (globalThis.EditRoundRect) {
					this.rect(x - 4.5, y, w + 9, h);

					return this;
				}

				return ctxProto.JohnsNodeRect.call(this, x, y, w, h, r);
			};
		}

		const ShouldSquare = (node) => {
			if (mode === "all") return true;

			if (mode === "none") return false;

			return (
				node?.comfyClass?.startsWith("Johns") ||
				node?.type?.startsWith("Johns")
			);
		};

		const WrapIfFn = (obj, key) => {
			const fn = obj?.[key];

			if (typeof fn !== "function" || fn.SquareWrapped) return;

			obj[key] = function () {
				const node = arguments[0];
				const prev = globalThis.EditRoundRect;

				if (ShouldSquare(node)) globalThis.EditRoundRect = true;

				try {
					return fn.apply(this, arguments);
				} finally {
					globalThis.EditRoundRect = prev;
				}
			};

			obj[key].SquareWrapped = true;
		};

		let tries = 0;

		const timer = setInterval(() => {
			const LGC = globalThis.LGraphCanvas;

			if (LGC?.prototype) {
				WrapIfFn(LGC.prototype, "drawNode");
				WrapIfFn(LGC.prototype, "drawNodeWidgets");
				clearInterval(timer);
			}

			if (++tries > 40) clearInterval(timer);
		}, 250);
	};

	applyPatch();

	subscribe((newState) => {
		state = newState;
		mode  = state.cornerRoundingMode;

		const canvas = globalThis.LGraphCanvas?.active_canvas;

		if (canvas) canvas.setDirty(true, true);
	});
})();
