from __future__ import annotations
import re
import torch # type: ignore
import numpy as np # type: ignore
from PIL import Image, ImageDraw, ImageFont # type: ignore


def TensorToPillow(tensor):
	array = (tensor.cpu().numpy() * 255.0).clip(0, 255).astype(np.uint8)
	return Image.fromarray(array)


def PillowToTensor(pil_image, device):
	array = np.array(pil_image).astype(np.float32) / 255.0
	return torch.from_numpy(array).to(device)


def GetTraversalOrder(cols: int, rows: int, mode: str):
	mode  = (mode or "").strip()
	order = []

	if mode == "Horizontal Serpentine":
		for r in range(rows):
			if r % 2 == 0:
				for c in range(cols):
					order.append((r, c))
			else:
				for c in range(cols - 1, -1, -1):
					order.append((r, c))

	elif mode == "Vertical Serpentine":
		for c in range(cols):
			if c % 2 == 0:
				for r in range(rows):
					order.append((r, c))
			else:
				for r in range(rows - 1, -1, -1):
					order.append((r, c))

	elif mode == "Row-Major":
		for r in range(rows):
			for c in range(cols):
				order.append((r, c))

	elif mode == "Column-Major":
		for c in range(cols):
			for r in range(rows):
				order.append((r, c))

	else:
		for r in range(rows):
			for c in range(cols):
				order.append((r, c))

	return order


