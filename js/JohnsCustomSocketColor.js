import { app } from "/scripts/app.js";

app.registerExtension({
	name: "JohnsCustomSocketColor",

	async afterConfigureGraph() {
		const SOCKET_COLORS = {
			"TileGuider" : "rgba(60,  160, 160, 1)",
			"TileSampler": "rgba(160, 60,  155, 1)",
			"TileSigmas" : "rgba(200, 200, 135, 1)"
		};

		app.canvas.default_connection_color_byType ??= {};

		for (const [type, color] of Object.entries(SOCKET_COLORS)) {
			app.canvas.default_connection_color_byType[type] = color;

			if (window.LGraphCanvas) {
				LGraphCanvas.link_type_colors[type] = color;
			}

			document.documentElement.style.setProperty(`--color-datatype-${type}`, color);
		}

		app.canvas.setDirty(true, true);
	}
});
