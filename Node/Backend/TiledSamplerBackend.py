from __future__ import annotations
import math
from contextlib import nullcontext
import torch                                                       # type: ignore
import torch.nn.functional as F                                    # type: ignore
import comfy.sample                                                # type: ignore
import comfy.model_management                                      # type: ignore
import latent_preview                                              # type: ignore
from   comfy_extras.nodes_custom_sampler import Noise_RandomNoise  # type: ignore
try:
	from rich.live import Live  # type: ignore
	from .TiledSamplerProgressBar import (
		TiledProgress,
		AddProgressBars,
		RICH_CONSOLE
	)
	RICH_AVAILABLE = True
except Exception:
	RICH_AVAILABLE = False

MASK64      = (1 << 64) - 1
ALPHA_CACHE = {}


def CloneLatent(latent: dict, samples: torch.Tensor) -> dict:
	out            = dict(latent) if isinstance(latent, dict) else {}
	out["samples"] = samples

	return out


def CloneLatentSliced(latent: dict, samples: torch.Tensor, y0: int, y1: int, x0: int, x1: int) -> dict:
	out            = dict(latent) if isinstance(latent, dict) else {}
	out["samples"] = samples
	nm             = out.get("noise_mask", None)

	if isinstance(nm, torch.Tensor):
		sy, sx            = MaskScale(latent["samples"], nm)
		my0               = int(y0) * int(sy)
		my1               = int(y1) * int(sy)
		mx0               = int(x0) * int(sx)
		mx1               = int(x1) * int(sx)
		out["noise_mask"] = nm[:, :, my0:my1, mx0:mx1]

	return out


def ClampFloat(x: float, lo: float, hi: float) -> float:
	try:
		v = float(x)
	except Exception:
		return float(lo)
	
	if v < lo:
		return float(lo)
	
	if v > hi:
		return float(hi)
	
	return float(v)