def RenderOverlay(image, cols, rows, seam_refinement, traversal_mode = "Row-Major"):
	if image is None or not isinstance(image, torch.Tensor) or image.ndim != 4:
		return (None, None, None, None)

	out        = image.clone()
	B, H, W, C = out.shape

	if B == 0:
		return (None, None, None, None)

	base_tensor = out[0]
	device      = base_tensor.device
	base_img    = TensorToPillow(base_tensor).convert("RGBA")

	tile_w = W / cols
	tile_h = H / rows

	ALPHA = 64  # 0.25 opacity

	COLOR_TILE  = (51, 153, 255, ALPHA)
	COLOR_SEAM  = (255, 153, 51, ALPHA)
	COLOR_INTER = (255, 51, 153, ALPHA)

	BORDER_TILE  = (51, 153, 255, 255)
	BORDER_SEAM  = (255, 153, 51, 255)
	BORDER_INTER = (255, 51, 153, 255)

	BORDER_WIDTH = 2

	font_size      = max(12, int(min(tile_w, tile_h) * 0.2))
	meta_font_size = max(12, int(min(tile_w, tile_h) * 0.1))

	try:
		font      = ImageFont.truetype("arial.ttf", font_size)
		meta_font = ImageFont.truetype("arial.ttf", meta_font_size)
	except:
		font      = ImageFont.load_default()
		meta_font = ImageFont.load_default()

	# Layers
	layer_tiles  = Image.new("RGBA", (W, H), (0, 0, 0, 0))
	layer_seams  = Image.new("RGBA", (W, H), (0, 0, 0, 0))
	layer_inter  = Image.new("RGBA", (W, H), (0, 0, 0, 0))
	labels_tiles = Image.new("RGBA", (W, H), (0, 0, 0, 0))
	labels_seams = Image.new("RGBA", (W, H), (0, 0, 0, 0))
	labels_inter = Image.new("RGBA", (W, H), (0, 0, 0, 0))
	meta_layer   = Image.new("RGBA", (W, H), (0, 0, 0, 0))

	draw_tiles = ImageDraw.Draw(layer_tiles)
	draw_inter = ImageDraw.Draw(layer_inter)
	draw_lbl_t = ImageDraw.Draw(labels_tiles)
	draw_lbl_s = ImageDraw.Draw(labels_seams)
	draw_lbl_i = ImageDraw.Draw(labels_inter)
	draw_meta  = ImageDraw.Draw(meta_layer)

	def DrawRegion(draw_layer, draw_label, x0, y0, x1, y1, fill_color, border_color, label: str):
		draw_layer.rectangle([x0, y0, x1, y1], fill = fill_color, outline = border_color, width = BORDER_WIDTH)
		bbox = draw_label.textbbox((0, 0), label, font = font)
		tw   = bbox[2] - bbox[0]
		th   = bbox[3] - bbox[1]
		tx   = x0 + (x1 - x0 - tw) / 2
		ty   = y0 + (y1 - y0 - th) / 2

		for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
			draw_label.text((tx + dx, ty + dy), label, font = font, fill = (0, 0, 0, 255))

		draw_label.text((tx, ty), label, font = font, fill = (255, 255, 255, 255))

	traversal  = GetTraversalOrder(cols, rows, traversal_mode)
	tile_index = { (r, c): idx for idx, (r, c) in enumerate(traversal) }
	t_counter  = 1

	for (r, c) in traversal:
		x0    = c * tile_w
		y0    = r * tile_h
		x1    = x0 + tile_w
		y1    = y0 + tile_h
		label = f"T{t_counter}"
		DrawRegion(draw_tiles, draw_lbl_t, x0, y0, x1, y1, COLOR_TILE, BORDER_TILE, label)
		t_counter += 1

	seams_exist = seam_refinement in ("Seams", "Seams with Intersections")
	if seams_exist:
		layer_seams_v = Image.new("RGBA", (W, H), (0, 0, 0, 0))
		layer_seams_h = Image.new("RGBA", (W, H), (0, 0, 0, 0))
		draw_seams_v  = ImageDraw.Draw(layer_seams_v)
		draw_seams_h  = ImageDraw.Draw(layer_seams_h)

		seam_entries_v = []
		seam_entries_h = []

		for r in range(rows):
			for c in range(cols - 1):
				x0          = (c + 0.5) * tile_w
				y0          = r * tile_h
				x1          = x0 + tile_w
				y1          = y0 + tile_h
				tiles_touch = [(r, c), (r, c + 1)]
				earliest    = min(tile_index.get(t, float('inf')) for t in tiles_touch)
				key         = (earliest, r, c)
				seam_entries_v.append((key, draw_seams_v, draw_lbl_s, x0, y0, x1, y1, COLOR_SEAM, BORDER_SEAM))

		for r in range(rows - 1):
			for c in range(cols):
				x0          = c * tile_w
				y0          = (r + 0.5) * tile_h
				x1          = x0 + tile_w
				y1          = y0 + tile_h
				tiles_touch = [(r, c), (r + 1, c)]
				earliest    = min(tile_index.get(t, float('inf')) for t in tiles_touch)
				key         = (earliest, r, c)
				seam_entries_h.append((key, draw_seams_h, draw_lbl_s, x0, y0, x1, y1, COLOR_SEAM, BORDER_SEAM))

		seam_entries_v.sort(key = lambda e: e[0])
		seam_entries_h.sort(key = lambda e: e[0])

		for _, draw_layer, draw_label, x0, y0, x1, y1, color, border in seam_entries_v:
			label = f"T{t_counter}"
			DrawRegion(draw_layer, draw_label, x0, y0, x1, y1, color, border, label)
			t_counter += 1

		for _, draw_layer, draw_label, x0, y0, x1, y1, color, border in seam_entries_h:
			label = f"T{t_counter}"
			DrawRegion(draw_layer, draw_label, x0, y0, x1, y1, color, border, label)
			t_counter += 1

		layer_seams = Image.alpha_composite(layer_seams_v, layer_seams_h)

	inter_exist = seam_refinement in ("Intersections", "Seams with Intersections")
	if inter_exist:
		inter_entries = []
		for r in range(rows - 1):
			for c in range(cols - 1):
				x0          = (c + 0.5) * tile_w
				y0          = (r + 0.5) * tile_h
				x1          = x0 + tile_w
				y1          = y0 + tile_h
				tiles_touch = [(r, c), (r, c + 1), (r + 1, c), (r + 1, c + 1)]
				earliest    = min(tile_index.get(t, float('inf')) for t in tiles_touch)
				key         = (earliest, r, c)
				inter_entries.append((key, x0, y0, x1, y1))

		inter_entries.sort(key = lambda e: e[0])

		for _, x0, y0, x1, y1 in inter_entries:
			label = f"T{t_counter}"
			DrawRegion(draw_inter, draw_lbl_i, x0, y0, x1, y1, COLOR_INTER, BORDER_INTER, label)
			t_counter += 1

	def Compose(base, layer, labels):
		if layer is None:
			return None
		combined = Image.alpha_composite(base, layer)
		combined = Image.alpha_composite(combined, labels)
		return combined

	overlay_tiles = Compose(base_img, layer_tiles, labels_tiles)
	overlay_seams = Compose(base_img, layer_seams, labels_seams) if seams_exist else None
	overlay_inter = Compose(base_img, layer_inter, labels_inter) if inter_exist else None

	combined = Image.alpha_composite(base_img, layer_tiles)
	if seams_exist:
		combined = Image.alpha_composite(combined, layer_seams)
	if inter_exist:
		combined = Image.alpha_composite(combined, layer_inter)
	combined = Image.alpha_composite(combined, labels_tiles)
	if seams_exist:
		combined = Image.alpha_composite(combined, labels_seams)
	if inter_exist:
		combined = Image.alpha_composite(combined, labels_inter)

	meta_text   = f"Tile Size: {int(tile_w)} x {int(tile_h)}"
	margin      = 10
	meta_bbox   = draw_meta.textbbox((0, 0), meta_text, font = meta_font)
	meta_height = meta_bbox[3] - meta_bbox[1]
	meta_pos    = (margin, H - meta_height - margin)

	for dx, dy in [(-1, -1), (1, -1), (-1, 1), (1, 1)]:
		draw_meta.text((meta_pos[0] + dx, meta_pos[1] + dy), meta_text, font = meta_font, fill = (0, 0, 0, 255))

	draw_meta.text(meta_pos, meta_text, font = meta_font, fill = (255, 255, 255, 255))

	combined      = Image.alpha_composite(combined, meta_layer)
	overlay_tiles = Image.alpha_composite(overlay_tiles, meta_layer)

	if overlay_seams:
		overlay_seams = Image.alpha_composite(overlay_seams, meta_layer)

	if overlay_inter:
		overlay_inter = Image.alpha_composite(overlay_inter, meta_layer)

	def ToTensor(img):
		if img is None:
			return None
		return PillowToTensor(img.convert("RGB"), device).unsqueeze(0)

	return (
		ToTensor(combined),
		ToTensor(overlay_tiles),
		ToTensor(overlay_seams),
		ToTensor(overlay_inter)
	)

