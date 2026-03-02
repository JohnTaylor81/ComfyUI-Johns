from __future__ import annotations
import os
import json
import folder_paths                # type: ignore
from   aiohttp import web          # type: ignore
from   server import PromptServer  # type: ignore


CATEGORY_DELIMITER = "|"
DEFAULT_CATEGORY   = "Default"
FILENAME           = "JohnsPromptLibrary.json"


def StoragePath() -> str: 
	return os.path.join(folder_paths.get_user_directory(), FILENAME)


def NormalizeCategoryPath(path: str) -> str: 
	raw = (path or "").strip()

	if not raw: 
		return DEFAULT_CATEGORY

	parts = [part.strip() for part in raw.split(CATEGORY_DELIMITER)]
	parts = [part for part in parts if part]

	return CATEGORY_DELIMITER.join(parts) if parts else DEFAULT_CATEGORY


def LoadAll() -> dict: 
	path = StoragePath()

	if not os.path.exists(path): 
		return {"categories": {}}

	try: 
		with open(path, "r", encoding="utf-8") as f: 
			data = json.load(f)
	except Exception: 
		return {"categories": {}}

	if not isinstance(data, dict): 
		return {"categories": {}}

	promptData = data.get("categories", {})

	if not isinstance(promptData, dict): 
		promptData = {}

	prompts = {}

	for key, value in promptData.items(): 
		if not isinstance(key, str): 
			continue

		categoryPath = NormalizeCategoryPath(key)

		if not isinstance(value, list): 
			continue

		items = []

		for instance in value: 
			if not isinstance(instance, dict): 
				continue

			title = str(instance.get("title", "")).strip()

			if not title: 
				continue

			positive = instance.get("positive", "")
			negative = instance.get("negative", "")

			if positive is None: 
				positive = ""

			if negative is None: 
				negative = ""

			items.append({
				"title"   : title,
				"positive": str(positive),
				"negative": str(negative)
			})

		items.sort(key=lambda x: x["title"].lower())
		prompts[categoryPath] = items

	return {"categories": prompts}


def SaveAll(data: dict) -> None: 
	path = StoragePath()
	os.makedirs(os.path.dirname(path), exist_ok=True)
	tmp = path + ".tmp"

	with open(tmp, "w", encoding="utf-8") as f: 
		json.dump(data, f, ensure_ascii=False, indent=2)

	os.replace(tmp, path)


def UpsertPrompt(category: str, title: str, positive: str, negative: str) -> None: 
	categoryPath = NormalizeCategoryPath(category)
	title        = (title or "").strip()
	positive     = "" if positive is None else str(positive)
	negative     = "" if negative is None else str(negative)

	if not title: 
		raise ValueError("Title is required.")

	if not positive.strip() and not negative.strip(): 
		raise ValueError("Positive and Negative cannot both be empty.")

	data    = LoadAll()
	prompts = data["categories"]

	if categoryPath not in prompts: 
		prompts[categoryPath] = []

	items   = prompts[categoryPath]
	lowered = title.lower()

	for instance in items: 
		if  str(instance.get("title", "")).lower() == lowered: 
			instance["title"]    = title
			instance["positive"] = positive
			instance["negative"] = negative
			break
	else: 
		items.append({"title": title, "positive": positive, "negative": negative})

	items.sort(key=lambda x: str(x.get("title", "")).lower())
	prompts[categoryPath] = items
	SaveAll({"categories": prompts})


def DeletePrompt(category: str, title: str) -> None: 
	categoryPath = NormalizeCategoryPath(category)
	title        = (title or "").strip()

	if not title: 
		raise ValueError("Title is required.")

	data    = LoadAll()
	prompts = data["categories"]

	if categoryPath not in prompts: 
		return

	lowered               = title.lower()
	prompts[categoryPath] = [instance for instance in prompts[categoryPath] if str(instance.get("title", "")).lower() != lowered]

	if len(prompts[categoryPath]) == 0:
		prompts.pop(categoryPath, None)

	SaveAll({"categories": prompts})


def GetTitles(category: str) -> list: 
	categoryPath = NormalizeCategoryPath(category)
	data         = LoadAll()
	items        = data["categories"].get(categoryPath, [])
	titles       = [str(instance.get("title", "")).strip() for instance in items if isinstance(instance, dict)]
	titles       = [t for t in titles if t]

	return titles


def GetPrompt(category: str, title: str) -> dict | None: 
	categoryPath = NormalizeCategoryPath(category)
	title        = (title or "").strip()

	if not title: 
		return None

	data    = LoadAll()
	items   = data["categories"].get(categoryPath, [])
	lowered = title.lower()

	for instance in items: 
		if not isinstance(instance, dict): 
			continue
		if str(instance.get("title", "")).lower() == lowered:
			return {
				"category": categoryPath,
				"title"   : instance.get("title", ""),
				"positive": instance.get("positive", "") or "",
				"negative": instance.get("negative", "") or ""
			}
	return None


@PromptServer.instance.routes.get("/JohnsProptLibraryCategories")
async def PromptCategories(request): 
	data       = LoadAll()
	categories = list(data["categories"].keys())
	categories.sort(key=lambda x: x.lower())

	return web.json_response({"categories": categories})


@PromptServer.instance.routes.get("/JohnsProptLibraryPrompts")
async def Prompts(request): 
	category = request.query.get("categories", DEFAULT_CATEGORY)
	titles   = GetTitles(category)

	return web.json_response({"titles": titles})


@PromptServer.instance.routes.get("/JohnsProptLibraryPrompt")
async def PromptGet(request): 
	category = request.query.get("categories", DEFAULT_CATEGORY)
	title    = request.query.get("title", "")
	item     = GetPrompt(category, title)

	if not item: 
		return web.json_response({"error": "Not found"}, status = 404)

	return web.json_response(item)


@PromptServer.instance.routes.post("/JohnsProptLibraryPrompt")
async def PromptPost(request): 
	try: 
		body = await request.json()
	except Exception: 
		body = {}

	category = body.get("category", DEFAULT_CATEGORY)
	title    = body.get("title", "")
	positive = body.get("positive", "")
	negative = body.get("negative", "")

	try: 
		UpsertPrompt(category, title, positive, negative)
		return web.json_response({"ok": True})
	except Exception as e: 
		return web.json_response({"ok": False, "error": str(e)}, status = 400)


@PromptServer.instance.routes.delete("/JohnsProptLibraryPrompt")
async def PromptDelete(request): 
	try: 
		body = await request.json()
	except Exception: 
		body = {}

	category = body.get("category", DEFAULT_CATEGORY)
	title    = body.get("title", "")

	try: 
		DeletePrompt(category, title)
		return web.json_response({"ok": True})
	except Exception as e: 
		return web.json_response({"ok": False, "error": str(e)}, status = 400)
