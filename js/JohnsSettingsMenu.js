import { SETTINGS_SCHEMA, getAll, set, subscribe } from "./JohnsSettingsState.js";
import { app } from "/scripts/app.js";

app.registerExtension({
	name: "JohnsSettingsMenu",
	async setup() {
		const settings = app.ui?.settings;
		
		if (!settings?.addSetting) return;

		const state      = getAll();
		const uiControls = {};

		for (const name in SETTINGS_SCHEMA) {
			const schema = SETTINGS_SCHEMA[name];
			const ui     = schema.ui;

			const sliderAttrs = ui.type === "slider" ? { min: ui.min, max: ui.max, step: ui.step } : undefined;
			const comboAttrs  = ui.type === "combo"  ? { options: ui.options }                     : undefined;

			let   initialized = false;

			const control = settings.addSetting({
				id          : schema.key,
				category    : schema.category,
				name        : schema.name,
				type        : ui.type,
				defaultValue: state[name],
				options     : ui.options,
				attrs       : sliderAttrs || comboAttrs,
				onChange: (v) => {
					if (!initialized) return;
					set({ [name]: v });
				}
			});

			uiControls[name] = control;

			requestAnimationFrame(() => {
				initialized = true;
			});
		}

		subscribe((newState) => {
			for (const name in uiControls) {
				const control = uiControls[name];
				const value   = newState[name];

				if (control?.setValue) {
					control.setValue(value);
				}
			}
		});
	}
});