def ExtractLabeledCropsFromImage(pil_base_img, cols, rows, traversal_mode, seam_refinement, device):
	W, H = pil_base_img.size

	tile_w_px = W // cols
	tile_h_px = H // rows

	if tile_w_px <= 0 or tile_h_px <= 0:
		return None

	traversal  = GetTraversalOrder(cols, rows, traversal_mode)
	tile_index = { (r, c): idx for idx, (r, c) in enumerate(traversal) }

	crop_tensors = []
	t_counter    = 1

	font_size = max(12, int(min(tile_w_px, tile_h_px) * 0.2))
	try:
		font = ImageFont.truetype("arial.ttf", font_size)
	except:
		font = ImageFont.load_default()

	def DrawLabelOnPil(pil_img, label):
		draw = ImageDraw.Draw(pil_img)
		bbox = draw.textbbox((0, 0), label, font = font)
		tw   = bbox[2] - bbox[0]
		th   = bbox[3] - bbox[1]
		cx   = (pil_img.width - tw) / 2
		cy   = (pil_img.height - th) / 2

		for dx, dy in [(-1,0),(1,0),(0,-1),(0,1)]:
			draw.text((cx + dx, cy + dy), label, font = font, fill = (0, 0, 0, 255))

		draw.text((cx, cy), label, font = font, fill = (255, 255, 255, 255))

	def MakeFixedSizeCrop(src_crop):
		if src_crop.width == tile_w_px and src_crop.height == tile_h_px:
			return src_crop
		
		canvas = Image.new("RGBA", (tile_w_px, tile_h_px), (0, 0, 0, 255))
		
		if src_crop.width > tile_w_px or src_crop.height > tile_h_px:
			src_crop = src_crop.crop((0, 0, min(src_crop.width, tile_w_px), min(src_crop.height, tile_h_px)))
			
		canvas.paste(src_crop, (0, 0))
		return canvas

	def AppendLabeledCrop(x0f, y0f, x1f, y1f):
		nonlocal t_counter
		
		x0 = int(round(x0f)); y0 = int(round(y0f))
		x1 = int(round(x1f)); y1 = int(round(y1f))
		x0 = max(0, min(W, x0)); x1 = max(0, min(W, x1))
		y0 = max(0, min(H, y0)); y1 = max(0, min(H, y1))

		if x1 <= x0 or y1 <= y0:
			return
		
		crop_img = pil_base_img.crop((x0, y0, x1, y1)).convert("RGBA")
		fixed    = MakeFixedSizeCrop(crop_img)
		label    = f"T{t_counter}"

		DrawLabelOnPil(fixed, label)
		
		crop_rgb = fixed.convert("RGB")
		tensor   = PillowToTensor(crop_rgb, device).unsqueeze(0)
		crop_tensors.append(tensor.squeeze(0))
		t_counter += 1

	for (r, c) in traversal:
		x0 = c * tile_w_px
		y0 = r * tile_h_px
		x1 = x0 + tile_w_px
		y1 = y0 + tile_h_px
		AppendLabeledCrop(x0, y0, x1, y1)

	seams_exist = seam_refinement in ("Seams", "Seams with Intersections")
	if seams_exist:
		seam_entries_v = []
		seam_entries_h = []

		for r in range(rows):
			for c in range(cols - 1):
				
				x0          = int(round((c + 0.5) * tile_w_px))
				y0          = r * tile_h_px
				x1          = x0 + tile_w_px
				y1          = y0 + tile_h_px
				tiles_touch = [(r, c), (r, c + 1)]
				earliest    = min(tile_index.get(t, float('inf')) for t in tiles_touch)
				seam_entries_v.append(((earliest, r, c), x0, y0, x1, y1))

		for r in range(rows - 1):
			for c in range(cols):
				x0          = c * tile_w_px
				y0          = int(round((r + 0.5) * tile_h_px))
				x1          = x0 + tile_w_px
				y1          = y0 + tile_h_px
				tiles_touch = [(r, c), (r + 1, c)]
				earliest    = min(tile_index.get(t, float('inf')) for t in tiles_touch)
				seam_entries_h.append(((earliest, r, c), x0, y0, x1, y1))

		seam_entries_v.sort(key = lambda e: e[0])
		seam_entries_h.sort(key = lambda e: e[0])

		for _, x0, y0, x1, y1 in seam_entries_v:
			AppendLabeledCrop(x0, y0, x1, y1)

		for _, x0, y0, x1, y1 in seam_entries_h:
			AppendLabeledCrop(x0, y0, x1, y1)

	inter_exist = seam_refinement in ("Intersections", "Seams with Intersections")
	if inter_exist:
		inter_entries = []

		for r in range(rows - 1):
			for c in range(cols - 1):
				x0          = int(round((c + 0.5) * tile_w_px))
				y0          = int(round((r + 0.5) * tile_h_px))
				x1          = x0 + tile_w_px
				y1          = y0 + tile_h_px
				tiles_touch = [(r, c), (r, c + 1), (r + 1, c), (r + 1, c + 1)]
				earliest    = min(tile_index.get(t, float('inf')) for t in tiles_touch)
				inter_entries.append(((earliest, r, c), x0, y0, x1, y1))

		inter_entries.sort(key = lambda e: e[0])
		for _, x0, y0, x1, y1 in inter_entries:
			AppendLabeledCrop(x0, y0, x1, y1)

	if len(crop_tensors) == 0:
		return None
	
	return torch.stack(crop_tensors, dim = 0)

