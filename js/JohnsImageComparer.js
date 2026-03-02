import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";
import { getAll, subscribe } from "./JohnsSettingsState.js";

const CONFIG = {
	padding: 10,
	bg     : "rgba(17, 17, 17, 0.5)",
	button : {
		height  : 24,
		fontSize: 12,
		bg      : "rgba(0,0,0,0.45)",
		border  : "rgba(255,255,255,0.25)",
		text    : "rgba(255,255,255,0.9)",
		label   : "Download ImageA"
	},
	slider: {
		lineWidth: 1,
		color    : "rgba(219, 69, 69, 0.6)"
	},
	fade: {
		width         : 18,
		opacityDefault: 0.4,
		opacityHover  : 0.95,
		color         : "rgba(69, 69, 69, "
	}
};

let state = getAll();

function viewURL(filename, type = "temp") {
	return `/view?filename=${encodeURIComponent(filename)}&type=${encodeURIComponent(type)}&nocache=${Date.now()}`;
}

async function downloadFromURL(url, suggestedName) {
	const response = await fetch(url);

	if (!response.ok) return;

	const blob       = await response.blob();
	const objUrl     = URL.createObjectURL(blob);
	const a          = document.createElement("a");
	      a.href     = objUrl;
	      a.download = suggestedName || "ImageA.png";
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
}

function clamp(v, lo, hi) {
	return Math.min(hi, Math.max(lo, v));
}

function withCtx(ctx, fn) {
	ctx.save();

	try {
		fn();
	} finally {
		ctx.restore();
	}
}

function runAsync(fn) {
	fn().catch(console.error);
}

function getMousePosition(event, node) {
	const position = app.canvas.convertEventToCanvasOffset(event);

	return [position[0] - node.pos[0], position[1] - node.pos[1]];
}

function imagesReady(node) {
	return node.imageA && node.imageB && node.imageA.width && node.imageB.width;
}

function hit(rect, x, y) {
	return (
		x >= rect.x &&
		x <= rect.x + rect.w &&
		y >= rect.y &&
		y <= rect.y + rect.h
	);
}

function getFadeControlRect(area, nodeHeight) {
	const width  = CONFIG.fade.width;
	const height = Math.max(1, nodeHeight * 0.5);
	const x      = area.pad;
	const y      = area.pad + (nodeHeight - height) * 0.5;
	return { x, y, w: width, h: height };
}

function getImageArea(node) {
	const pad  = CONFIG.padding;
	const btnH = CONFIG.button.height;
	const w    = node.size[0];
	const h    = node.size[1];

	return {
		x     : pad,
		y     : pad,
		width : Math.max(1, w - pad * 2),
		height: Math.max(1, h - (pad * 3 + btnH)),
		pad,
		btnH
	};
}

function getAspectRect(image, nodeCanvas) {
	const imageAR      = image.width / image.height;
	const nodeCanvasAR = nodeCanvas.width / nodeCanvas.height;

	let width, height;

	if (imageAR > nodeCanvasAR) {
		width  = nodeCanvas.width;
		height = nodeCanvas.width / imageAR;
	} else {
		height = nodeCanvas.height;
		width  = nodeCanvas.height * imageAR;
	}

	const x = nodeCanvas.x + (nodeCanvas.width - width) / 2;
	const y = nodeCanvas.y + (nodeCanvas.height - height) / 2;

	return { x, y, width, height };
}

function getSliderPixel(draw, sliderPos, axis) {
	return axis === "y" ? draw.y + sliderPos * draw.height : draw.x + sliderPos * draw.width;
}

function determineAxisOnEntry(prevLocal, draw) {
	if (!prevLocal) return "x";

	const px              = prevLocal.x;
	const py              = prevLocal.y;
	const left            = draw.x;
	const right           = draw.x + draw.width;
	const top             = draw.y;
	const bottom          = draw.y + draw.height;
	const fromLeftOrRight = px < left || px > right;
	const fromTopOrBottom = py < top || py > bottom;

	if (fromLeftOrRight && !fromTopOrBottom) return "x";

	if (fromTopOrBottom && !fromLeftOrRight) return "y";

	if (fromLeftOrRight && fromTopOrBottom) {
		const  dx   = Math.min(Math.abs(px - left), Math.abs(px - right));
		const  dy   = Math.min(Math.abs(py - top), Math.abs(py - bottom));
		return dx <= dy ? "x" : "y";
	}

	return "x";
}

function isInsideImage(mouseX, mouseY, draw) {
	return (
		mouseX >= draw.x &&
		mouseX <= draw.x + draw.width &&
		mouseY >= draw.y &&
		mouseY <= draw.y + draw.height
	);
}

