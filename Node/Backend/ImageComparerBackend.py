from __future__ import annotations
import numpy  # type: ignore
import torch  # type: ignore
import time
import folder_paths  # type: ignore
import os
import re
from PIL import Image            # type: ignore
from aiohttp import web          # type: ignore
from server import PromptServer  # type: ignore


PREVIEW_CACHE: dict[str, dict] = {}


def NormalizeCacheKeys(NodeID) -> set[str]: 
	s    = str(NodeID)
	keys = {s}
	nums = re.findall(r"\d+", s)

	if len(nums) == 1:
		keys.add(nums[0])

	for delim in (":", "_", "-"): 
		if delim in s: 
			for part in s.split(delim): 
				if part.isdigit(): 
					keys.add(part)

	return keys


def TensorToPIL(img: torch.Tensor) -> Image.Image: 
	arr = numpy.clip(255.0 * img[0].cpu().numpy(), 0, 255).astype(numpy.uint8)

	return Image.fromarray(arr)


def SaveTempPNG(img: torch.Tensor, prefix: str) -> str: 
	temp_dir = folder_paths.get_temp_directory()
	os.makedirs(temp_dir, exist_ok = True)

	ts       = int(time.time() * 1000)
	filename = f"{prefix}_{ts}.png"
	path     = os.path.join(temp_dir, filename)
	pil      = TensorToPIL(img)
	
	pil.save(path, format = "PNG")

	return filename


def CacheAndEmitPreview(NodeID: str, ImageA: torch.Tensor, ImageB: torch.Tensor) -> None: 
	prefixA         = f"ImageA_NodeID_{NodeID}"
	prefixB         = f"ImageB_NodeID_{NodeID}"
	ImageA_Filename = SaveTempPNG(ImageA, prefixA)
	ImageB_Filename = SaveTempPNG(ImageB, prefixB)

	preview_payload = {
		"NodeID"         : NodeID,
		"ImageA_Filename": ImageA_Filename,
		"ImageB_Filename": ImageB_Filename,
		"ImageType"      : "temp"
	}

	cache_payload = dict(preview_payload)
	cache_payload.pop("NodeID", None)
	cache_payload["TimeStamp"] = time.time()

	for k in NormalizeCacheKeys(NodeID): 
		PREVIEW_CACHE[k] = dict(cache_payload)

	PromptServer.instance.send_sync("/JohnsImageComparerPreview", preview_payload)


@PromptServer.instance.routes.get("/JohnsImageComparerCache")
async def JohnsImageComparerCache(request): 
	NodeID = request.query.get("NodeID")

	if not NodeID: 
		return web.json_response({"ok": False, "error": "Missing NodeID"}, status = 400)

	for k in NormalizeCacheKeys(NodeID): 
		if k in PREVIEW_CACHE : 
			payload = dict(PREVIEW_CACHE[k])
			payload.pop("TimeStamp", None)

			return web.json_response({"ok": True, "Payload": payload, "CacheKey": k})

	return web.json_response({"ok": True, "Payload": None})


@PromptServer.instance.routes.get("/JohnsImageComparerCacheKeys")
async def JohnsImageComparerCacheKeys(request): 
	items = [{"NodeID": k, "TimeStamp": v.get("TimeStamp", 0.0)} for k, v in PREVIEW_CACHE.items()]
	items.sort(key = lambda x: x["TimeStamp"], reverse = True)

	return web.json_response({"ok": True, "keys": items})