def AutogrowSortKey(value):
	s = str(value)
	n = ""

	for ch in reversed(s):
		if ch.isdigit():
			n = ch + n
		else:
			break

	if n != "":
		try:
			return (0, int(n), s)
		except Exception:
			pass

	return (1, s)


def NormalizeAutogrow(values):
	if values is None:
		return []
	
	if isinstance(values, list):
		return values
	
	if isinstance(values, tuple):
		return list(values)
	
	if isinstance(values, dict):
		keys = sorted(values.keys(), key =AutogrowSortKey)
		return [values[k] for k in keys]
	
	return [values]


def ParseRetargetRules(text, type):
	if not text:
		return {}
	
	retarget = {}

	if type == "guider":
		pattern = re.compile(r"^\s*G(\d+)\s*=\s*T(\d+)\s*$", re.IGNORECASE)
	elif type == "sampler":
		pattern = re.compile(r"^\s*S(\d+)\s*=\s*T(\d+)\s*$", re.IGNORECASE)
	elif type == "sigmas":
		pattern = re.compile(r"^\s*I(\d+)\s*=\s*T(\d+)\s*$", re.IGNORECASE)

	for line in str(text).splitlines():
		match = pattern.match(line)

		if not match:
			continue
		try:
			input_index = int(match.group(1))
			pass_index  = int(match.group(2)) - 1
		except Exception:
			continue

		if pass_index < 0:
			continue

		retarget[pass_index] = input_index

	return retarget