function updateSliderFromEvent(node, event, draw) {
	const [mouseX, mouseY] = getMousePosition(event, node);

	if (node.compareAxis === "y") {
		const v                   = (mouseY - draw.y) / draw.height;
		      node.SliderPosition = clamp(v, 0, 1);
	} else {
		const v                   = (mouseX - draw.x) / draw.width;
		      node.SliderPosition = clamp(v, 0, 1);
	}

	node.redraw();
}

async function fetchCacheById(id) {
	const res  = await api.fetchApi(`/JohnsImageComparerCache?NodeID=${encodeURIComponent(id)}`);
	const data = await res.json();

	if (!data?.ok || !data?.Payload) return null;

	return data.Payload;
}

async function fetchMostRecentCache() {
	const res  = await api.fetchApi(`/JohnsImageComparerCacheKeys`);
	const data = await res.json();

	if (!data?.ok || !Array.isArray(data.keys) || data.keys.length === 0) return null;

	const mostRecent = data.keys[0];

	if (!mostRecent?.NodeID) return null;

	return await fetchCacheById(mostRecent.NodeID);
}

function getComparerNodes() {
	return (app.graph?._nodes || []).filter(
		(n) => n?.comfyClass === "JohnsImageComparer"
	);
}

function setImagesOnNode(node, payload) {
	const { ImageA_Filename, ImageB_Filename, ImageType } = payload || {};

	node.imageA_filename = ImageA_Filename || null;
	node.imageB_filename = ImageB_Filename || null;
	node.image_type      = ImageType || "temp";

	let pending = 0;

	if (ImageA_Filename) pending++;

	if (ImageB_Filename) pending++;

	const done = () => {
		pending--;
		if (pending <= 0) node.redraw();
	};

	if (ImageA_Filename) {
		node.imageA        = new Image();
		node.imageA.onload = () => {
			try {
				if (node.autoResizeToImageA && state.imageComparerAutoResize) {
					const iw      = Math.max(1, node.imageA.width || 1);
					const ih      = Math.max(1, node.imageA.height || 1);
					const scale   = Math.min(1, state.imageComparerMaxLongEdge / Math.max(iw, ih));
					const rw      = Math.max(1, Math.round(iw * scale));
					const rh      = Math.max(1, Math.round(ih * scale));
					const pad     = CONFIG.padding;
					const btnH    = CONFIG.button.height;
					const targetW = rw + pad * 2;
					const targetH = pad + rh + pad + btnH + pad;
					node.setSize([targetW, targetH]);
				}
			} finally {
				done();
			}
		};
		node.imageA.src = viewURL(ImageA_Filename, node.image_type);
	} else {
		node.imageA = null;
	}

	if (ImageB_Filename) {
		node.imageB        = new Image();
		node.imageB.onload = done;
		node.imageB.src    = viewURL(ImageB_Filename, node.image_type);
	} else {
		node.imageB = null;
	}

	node.redraw();
}

function drawBackground(ctx, w, h) {
	ctx.fillStyle = CONFIG.bg;
	ctx.fillRect(0, 0, w, h);
}

function drawImageB(ctx, node, draw) {
	withCtx(ctx, () => {
		ctx.globalAlpha = 1 - node.fadeOpacity;
		ctx.drawImage(node.imageB, draw.x, draw.y, draw.width, draw.height);
	});
}

function drawImageAWithSlider(ctx, node, draw) {
	withCtx(ctx, () => {
		ctx.globalAlpha = 1 - node.fadeOpacity;
		ctx.beginPath();
		const sliderPx = getSliderPixel(draw, node.SliderPosition, node.compareAxis);

		if (node.compareAxis === "y") {
			ctx.rect(draw.x, draw.y, draw.width, sliderPx - draw.y);
		} else {
			ctx.rect(draw.x, draw.y, sliderPx - draw.x, draw.height);
		}

		ctx.clip();
		ctx.drawImage(node.imageA, draw.x, draw.y, draw.width, draw.height);
	});

	withCtx(ctx, () => {
		ctx.strokeStyle = CONFIG.slider.color;
		ctx.lineWidth   = CONFIG.slider.lineWidth;
		ctx.beginPath();
		const sliderPx = getSliderPixel(draw, node.SliderPosition, node.compareAxis);

		if (node.compareAxis === "y") {
			ctx.moveTo(draw.x, sliderPx);
			ctx.lineTo(draw.x + draw.width, sliderPx);
		} else {
			ctx.moveTo(sliderPx, draw.y);
			ctx.lineTo(sliderPx, draw.y + draw.height);
		}

		ctx.stroke();
	});
}