def RoundUpToMultiple(value: int, multiple: int) -> int:
	if multiple <= 0:
		return int(value)
	
	return int(((int(value) + int(multiple) - 1) // int(multiple)) * int(multiple))


def MaskScale(latent_samples: torch.Tensor, noise_mask: torch.Tensor) -> tuple[int, int]:
	lh = int(latent_samples.shape[-2])
	lw = int(latent_samples.shape[-1])
	mh = int(noise_mask.shape[-2])
	mw = int(noise_mask.shape[-1])
	sy = 1 if lh <= 0 else max(1, int(round(float(mh) / float(lh))))
	sx = 1 if lw <= 0 else max(1, int(round(float(mw) / float(lw))))

	return sy, sx


def PadLatent(latent: dict, pad_w: int, pad_h: int, mode: str) -> dict:
	out            = dict(latent)
	out["samples"] = F.pad(latent["samples"], (0, pad_w, 0, pad_h), mode = mode)
	nm             = out.get("noise_mask", None)

	if isinstance(nm, torch.Tensor):
		sy, sx            = MaskScale(latent["samples"], nm)
		out["noise_mask"] = F.pad(nm, (0, int(pad_w) * int(sx), 0, int(pad_h) * int(sy)), mode = mode)

	return out


def SampleLatent(latent, noise_tensor, guider, sampler, sigmas, live, progress = None, bar_name = None, callback = None):
	latent_dict  = latent
	latent_image = latent_dict["samples"]

	noise_mask   = latent_dict.get("noise_mask", None)
	noise_tensor = noise_tensor.to(latent_image.device)

	def WrappedCallback(step, x0, x, total):
		if RICH_AVAILABLE and progress and bar_name:
			progress.advance(bar_name)
			live.update(progress.render(), refresh = True)

		if callback:
			callback(step, x0, x, total)

	progress_bar = True if RICH_AVAILABLE else not comfy.utils.PROGRESS_BAR_ENABLED

	try:
		autocast_ctx = torch.autocast(
			device_type = comfy.model_management.get_autocast_device(latent_image.device),
			enabled     = False
		)
	except Exception:
		autocast_ctx = nullcontext()

	with autocast_ctx:
		samples = guider.sample(
			noise_tensor,
			latent_image,
			sampler,
			sigmas,
			denoise_mask = noise_mask,
			callback     = WrappedCallback,
			disable_pbar = progress_bar,
			seed         = None
		)

	return samples.to(latent_image.device)


def ExtractNoiseSeed(noise_obj) -> int:
	for attr in ("seed", "noise_seed", "Seed", "NoiseSeed", "_seed"):
		try:
			v = getattr(noise_obj, attr)
			if isinstance(v, int):
				return int(v) & MASK64
			
			if isinstance(v, (float, str)):
				vi = int(v)

				return int(vi) & MASK64
		except Exception:
			continue

	try:
		return (hash(repr(noise_obj)) & 0xFFFFFFFFFFFFFFFF) & MASK64
	except Exception:
		return 0


def GenerateGlobalNoise(noise_obj, latent: dict, pass_index: int) -> torch.Tensor:
	base_seed = ExtractNoiseSeed(noise_obj)
	seed      = (int(base_seed) + int(pass_index)) & MASK64

	return Noise_RandomNoise(seed).generate_noise(latent)


def AlphaPadding(height: int, width: int, left: int, right: int, top: int, bottom: int, device, dtype) -> torch.Tensor:
	key    = (int(height), int(width), int(left), int(right), int(top), int(bottom), str(device), str(dtype))
	cached = ALPHA_CACHE.get(key, None)

	if cached is not None:
		return cached

	w = int(width)
	h = int(height)

	if w <= 0 or h <= 0:
		return torch.zeros((1, 1, 0, 0), device = device, dtype = dtype)

	lx = max(0, min(int(left), w))
	rx = max(0, min(int(right), w - lx))
	tx = max(0, min(int(top), h))
	bx = max(0, min(int(bottom), h - tx))

	if lx > 0:
		left_ramp = torch.linspace(0.0, 1.0, steps = lx + 1, device = device, dtype = dtype)[1:]
	else:
		left_ramp = None

	if rx > 0:
		right_ramp = torch.linspace(1.0, 0.0, steps = rx + 1, device = device, dtype = dtype)[:-1]
	else:
		right_ramp = None

	mid_w = w - lx - rx

	if mid_w > 0:
		mid_x = torch.ones((mid_w,), device = device, dtype = dtype)
	else:
		mid_x = torch.empty((0,), device = device, dtype = dtype)

	parts_x = []

	if left_ramp is not None:
		parts_x.append(left_ramp)

	if mid_w > 0:
		parts_x.append(mid_x)

	if right_ramp is not None:
		parts_x.append(right_ramp)

	alpha_x = torch.cat(parts_x, dim = 0).view(1, 1, 1, -1)

	if tx > 0:
		top_ramp = torch.linspace(0.0, 1.0, steps = tx + 1, device = device, dtype = dtype)[1:]
	else:
		top_ramp = None

	if bx > 0:
		bot_ramp = torch.linspace(1.0, 0.0, steps = bx + 1, device = device, dtype = dtype)[:-1]
	else:
		bot_ramp = None

	mid_h = h - tx - bx

	if mid_h > 0:
		mid_y = torch.ones((mid_h,), device = device, dtype = dtype)
	else:
		mid_y = torch.empty((0,), device = device, dtype = dtype)

	parts_y = []

	if top_ramp is not None:
		parts_y.append(top_ramp)

	if mid_h > 0:
		parts_y.append(mid_y)

	if bot_ramp is not None:
		parts_y.append(bot_ramp)

	alpha_y          = torch.cat(parts_y, dim = 0).view(1, 1, -1, 1)
	alpha            = alpha_y * alpha_x
	ALPHA_CACHE[key] = alpha

	return alpha


def AlphaSeam(height: int, width: int, direction: str, device, dtype) -> torch.Tensor:
	key    = ("seam", int(height), int(width), str(direction), str(device), str(dtype))
	cached = ALPHA_CACHE.get(key, None)

	if cached is not None:
		return cached

	h = int(height)
	w = int(width)

	if w <= 0 or h <= 0:
		return torch.zeros((1, 1, 0, 0), device = device, dtype = dtype)

	if direction == "vertical":
		x     = torch.linspace(-1.0, 1.0, steps = w, device = device, dtype = dtype)
		ax    = 1.0 - torch.abs(x)
		ax    = torch.clamp(ax, 0.0, 1.0).view(1, 1, 1, -1)
		ay    = torch.ones((1, 1, h, 1), device = device, dtype = dtype)
		alpha = ay * ax
	else:
		y     = torch.linspace(-1.0, 1.0, steps = h, device = device, dtype = dtype)
		ay    = 1.0 - torch.abs(y)
		ay    = torch.clamp(ay, 0.0, 1.0).view(1, 1, -1, 1)
		ax    = torch.ones((1, 1, 1, w), device = device, dtype = dtype)
		alpha = ay * ax

	ALPHA_CACHE[key] = alpha

	return alpha


def AlphaIntersection(height: int, width: int, device, dtype) -> torch.Tensor:
	key    = ("intersection", int(height), int(width), str(device), str(dtype))
	cached = ALPHA_CACHE.get(key, None)

	if cached is not None:
		return cached

	h = int(height)
	w = int(width)

	if w <= 0 or h <= 0:
		return torch.zeros((1, 1, 0, 0), device = device, dtype = dtype)

	ys    = torch.linspace(-1.0, 1.0, steps = h, device = device, dtype = dtype).view(-1, 1)
	xs    = torch.linspace(-1.0, 1.0, steps = w, device = device, dtype = dtype).view(1, -1)
	rr    = torch.sqrt(xs * xs + ys * ys)
	maxr  = float(math.sqrt(2.0))
	alpha = 1.0 - (rr / maxr)
	alpha = torch.clamp(alpha, 0.0, 1.0).view(1, 1, h, w)

	ALPHA_CACHE[key] = alpha

	return alpha


def BlendInplace(base: torch.Tensor, patch: torch.Tensor, y0: int, y1: int, x0: int, x1: int, alpha: torch.Tensor) -> None:
	patch = patch.to(base.device)
	alpha = alpha.to(base.device)

	if y1 <= y0 or x1 <= x0:
		return
	
	region = base[:, :, y0:y1, x0:x1]
	base[:, :, y0:y1, x0:x1] = region + (patch - region) * alpha


def AdjustSigmas(sigmas: torch.Tensor, seam_strength: float, seam_steps: float) -> torch.Tensor:
	s = ClampFloat(seam_strength, 0.01, 1.0)
	t = ClampFloat(seam_steps, 0.0, 1.0)
	t = 1 - t

	if not isinstance(sigmas, torch.Tensor):
		raise ValueError("Expected SIGMAS tensor")

	out = sigmas * float(s)
	n   = int(out.shape[-1])

	if n <= 2:
		return out

	remove = int((n - 1) * float(t))

	if remove < 0:
		remove = 0

	if remove > n - 2:
		remove = n - 2

	return out[remove:]


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


def JohnsTiledSampler(
	noise,
	guider,
	sampler,
	sigmas,
	latent_image    : dict,
	TraversalMode   : str,
	horizontal_tiles: int,
	vertical_tiles  : int,
	overlap         : float,
	seam_refinement : str,
	seam_strength   : float,
	seam_steps      : float,
	TileGuiderMap   = None,
	TileSamplerMap  = None,
	TileSigmasMap   = None
) -> dict:
	try:
		comfy.model_management.load_model_gpu(guider.model_patcher)
	except Exception:
		pass

	if torch.cuda.is_available():
		torch.cuda.synchronize()

	orig_latent           = latent_image
	samples: torch.Tensor = orig_latent["samples"]
	samples = comfy.sample.fix_empty_latent_channels(guider.model_patcher, samples, orig_latent.get("downscale_ratio_spacial", None))

	latent_image = CloneLatent(orig_latent, samples)

	_, _, height, width   = samples.shape

	padded_height = ((height + vertical_tiles - 1) // vertical_tiles) * vertical_tiles
	padded_width  = ((width + horizontal_tiles - 1) // horizontal_tiles) * horizontal_tiles
	pad_height    = padded_height - height
	pad_width     = padded_width - width

	if pad_height or pad_width:
		pad_mode      = "reflect" if (height > 1 and width > 1) else "replicate"
		latent_image  = PadLatent(latent_image, pad_width, pad_height, pad_mode)
		samples       = latent_image["samples"]
		height, width = padded_height, padded_width

	tile_height = height // vertical_tiles
	tile_width  = width // horizontal_tiles
	overlap     = ClampFloat(overlap, 0.0, 0.5)

	tile_px_w = tile_width * 8
	tile_px_h = tile_height * 8
	pad_px_x  = RoundUpToMultiple(int(math.ceil(tile_px_w * overlap)), 64)
	pad_px_y  = RoundUpToMultiple(int(math.ceil(tile_px_h * overlap)), 64)
	pad_x     = pad_px_x // 8
	pad_y     = pad_px_y // 8

	refinement       = str(seam_refinement or "None")
	do_seams         = refinement in ("Seams", "Seams with Intersections")
	do_intersections = refinement in ("Intersections", "Seams with Intersections")

	tile_guiders      = []
	retarget_guiders  = {}
	tile_samplers     = []
	retarget_samplers = {}
	tile_sigmas       = []
	retarget_sigmas   = {}
	default_sampler   = sampler
	default_sigmas    = sigmas

	if isinstance(TileGuiderMap, dict):
		tile_guiders     = TileGuiderMap.get("guiders", [])
		retarget_guiders = TileGuiderMap.get("retarget", {})

	if isinstance(TileSamplerMap, dict):
		tile_samplers     = TileSamplerMap.get("samplers", [])
		retarget_samplers = TileSamplerMap.get("retarget", {})

	if isinstance(TileSigmasMap, dict):
		tile_sigmas     = TileSigmasMap.get("sigmas", [])
		retarget_sigmas = TileSigmasMap.get("retarget", {})

	global_noise = GenerateGlobalNoise(noise, latent_image, pass_index = 0)
	base_samples = samples.clone().to(samples.device)
	out          = base_samples.clone()

	def ResolveRetargetIndex(retarget_map, pass_index: int):
		if not isinstance(retarget_map, dict) or len(retarget_map) == 0:
			return False, None

		found   = False
		raw_idx = None
		key_int = int(pass_index)

		if key_int in retarget_map:
			found   = True
			raw_idx = retarget_map.get(key_int)
		else:
			key_str = str(key_int)
			if key_str in retarget_map:
				found   = True
				raw_idx = retarget_map.get(key_str)
			else:
				for k, v in retarget_map.items():
					try:
						if int(k) == key_int:
							found   = True
							raw_idx = v
							break
					except Exception:
						continue

		if not found:
			return False, None

		try:
			return True, int(raw_idx)
		except Exception:
			return True, None

	def SelectForPass(tile_list, default, retarget_map, cursor_ref, pass_index: int):
		selected      = default
		has_rule, idx = ResolveRetargetIndex(retarget_map, pass_index)

		if has_rule:
			if idx is not None and 0 <= idx < len(tile_list):
				item = tile_list[idx]
				if item is not None:
					selected = item
					return selected, True

			return selected, False

		cursor = int(cursor_ref[0])
		if cursor < len(tile_list):
			item = tile_list[cursor]
			if item is not None:
				selected = item
			cursor_ref[0] = cursor + 1

		return selected, False

	def GeneratePassDescriptors():
		tile_order = GetTraversalOrder(horizontal_tiles, vertical_tiles, TraversalMode)

		# Tiles
		for ty, tx in tile_order:
			y0 = ty * tile_height
			y1 = (ty + 1) * tile_height
			x0 = tx * tile_width
			x1 = (tx + 1) * tile_width

			top_pad   = pad_y if ty > 0 else 0
			bot_pad   = pad_y if ty < (vertical_tiles - 1) else 0
			left_pad  = pad_x if tx > 0 else 0
			right_pad = pad_x if tx < (horizontal_tiles - 1) else 0

			ry0 = max(0, y0 - top_pad)
			ry1 = min(height, y1 + bot_pad)
			rx0 = max(0, x0 - left_pad)
			rx1 = min(width,  x1 + right_pad)

			yield {
				"type"    : "tile",
				"coords"  : (ry0, ry1, rx0, rx1),
				"noise"   : global_noise,
				"alpha_fn": lambda h, w, ry0 = ry0, ry1 = ry1, rx0 = rx0, rx1 = rx1, y0 = y0, y1 = y1, x0 = x0, x1 = x1, top_pad = top_pad, bot_pad = bot_pad, left_pad = left_pad, right_pad = right_pad: 
					AlphaPadding(
						h, w,
						left   = int(left_pad  if rx0 == (x0 - left_pad)  else (x0  - rx0)),
						right  = int(right_pad if rx1 == (x1 + right_pad) else (rx1 - x1)),
						top    = int(top_pad   if ry0 == (y0 - top_pad)   else (y0  - ry0)),
						bottom = int(bot_pad   if ry1 == (y1 + bot_pad)   else (ry1 - y1)),
						device = out.device,
						dtype  = out.dtype
					),
				"label": "Tile"
			}

		if do_seams:
			seam_noise = GenerateGlobalNoise(noise, latent_image, pass_index=1)

			# Vertical seams
			if horizontal_tiles > 1:
				seam_cols  = horizontal_tiles - 1
				seam_rows  = vertical_tiles
				seam_order = GetTraversalOrder(seam_cols, seam_rows, TraversalMode)

				for ty, seam_col in seam_order:
					seam_x   = seam_col + 1
					x_center = seam_x * tile_width
					sx0      = max(0, x_center - (tile_width // 2))
					sx1      = min(width, sx0 + tile_width)

					y0 = ty * tile_height
					y1 = (ty + 1) * tile_height

					yield {
						"type"    : "v_seam",
						"coords"  : (y0, y1, sx0, sx1),
						"noise"   : seam_noise,
						"alpha_fn": lambda h, w: AlphaSeam(h, w, "vertical", out.device, out.dtype),
						"label"   : "Seam"
					}

			# Horizontal seams
			if vertical_tiles > 1:
				seam_cols  = horizontal_tiles
				seam_rows  = vertical_tiles - 1
				seam_order = GetTraversalOrder(seam_cols, seam_rows, TraversalMode)

				for seam_row, tx in seam_order:
					seam_y   = seam_row + 1
					y_center = seam_y * tile_height
					sy0      = max(0, y_center - (tile_height // 2))
					sy1      = min(height, sy0 + tile_height)

					x0 = tx * tile_width
					x1 = (tx + 1) * tile_width

					yield {
						"type"    : "h_seam",
						"coords"  : (sy0, sy1, x0, x1),
						"noise"   : seam_noise,
						"alpha_fn": lambda h, w: AlphaSeam(h, w, "horizontal", out.device, out.dtype),
						"label"   : "Seam"
					}

		if do_intersections and horizontal_tiles > 1 and vertical_tiles > 1:
			inter_noise = GenerateGlobalNoise(noise, latent_image, pass_index = 2 if do_seams else 1)

			inter_cols  = horizontal_tiles - 1
			inter_rows  = vertical_tiles - 1
			inter_order = GetTraversalOrder(inter_cols, inter_rows, TraversalMode)

			for inter_row, inter_col in inter_order:
				seam_y = inter_row + 1
				seam_x = inter_col + 1

				y_center = seam_y * tile_height
				x_center = seam_x * tile_width

				y0 = max(0, y_center - (tile_height // 2))
				y1 = min(height, y0 + tile_height)
				x0 = max(0, x_center - (tile_width // 2))
				x1 = min(width,  x0 + tile_width)

				top_pad   = pad_y
				bot_pad   = pad_y
				left_pad  = pad_x
				right_pad = pad_x

				iy0 = max(0, y0 - top_pad)
				iy1 = min(height, y1 + bot_pad)
				ix0 = max(0, x0 - left_pad)
				ix1 = min(width,  x1 + right_pad)

				yield {
					"type"    : "intersection",
					"coords"  : (iy0, iy1, ix0, ix1),
					"noise"   : inter_noise,
					"alpha_fn": lambda h, w, iy0 = iy0, iy1 = iy1, ix0 = ix0, ix1 = ix1, y0 = y0, y1 = y1, x0 = x0, x1 = x1, top_pad = top_pad, bot_pad = bot_pad, left_pad = left_pad, right_pad = right_pad:
						AlphaIntersection(h, w, out.device, out.dtype) * AlphaPadding(
							h, w,
							left   = int(left_pad  if ix0 == (x0 - left_pad)  else (x0  - ix0)),
							right  = int(right_pad if ix1 == (x1 + right_pad) else (ix1 - x1)),
							top    = int(top_pad   if iy0 == (y0 - top_pad)   else (y0  - iy0)),
							bottom = int(bot_pad   if iy1 == (y1 + bot_pad)   else (iy1 - y1)),
							device = out.device,
							dtype  = out.dtype
						),
					"label"   : "Int."
				}

	def BuildExecutionMap():
		guider_cursor_ref  = [0]
		sampler_cursor_ref = [0]
		sigmas_cursor_ref  = [0]
		pass_index         = 0
		tile_index         = 0
		seam_index         = 0
		inter_index        = 0
		execution_map      = []

		for desc in GeneratePassDescriptors():
			region_guider, _                     = SelectForPass(tile_guiders,  guider,          retarget_guiders,  guider_cursor_ref,  pass_index)
			region_sampler, _                    = SelectForPass(tile_samplers, default_sampler, retarget_samplers, sampler_cursor_ref, pass_index)
			selected_sigmas, sigmas_rule_applied = SelectForPass(tile_sigmas,   default_sigmas,  retarget_sigmas,   sigmas_cursor_ref,  pass_index)

			if desc["type"] != "tile" and (not sigmas_rule_applied) and selected_sigmas is default_sigmas:
				selected_sigmas = AdjustSigmas(default_sigmas, seam_strength, seam_steps)

			steps = int(selected_sigmas.shape[-1] - 1)

			if desc["type"] == "tile":
				name        = f"Tile {tile_index + 1}"
				tile_index += 1
			elif desc["type"] in ("v_seam", "h_seam"):
				name        = f"Seam {seam_index + 1}"
				seam_index += 1
			else:
				name        = f"Int. {inter_index + 1}"
				inter_index += 1

			execution_map.append({
				"desc"   : desc,
				"guider" : region_guider,
				"sampler": region_sampler,
				"sigmas" : selected_sigmas,
				"steps"  : steps,
				"name"   : name
			})
			pass_index += 1

		return execution_map

	execution_map = BuildExecutionMap()

	if RICH_AVAILABLE:
		steps_tile_list  = [entry["steps"] for entry in execution_map if entry["desc"]["type"] == "tile"]
		steps_seams_list = [entry["steps"] for entry in execution_map if entry["desc"]["type"] in ("v_seam", "h_seam")]
		steps_int_list   = [entry["steps"] for entry in execution_map if entry["desc"]["type"] == "intersection"]

		tile_work  = sum(steps_tile_list)
		seams_work = sum(steps_seams_list) + sum(steps_int_list)
		total_work = tile_work + seams_work

		progress = TiledProgress()
		progress.AddProgressBar("Overall", total_work,       "dim white", "bright_red",     "dim red")
		AddProgressBars(progress,  "Tile", steps_tile_list,  "dim white", "bright_yellow",  "dim yellow")
		AddProgressBars(progress,  "Seam", steps_seams_list, "dim white", "bright_magenta", "dim magenta")
		AddProgressBars(progress,  "Int.", steps_int_list,   "dim white", "bright_cyan",    "dim cyan")

	def RunSampling(live = None, progress = None):
		for entry in execution_map:
			desc            = entry["desc"]
			region_guider   = entry["guider"]
			region_sampler  = entry["sampler"]
			selected_sigmas = entry["sigmas"]
			steps           = entry["steps"]
			name            = entry["name"]

			ry0, ry1, rx0, rx1 = desc["coords"]
			region_latent      = CloneLatentSliced(latent_image, base_samples[:, :, ry0:ry1, rx0:rx1], ry0, ry1, rx0, rx1)
			region_noise       = desc["noise"][:, :, ry0:ry1, rx0:rx1]

			x0_output      = {}
			callback       = latent_preview.prepare_callback(region_guider.model_patcher, steps, x0_output)
			region_samples = SampleLatent(region_latent, region_noise, region_guider, region_sampler, selected_sigmas, live, progress, name, callback)

			h     = int(ry1 - ry0)
			w     = int(rx1 - rx0)
			alpha = desc["alpha_fn"](h, w)
			BlendInplace(out, region_samples, ry0, ry1, rx0, rx1, alpha)

		return CloneLatent(latent_image, out)

	if RICH_AVAILABLE:
		RICH_CONSOLE.show_cursor(False)
		try:
			with Live(progress.render(), console = RICH_CONSOLE, auto_refresh = False, redirect_stdout = True, redirect_stderr = True, screen = True, transient = False) as live:
				return RunSampling(live, progress)
		finally:
			RICH_CONSOLE.show_cursor(True)
			RICH_CONSOLE.print(progress.render())
	else:
		return RunSampling(None, None)
