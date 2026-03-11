let componentsPromise = null;

function GetComfyUiComponentsFromApi() {
	const comfyApi         = globalThis.comfyAPI;
	const ComfyButton      = comfyApi?.button?.ComfyButton;
	const ComfyButtonGroup = comfyApi?.buttonGroup?.ComfyButtonGroup;

	if (!ComfyButton || !ComfyButtonGroup) {
		return null;
	}

	return { ComfyButton, ComfyButtonGroup };
}

async function GetComfyUiComponents() {
	const fromApi = GetComfyUiComponentsFromApi();

	if (fromApi) {
		return fromApi;
	}

	if (!componentsPromise) {
		componentsPromise = Promise.all([
			import("/scripts/ui/components/button.js"),
			import("/scripts/ui/components/buttonGroup.js")
		]).then(([buttonModule, groupModule]) => ({
			ComfyButton: buttonModule.ComfyButton,
			ComfyButtonGroup: groupModule.ComfyButtonGroup
		}));
	}

	return componentsPromise;
}

export { GetComfyUiComponents };