def Run(TileGuider, TileSampler, TileSigmas, TraversalMode, CropRegions, HorizontalTiles, VerticalTiles, SeamRefinement = "None", Retarget = None, Image = None):
	cols     = int(HorizontalTiles)
	rows     = int(VerticalTiles)
	guiders  = NormalizeAutogrow(TileGuider)
	samplers = NormalizeAutogrow(TileSampler)
	sigmas   = NormalizeAutogrow(TileSigmas)

	retarget_guiders  = ParseRetargetRules(Retarget, "guider")
	retarget_samplers = ParseRetargetRules(Retarget, "sampler")
	retarget_sigmas   = ParseRetargetRules(Retarget, "sigmas")

	guiders_out = {
		"rows"    : rows,
		"cols"    : cols,
		"guiders" : guiders,
		"retarget": retarget_guiders
	}

	samplers_out = {
		"rows"    : rows,
		"cols"    : cols,
		"samplers": samplers,
		"retarget": retarget_samplers
	}

	sigmas_out = {
		"rows"    : rows,
		"cols"    : cols,
		"sigmas"  : sigmas,
		"retarget": retarget_sigmas
	}

	overlay = RenderOverlay(
		Image,
		cols,
		rows,
		SeamRefinement,
		traversal_mode = TraversalMode
	)

	if CropRegions and CropRegions != "Disable":
		if Image is not None and isinstance(Image, torch.Tensor) and Image.ndim == 4 and Image.shape[0] > 0:
			base_tensor   = Image.clone()[0]
			device        = base_tensor.device
			pil_base      = TensorToPillow(base_tensor).convert("RGB")
			crops_batched = ExtractLabeledCropsFromImage(pil_base, cols, rows, TraversalMode, SeamRefinement, device)

	return guiders_out, samplers_out, sigmas_out, overlay, crops_batched