function drawImageAFade(ctx, node, draw) {
	withCtx(ctx, () => {
		ctx.globalAlpha = node.fadeOpacity;
		ctx.drawImage(node.imageA, draw.x, draw.y, draw.width, draw.height);
	});
}

function drawFadeControl(ctx, node) {
	if (!node.fadeRect) return;

	const fadeRect        = node.fadeRect;
	const baseOpacity     = node.fadeOpacity_hover ? CONFIG.fade.opacityHover : CONFIG.fade.opacityDefault;
	const fillOpacity     = baseOpacity * 0.5;
	const borderOpacity   = baseOpacity;
	const indicatorHeight = fadeRect.h * node.fadeOpacity;
	const indicatorY      = fadeRect.y - indicatorHeight + fadeRect.h;

	withCtx(ctx, () => {
		ctx.fillStyle = CONFIG.fade.color + fillOpacity + ")";
		ctx.fillRect(
			fadeRect.x + CONFIG.padding / 2,
			fadeRect.y,
			fadeRect.w,
			fadeRect.h
		);

		ctx.fillStyle = CONFIG.fade.color + baseOpacity + ")";
		ctx.fillRect(
			fadeRect.x + CONFIG.padding / 2,
			indicatorY,
			fadeRect.w,
			indicatorHeight
		);

		ctx.strokeStyle = CONFIG.fade.color + borderOpacity + ")";
		ctx.lineWidth   = 2;
		ctx.strokeRect(
			fadeRect.x + 0.5 + CONFIG.padding / 2,
			fadeRect.y + 0.5,
			fadeRect.w - 1,
			fadeRect.h - 1
		);
	});
}

function drawResolutionLabel(ctx, node, draw) {
	const labelText   = `${node.imageA.width} x ${node.imageA.height}`;
	      ctx.font    = `${CONFIG.button.fontSize}px Arial`;
	const textMetrics = ctx.measureText(labelText);
	const textWidth   = textMetrics.width;
	const textHeight  = CONFIG.button.fontSize;
	const padding     = 4;
	const labelX      = draw.x + CONFIG.padding;
	const labelY      = draw.y + draw.height - CONFIG.padding;
	const rectX       = labelX - padding;
	const rectY       = labelY - textHeight - padding - 1;
	const rectW       = textWidth + padding * 2;
	const rectH       = textHeight + padding * 2;

	withCtx(ctx, () => {
		ctx.fillStyle = CONFIG.button.bg;
		ctx.fillRect(rectX, rectY, rectW, rectH);
		ctx.strokeStyle = CONFIG.button.border;
		ctx.lineWidth   = 1;
		ctx.strokeRect(rectX + 0.5, rectY + 0.5, rectW - 1, rectH - 1);

		ctx.fillStyle    = CONFIG.button.text;
		ctx.textAlign    = "left";
		ctx.textBaseline = "bottom";
		ctx.fillText(labelText, labelX, labelY);
	});
}

function drawDownloadButton(ctx, btnX, btnY, btnW, btnH) {
	withCtx(ctx, () => {
		ctx.fillStyle = CONFIG.button.bg;
		ctx.fillRect(btnX, btnY, btnW, btnH);
		ctx.strokeStyle = CONFIG.button.border;
		ctx.strokeRect(btnX + 0.5, btnY + 0.5, btnW - 1, btnH - 1);
		ctx.fillStyle    = CONFIG.button.text;
		ctx.font         = `${CONFIG.button.fontSize}px Arial`;
		ctx.textAlign    = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(
			CONFIG.button.label,
			btnX + btnW / 2,
			btnY + btnH / 2
		);
	});
}

