import { app } from "/scripts/app.js";
import { ComfyButtonGroup } from "/scripts/ui/components/buttonGroup.js";
import { ComfyButton } from "/scripts/ui/components/button.js";

import {
	getAll,
	set,
	subscribe
} from "./JohnsSettingsState.js";

const BUTTON_GROUP_CLASS = "origin-axes-top-menu-group";
const TOOLTIP = "Toggle Origin Axes";
const MAX_ATTACH_ATTEMPTS = 120;

const OriginAxesStyles = () => {
	if (document.getElementById("origin-axes-topmenu-style")) return;

	const style = document.createElement("style");
	style.id = "origin-axes-topmenu-style";
	style.textContent = `
        .origin-axes-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0.35rem 0.45rem;
            border-radius: 0.5rem;
            transition: transform 120ms ease, filter 120ms ease, background-color 120ms ease;
        }
        .origin-axes-btn:hover {
            background-color: rgba(255,255,255,0.08);
            transform: translateY(-1px);
            filter: brightness(1.15);
        }
        .origin-axes-btn svg {
            width: 1.2rem;
            height: 1.2rem;
            display: block;
        }
    `;
	document.head.appendChild(style);
};

const GetAxesIcon = (enabled) => {
	const opacity = enabled ? "1.0" : "0.45";

	return `
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style="opacity:${opacity}">
        <rect width="100%" height="100%" fill="#ccc" fill-opacity="0.2"/>
        <path d="M100 0v200" stroke="red" stroke-width="12"/>
        <path d="M0 100h200" stroke="green" stroke-width="12"/>
        <rect x="87.5" y="87.5" width="24" height="24" fill="#00f"/>
    </svg>`;
};

const CreateButton = () => {
	OriginAxesStyles();

	let state = getAll();

	const button = new ComfyButton({
		tooltip: TOOLTIP,
		app,
		enabled: true,
		classList: "comfyui-button comfyui-menu-mobile-collapse"
	});

	button.element.classList.add("origin-axes-btn");
	button.element.setAttribute("aria-label", TOOLTIP);
	button.element.title = TOOLTIP;

	const UpdateIcon = () => {
		button.element.innerHTML = GetAxesIcon(state.originAxesEnabled);
	};

	UpdateIcon();

	// React to global settings changes
	subscribe((newState) => {
		state = newState;
		UpdateIcon();
	});

	// Toggle using the unified state system
	button.element.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		set({ originAxesEnabled: !state.originAxesEnabled });
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
	const group = new ComfyButtonGroup(button);

	group.element.classList.add(BUTTON_GROUP_CLASS);
	settingsGroup.element.before(group.element);
};

app.registerExtension({
	name: "OriginAxes.TopMenuIcon",
	async setup() {
		AttachButton();
	}
});