import { app } from "/scripts/app.js";
import { InsertSpacerAfterWidget, AdjustNodeSize } from "./JohnsWidgetHacks.js";

(function InjectTileDiffusionMapStyles() {
	if (document.getElementById("johns-tile-diffusion-map")) return;

	const style             = document.createElement("style");
		  style.id          = "johns-tile-diffusion-map";
		  style.textContent = `
	textarea.comfy-multiline-input[placeholder="Retarget"] {
		background-color: rgba(60, 160, 160, 0.08) !important;
		border          : 1px solid rgba(60, 160, 160, 0.6);
		color           : rgba(60, 160, 160, 0.8);
		text-align      : justify;
	}

	textarea.comfy-multiline-input[placeholder="Retarget"]:focus {
		background-color: rgba(60, 160, 160, 0.3) !important;
		font-weight     : bold;
	}

	textarea.comfy-multiline-input[placeholder="Retarget"]::placeholder {
		color: rgba(60, 160, 160, 1);
	}
	`;

	document.head.appendChild(style);
})();

app.registerExtension({
	name: "JohnsTileDiffusionMap",
	nodeCreated(node) {
		if (node.comfyClass !== "JohnsTileDiffusionMap")
			return;

		if (!node._originalOutputs) {
			node._originalOutputs = node.outputs.map(o => ({
				name: o.name,
				type: o.type
			}));
		}

		function hasOutput(name) {
			return node.outputs.find(o => o.name === name);
		}

		function addOutput(name) {
			if (hasOutput(name)) return;

			const original = node._originalOutputs.find(o => o.name === name);
			
			if (original)
				node.addOutput(original.name, original.type);
		}

		function removeOutput(name) {
			const index = node.outputs.findIndex(o => o.name === name);

			if (index !== -1)
				node.removeOutput(index);
		}

		function reorderOutputs() {
			const desiredOrder = [
				"Guider Map",
				"Sampler Map",
				"Sigma Map",
				"Combined Overlay",
				"Tiles Overlay",
				"Seams Overlay",
				"Intersections Overlay",
				"Cropped Regions"
			];

			desiredOrder.forEach(name => {
				const idx = node.outputs.findIndex(o => o.name === name);

				if (idx > -1) {
					const out = node.outputs.splice(idx, 1)[0];
					node.outputs.push(out);
				}
			});
		}

		
		node.updateOutputs = function () {

			const modeWidget = node.widgets.find(w => w.name === "SeamRefinement");
			const hWidget    = node.widgets.find(w => w.name === "HorizontalTiles");
			const vWidget    = node.widgets.find(w => w.name === "VerticalTiles");
			const cropWidget = node.widgets.find(w => w.name === "CropRegions");

			if (!modeWidget || !hWidget || !vWidget)
				return;

			const mode = modeWidget.value;
			const h    = Number(hWidget.value);
			const v    = Number(vWidget.value);

			const tilesPossible         = (h > 1 || v > 1);
			const seamsPossible         = (h > 1 || v > 1);
			const intersectionsPossible = (h > 1 && v > 1);
			const tilesActive           = tilesPossible;
			const seamsActive           = seamsPossible && (mode === "Seams" || mode === "Seams with Intersections");
			const intersectionsActive   = intersectionsPossible && (mode === "Intersections" || mode === "Seams with Intersections");
			const combinedActive        = tilesActive && (seamsActive || intersectionsActive);
			const cropRegionsActive     = Boolean(cropWidget) && cropWidget.value !== "Disable" && tilesPossible;

			if (tilesActive)
				addOutput("Tiles Overlay");
			else
				removeOutput("Tiles Overlay");

			if (seamsActive)
				addOutput("Seams Overlay");
			else
				removeOutput("Seams Overlay");

			if (intersectionsActive)
				addOutput("Intersections Overlay");
			else
				removeOutput("Intersections Overlay");

			if (combinedActive)
				addOutput("Combined Overlay");
			else
				removeOutput("Combined Overlay");

			if (cropRegionsActive)
				addOutput("Cropped Regions");
			else
				removeOutput("Cropped Regions");

			reorderOutputs();

			node.computeSize();
			app.graph.setDirtyCanvas(true, true);
		};

		const orig = node.onWidgetChanged;
		node.onWidgetChanged = function (...args) {
			if (orig) orig.apply(this, args);
			this.updateOutputs();
		};

		InsertSpacerAfterWidget(node, "TraversalMode");
		InsertSpacerAfterWidget(node, "VerticalTiles");
		InsertSpacerAfterWidget(node, "SeamRefinement");
		AdjustNodeSize(node, { min_width: 400, min_height: 600 });

		node.updateOutputs();
		setTimeout(node.updateOutputs, 50);
	}
	
});
