from __future__ import annotations
import folder_paths                # type: ignore
from   aiohttp import web          # type: ignore
from   server import PromptServer  # type: ignore


@PromptServer.instance.routes.get("/JohnsLoRALoaderList")
async def JohnsLoRALoaderList(request):
	try:
		names = folder_paths.get_filename_list("loras")
	except Exception:
		names = []
	return web.json_response({"loras": list(names)})
