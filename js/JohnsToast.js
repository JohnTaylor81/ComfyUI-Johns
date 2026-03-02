let lastMouseClientPos = null;

if (!window.ToastMouseTracker) {
	window.ToastMouseTracker = true;

	window.addEventListener(
		"pointermove",
		(e) => {
			lastMouseClientPos = { x: e.clientX, y: e.clientY };
		},
		{ passive: true, capture: true }
	);
}

export function GetMouseScreenPosition(appRef = null) {
	if (lastMouseClientPos) return lastMouseClientPos;

	const canvas       = appRef?.canvas;
	const targetCanvas = canvas?.canvas || canvas?.ctx?.canvas;

	if (!canvas || !targetCanvas) {
		return {
			x: window.innerWidth  * 0.5,
			y: window.innerHeight * 0.5
		};
	}

	const rect               = targetCanvas.getBoundingClientRect();
	const scale              = canvas.ds?.scale ?? canvas.scale ?? 1;
	const [offsetX, offsetY] = canvas.ds?.offset ?? canvas.offset ?? [0, 0];
	const [mx, my]           = canvas.graph_mouse ?? canvas.mouse ?? [0, 0];

	return {
		x: rect.left + (mx + offsetX) * scale,
		y: rect.top  + (my + offsetY) * scale
	};
}

const TOAST_THEMES = {
	default: {
		background  : "rgba(30, 30, 30, 0.9)",
		color       : "rgba(255, 255, 255, 1)",
		borderWidth : "1.2px",
		borderStyle : "solid",
		borderRadius: "2px",
		borderColor : "rgba(30, 30, 30, 0.95)",
		padding     : "4px 6px",
		fontSize    : "13px",
		boxShadow   : "0 4px 12px rgba(0, 0, 0, 0.4)"
	},
	success: {
		background  : "rgba(70, 150, 50, 0.9)",
		color       : "rgba(255, 255, 255, 1)",
		borderWidth : "1.2px",
		borderStyle : "solid",
		borderRadius: "2px",
		borderColor : "rgba(30, 30, 30, 0.95)",
		padding     : "4px 6px",
		fontSize    : "13px",
		boxShadow   : "0 4px 12px rgba(0, 0, 0, 0.4)"
	},
	error: {
		background  : "rgba(150, 50, 50, 0.9)",
		color       : "rgba(255, 255, 255, 1)",
		borderWidth : "1.2px",
		borderStyle : "solid",
		borderRadius: "2px",
		borderColor : "rgba(30, 30, 30, 0.95)",
		padding     : "4px 6px",
		fontSize    : "13px",
		boxShadow   : "0 4px 12px rgba(0, 0, 0, 0.4)"
	}
};

function resolveTheme(themeName) {
	const key = (themeName ?? "Default").toString().trim().toLowerCase();
	return TOAST_THEMES[key] ?? TOAST_THEMES.default;
}

export function ShowToastAtPosition(message, x, y, theme = "Default", options = {}) {
	const {
		offsetY         = 60,
		durationMs      = 2000,
		viewportPadding = 8
	} = options;
	const themeStyle = resolveTheme(theme);

	const toast = document.createElement("div");
	toast.textContent = message;

	Object.assign(toast.style, {
		position     : "fixed",
		left         : `${x}px`,
		top          : `${y + offsetY}px`,
		background   : themeStyle.background,
		color        : themeStyle.color,
		borderWidth  : themeStyle.borderWidth,
		borderStyle  : themeStyle.borderStyle,
		borderColor  : themeStyle.borderColor,
		borderRadius : themeStyle.borderRadius,
		padding      : themeStyle.padding,
		fontSize     : themeStyle.fontSize,
		boxShadow    : themeStyle.boxShadow,
		pointerEvents: "none",
		zIndex       : 9999,
		opacity      : 0,
		transition   : "opacity 0.2s ease"
	});

	document.body.appendChild(toast);

	const toastWidth   = toast.offsetWidth;
	const centeredLeft = x - toastWidth * 0.5;
	const minLeft      = viewportPadding;
	const maxLeft      = window.innerWidth - toastWidth - viewportPadding;
	const safeMaxLeft  = Math.max(minLeft, maxLeft);
	const safeLeft     = Math.min(Math.max(centeredLeft, minLeft), safeMaxLeft);
	toast.style.left   = `${safeLeft}px`;

	requestAnimationFrame(() => {
		toast.style.opacity = 1;
	});

	setTimeout(() => {
		toast.style.opacity = 0;
		setTimeout(() => {
			toast.remove();
		}, 200);
	}, durationMs);
}

export function ShowToastAtMouse(message, themeOrOptions = "Default", maybeOptions = {}) {
	let theme = "Default";
	let options = maybeOptions || {};

	if (typeof themeOrOptions === "string") {
		theme = themeOrOptions;
	} else if (themeOrOptions && typeof themeOrOptions === "object") {
		options = themeOrOptions;
	}

	const { app = null, ...toastOptions } = options;
	const pos = GetMouseScreenPosition(app);
	ShowToastAtPosition(message, pos.x, pos.y, theme, toastOptions);
}

export const getMouseScreenPosition = GetMouseScreenPosition;
export const showToastAtPosition = ShowToastAtPosition;
export const showToastAtMouse = ShowToastAtMouse;