app.registerExtension({
	name: "JohnsImageComparer",

	async setup() {
		state = getAll();

		subscribe((newState) => {
			state = newState;
			for (const n of getComparerNodes()) n.redraw();
		});
	},

	nodeCreated(node) {
		if (node.comfyClass !== "JohnsImageComparer") return;

		node.imageA         = null;
		node.imageB         = null;
		node.SliderPosition = 0.5;
		node.compareAxis    = "x";
		node.uiState        = {
			prevInside    : false,
			prevMouseLocal: null,
			draggingFade  : false,
			sliderEnabled : true
		};
		node.DownloadButtonRect = null;
		node.fadeOpacity        = 0;
		node.fadeOpacity_hover  = false;
		node.fadeRect           = null;
		node.autoResizeToImageA = true;

		node.redraw = () => node.setDirtyCanvas(true, true);

		node.onDrawForeground = function (ctx) {
			if (this.flags.collapsed) return;

			const w = this.size[0];
			const h = this.size[1];

			if (w < 1 || h < 1) return;

			const area = getImageArea(this);
			const btnX = area.pad;
			const btnY = area.y + area.height + area.pad;
			const btnW = Math.max(1, w - area.pad * 2);
			const btnH = area.btnH;

			this.DownloadButtonRect = { x: btnX, y: btnY, w: btnW, h: btnH };
			this.fadeRect           = getFadeControlRect(area, area.height);

			withCtx(ctx, () => {
				drawBackground(ctx, w, h);

				if (imagesReady(this)) {
					const draw = getAspectRect(this.imageA, area);

					drawImageB(ctx, this, draw);

					if (this.uiState.sliderEnabled) {
						drawImageAWithSlider(ctx, this, draw);
					} else {
						drawImageAFade(ctx, this, draw);
					}

					drawResolutionLabel(ctx, this, draw);
				}

				drawFadeControl(ctx, this);
				drawDownloadButton(ctx, btnX, btnY, btnW, btnH);
			});
		};

		node.onMouseDown = function (event) {
			const [mouseX, mouseY] = getMousePosition(event, this);
			const r                = this.DownloadButtonRect;

			if (r && hit(r, mouseX - CONFIG.padding / 2, mouseY)) {
				runAsync(async () => {
					if (!this.imageA_filename) return;
					const url = viewURL(this.imageA_filename, this.image_type);
					await downloadFromURL(url, this.imageA_filename);
				});

				event.preventDefault?.();
				event.stopPropagation?.();
				return true;
			}

			if (this.fadeRect && hit(this.fadeRect, mouseX - CONFIG.padding / 2, mouseY)) {
				this.uiState.draggingFade  = true;
				this.uiState.sliderEnabled = false;
				this.redraw();

				event.preventDefault?.();
				event.stopPropagation?.();
				return true;
			}
		};

		node.onMouseMove = function (event) {
			if (!imagesReady(this)) return;

			const area = getImageArea(this);

			if (area.width < 1 || area.height < 1) return;

			const draw             = getAspectRect(this.imageA, area);
			const [mouseX, mouseY] = getMousePosition(event, this);
			const wasHovering      = this.fadeOpacity_hover;

			this.fadeOpacity_hover = this.fadeRect
				? hit(this.fadeRect, mouseX - CONFIG.padding / 2, mouseY)
				:  false;

			if (this.uiState.draggingFade && this.fadeRect) {
				const fadeRect  = this.fadeRect;
				const relativeY = mouseY - fadeRect.y;
				const fadeValue = clamp(1 - relativeY / fadeRect.h, 0, 1);

				this.fadeOpacity = fadeValue;
				this.redraw();
			} else if (this.uiState.sliderEnabled) {
				const inside = isInsideImage(mouseX, mouseY, draw);

				if (inside && !this.uiState.prevInside) {
					this.compareAxis = determineAxisOnEntry(this.uiState.prevMouseLocal, draw);
				}

				if (inside) {
					updateSliderFromEvent(this, event, draw);
				}

				this.uiState.prevInside = inside;
			} else if (wasHovering !== this.fadeOpacity_hover) {
				this.redraw();
			}

			this.uiState.prevMouseLocal = { x: mouseX, y: mouseY };
		};

		node.onMouseLeave = function () {
			this.fadeOpacity_hover     = false;
			this.uiState.draggingFade  = false;
			this.uiState.sliderEnabled = true;
			this.fadeOpacity           = 0;
			this.SliderPosition        = 1.0;
			this.redraw();
		};

		const handleMouseUp = () => {
			if (node.uiState.draggingFade) {
				node.uiState.draggingFade  = false;
				node.uiState.sliderEnabled = true;
				node.redraw();
			}
		};

		document.addEventListener("mouseup", handleMouseUp);

		const originalOnRemoved = node.onRemoved || (() => { });
		      node.onRemoved    = function () {
			document.removeEventListener("mouseup", handleMouseUp);
			originalOnRemoved.call(this);
		};

		runAsync(async () => {
			const payload = 
				(await fetchCacheById(node.id)) ||
				(node.properties?.BackendID &&
					(await fetchCacheById(node.properties.BackendID))) ||
				(await fetchMostRecentCache());

			if (payload) setImagesOnNode(node, payload);
		});
	}
});

api.addEventListener("/JohnsImageComparerPreview", ({ detail }) => {
	const comparerNodes = getComparerNodes();
	
	if (comparerNodes.length === 0) return;

	const node = 
		comparerNodes.find((n) => String(n.id) === String(detail.NodeID)) ||
		comparerNodes.find((n) => n.properties?.BackendID === detail.NodeID) ||
		comparerNodes.find((n) => !n.properties?.BackendID) ||
		comparerNodes[0];

	node.properties           = node.properties || {};
	node.properties.BackendID = detail.NodeID;

	setImagesOnNode(node, detail);
});
