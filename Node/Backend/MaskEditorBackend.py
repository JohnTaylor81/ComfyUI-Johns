from __future__ import annotations
import math
import os
import json
import re
import torch                       # type: ignore
import torch.nn.functional as F    # type: ignore
import folder_paths                # type: ignore
from   aiohttp import web          # type: ignore
from   server import PromptServer  # type: ignore
from   scipy import ndimage        # type: ignore
from   typing import Any, Dict


ADVANCED_MODES = {}

def register_mode(name):
	def decorator(func):
		ADVANCED_MODES[name] = func
		return func
	return decorator


@register_mode("Levels")
def ModeLevels(mask_b1hw, image_bchw, params):
	return Levels(
		mask_b1hw,
		float(params.get("Black Level", 1.0)),
		float(params.get("White Level", 1.0)),
		float(params.get("Gamma", 1.0)),
	).clamp(0.0, 1.0)


@register_mode("Luma")
def ModeLuma(mask_b1hw, image_bchw, params):
	luma = LuminanceB1HW(image_bchw).detach().clone().contiguous()

	if params.get("Invert Luma", False):
		luma = (1.0 - luma).clamp(0.0, 1.0)

	dn = float(params.get("Denoise", 0.0) or 0.0)
	if dn > 0:
		luma = GaussianBlurB1HW(luma, dn).clamp(0.0, 1.0)

	luma = ApplyBrightnessContrastMultiplier(
		luma,
		float(params.get("Brightness", 1.0)),
		float(params.get("Contrast", 1.0)),
		float(params.get("Gamma", 1.0)),
	).clamp(0.0, 1.0)

	luma = ApplyOverlay(luma, mask_b1hw, params)

	return luma


@register_mode("Details")
def ModeDetails(mask_b1hw, image_bchw, params):
	luma = LuminanceB1HW(image_bchw).detach().clone().contiguous()

	dn = float(params.get("Denoise", 0.0) or 0.0)
	if dn > 0:
		luma = GaussianBlurB1HW(luma, dn).clamp(0.0, 1.0)

	edge_blur = float(params.get("Detail Blur", 0.0) or 0.0)
	if edge_blur > 0:
		luma = GaussianBlurB1HW(luma, edge_blur).clamp(0.0, 1.0)

	edges = SobelEdgeMagnitudeB1HW(luma)

	if params.get("Invert Details", False):
		edges = (1.0 - edges).clamp(0.0, 1.0)

	edges = ApplyBrightnessContrastMultiplier(
		edges,
		float(params.get("Brightness", 1.0)),
		float(params.get("Contrast", 1.0)),
		float(params.get("Gamma", 1.0)),
	).clamp(0.0, 1.0)

	edges = ApplyOverlay(edges, mask_b1hw, params)

	return edges

def ApplyOverlay(mask_base, mask_shape, params):
	mask_options = params.get("Mask Options", None)
	if not isinstance(mask_options, dict):
		return mask_base

	mode = mask_options.get("Mask Options", None)
	if mode != "Overlay Mask":
		return mask_base

	opacity     = float(mask_options.get("Mask Opacity", 1.0))
	is_darken   = bool(mask_options.get("Mask Mode", False))
	invert_mask = bool(params.get("InvertMask", False))

	shape_mask = (1.0 - mask_shape) if invert_mask else mask_shape
	overlay    = (shape_mask * opacity).clamp(0.0, 1.0)

	if is_darken:
		return (mask_base - overlay).clamp(0.0, 1.0)
	else:
		return (mask_base + overlay * (1.0 - mask_base)).clamp(0.0, 1.0)


@register_mode("Color Range (WIP: Experimental)")
def ModeColorRange(mask_b1hw, image_bchw, params):
	target_hex_colors = ExtractTargetHexColors(params.get("Target Hue", "#FFFFFF"))
	hue_tol           = float(params.get("Hue Tolerance", 25))
	sat_thr           = float(params.get("Saturation Threshold", 0.5))
	feather           = int(params.get("Softness / Feathering", 5))
	invert            = bool(params.get("Invert Selection", False))
	use_cluster       = bool(params.get("Cluster", False))
	cluster_count     = int(params.get("Cluster Count", 5))
	cluster_strength  = float(params.get("Cluster Strength", 1.0))
	safe_hue_tol      = max(float(hue_tol), 1e-6)

	target_hsv_list = []
	for hex_color in target_hex_colors:
		r = int(hex_color[1:3], 16) / 255.0
		g = int(hex_color[3:5], 16) / 255.0
		b = int(hex_color[5:7], 16) / 255.0
		target_rgb = torch.tensor([r, g, b], dtype = torch.float32, device = image_bchw.device)
		target_hsv_list.append(RGBtoHSV(target_rgb))

	target_hsv = torch.stack(target_hsv_list, dim = 0)
	target_h   = target_hsv[:, 0] * 360.0

	hsv   = RGBtoHSVImage(image_bchw)
	img_h = hsv[:, 0:1] * 360.0
	img_s = hsv[:, 1:2]

	if not use_cluster:
		dh = torch.abs(img_h - target_h.view(1, -1, 1, 1))
		dh = torch.minimum(dh, 360.0 - dh)

		hue_mask = (1.0 - (dh / safe_hue_tol)).clamp(0.0, 1.0)
		hue_mask = hue_mask.amax(dim = 1, keepdim = True)
		sat_mask = (img_s >= sat_thr).float()

		mask = hue_mask * sat_mask

		if feather > 0:
			mask = GaussianBlurB1HW(mask, float(feather)).clamp(0.0, 1.0)

		if invert:
			mask = (1.0 - mask).clamp(0.0, 1.0)

		return ApplyOverlay(mask, mask_b1hw, params)

	B, _, H, W = hsv.shape
	pixels     = hsv.permute(0, 2, 3, 1).reshape(-1, 3)
	num_pixels = int(pixels.shape[0])

	if num_pixels <= 0:
		return ApplyOverlay(mask_b1hw, mask_b1hw, params)

	K        = max(1, min(int(cluster_count or 5), num_pixels))
	max_iter = 10

	idx       = torch.linspace(0, num_pixels - 1, steps = K, device = pixels.device).long()
	centroids = pixels[idx].clone()

	for _ in range(max_iter):
		dists  = torch.cdist(pixels, centroids)
		labels = torch.argmin(dists, dim = 1)

		new_centroids = []
		for k in range(K):
			cluster = pixels[labels == k]
			if len(cluster) == 0:
				new_centroids.append(centroids[k])
			else:
				new_centroids.append(cluster.mean(dim = 0))
		new_centroids = torch.stack(new_centroids)

		if torch.allclose(new_centroids, centroids, atol = 1e-4):
			break
		centroids = new_centroids

	selected_cluster_masks: list[torch.Tensor] = []
	selected_cluster_ids: list[int] = []
	for t_idx in range(target_hsv.shape[0]):
		target_hsv_vec   = target_hsv[t_idx].to(pixels.device).unsqueeze(0)
		cluster_dists    = torch.norm(centroids - target_hsv_vec, dim = 1)
		selected_cluster = torch.argmin(cluster_dists).item()
		selected_cluster_ids.append(int(selected_cluster))
		selected_cluster_masks.append(labels == selected_cluster)

	cluster_membership = torch.stack(selected_cluster_masks, dim = 1)  # (N, T)
	hard_mask_flat     = cluster_membership.any(dim = 1).float()        # (N,)
	cluster_mask_flat  = hard_mask_flat

	if cluster_strength > 0.0 and len(selected_cluster_ids) > 0:
		unique_ids        = sorted(set(selected_cluster_ids))
		ids_tensor        = torch.tensor(unique_ids, dtype = torch.long, device = pixels.device)
		selected_centroid = centroids[ids_tensor]                                     # (S,3)
		min_dist          = torch.cdist(pixels, selected_centroid).amin(dim = 1)      # (N,)

		selected_dist = min_dist[hard_mask_flat > 0.5]
		base_width    = selected_dist.mean() if selected_dist.numel() > 0 else min_dist.mean()
		width         = (base_width * (1.0 + 2.5 * cluster_strength)).clamp(min = 1e-6)
		soft_mask     = (1.0 - (min_dist / width)).clamp(0.0, 1.0)
		blend         = max(0.0, min(cluster_strength, 1.0))
		cluster_mask_flat = torch.maximum(hard_mask_flat, soft_mask * blend)

	cluster_mask = cluster_mask_flat.reshape(B, 1, H, W)

	if feather > 0:
		cluster_mask = GaussianBlurB1HW(cluster_mask, float(feather)).clamp(0.0, 1.0)

	if invert:
		cluster_mask = (1.0 - cluster_mask).clamp(0.0, 1.0)

	return ApplyOverlay(cluster_mask, mask_b1hw, params)


@register_mode("Texture / Frequency")
def ModeTextureFrequency(mask_b1hw, image_bchw, params):
	mode     = params.get("Mode", "High Frequency")
	strength = float(params.get("Sensitivity", 1.0))
	radius   = int(params.get("Detail Scale", 3))
	feather  = int(params.get("Softness / Feathering", 5))
	invert   = bool(params.get("Invert Selection", False))

	radius = max(1, radius)
	luma   = LuminanceB1HW(image_bchw).detach().clone().contiguous()

	if mode == "Low Frequency":
		low  = GaussianBlurB1HW(luma, float(radius)).clamp(0.0, 1.0)
		mask = low
	elif mode == "High Frequency":
		low  = GaussianBlurB1HW(luma, float(radius)).clamp(0.0, 1.0)
		high = (luma - low).abs()
		mask = high
	elif mode == "Band Pass":
		low1 = GaussianBlurB1HW(luma, float(radius)).clamp(0.0, 1.0)
		low2 = GaussianBlurB1HW(luma, float(radius * 2)).clamp(0.0, 1.0)
		band = (low1 - low2).abs()
		mask = band
	else:
		mask = luma

	mask = mask - mask.min()

	if mask.max() > 0:
		mask = mask / mask.max()

	mask = (mask * strength).clamp(0.0, 1.0)

	if feather > 0:
		mask = GaussianBlurB1HW(mask, float(feather)).clamp(0.0, 1.0)

	if invert:
		mask = (1.0 - mask).clamp(0.0, 1.0)

	mask = ApplyOverlay(mask, mask_b1hw, params)

	return mask


@register_mode("Saliency")
def ModeSaliency(mask_b1hw, image_bchw, params):
	method   = params.get("Method", "Spectral Residual")
	strength = float(params.get("Sensitivity", 1.0))
	feather  = int(params.get("Softness / Feathering", 5))
	invert   = bool(params.get("Invert Selection", False))

	luma = LuminanceB1HW(image_bchw).detach().clone().contiguous()

	if method == "Spectral Residual":
		fft     = torch.fft.fft2(luma)
		log_amp = torch.log(torch.abs(fft) + 1e-8)
		phase   = torch.angle(fft)

		avg_log_amp = GaussianBlurB1HW(log_amp, 3)

		residual = log_amp - avg_log_amp

		saliency_fft = torch.exp(residual + 1j * phase)
		saliency     = torch.abs(torch.fft.ifft2(saliency_fft))

		mask = saliency
	elif method == "Fine-Grained":
		edges    = SobelEdgeMagnitudeB1HW(luma)
		blur     = GaussianBlurB1HW(luma, 5)
		contrast = (luma - blur).abs()
		mask     = (edges + contrast) * 0.5
	elif method == "Deep Saliency":
		# Placeholder: use Fine-Grained as fallback
		# (You can plug in a deep model later)
		edges    = SobelEdgeMagnitudeB1HW(luma)
		blur     = GaussianBlurB1HW(luma, 5)
		contrast = (luma - blur).abs()
		mask     = (edges + contrast) * 0.5
	else:
		mask = luma

	mask = mask - mask.min()

	if mask.max() > 0:
		mask = mask / mask.max()

	mask = (mask * strength).clamp(0.0, 1.0)

	if feather > 0:
		mask = GaussianBlurB1HW(mask, float(feather)).clamp(0.0, 1.0)

	if invert:
		mask = (1.0 - mask).clamp(0.0, 1.0)

	mask = ApplyOverlay(mask, mask_b1hw, params)

	return mask


@register_mode("Distance Transform")
def ModeDistanceTransform(mask_b1hw, image_bchw, params):
	source     = params.get("Source", "Mask")
	max_dist   = int(params.get("Max Distance", 50))
	curve      = params.get("Curve", "Linear")
	feather    = int(params.get("Softness / Feathering", 5))
	invert_out = bool(params.get("Invert Output", False))

	src    = mask_b1hw if source == "Mask" else (1.0 - mask_b1hw)
	binary = (src > 0.5).float()
	dist   = DistanceTransformChamfer(binary, max_dist)
	mask   = (dist / float(max_dist)).clamp(0.0, 1.0)

	if curve == "Quadratic":
		mask = mask * mask
	elif curve == "Exponential":
		mask = torch.exp(mask * 3.0) - 1.0
		mask = mask / mask.max().clamp(min=1e-6)

	if feather > 0:
		mask = GaussianBlurB1HW(mask, float(feather)).clamp(0.0, 1.0)

	if invert_out:
		mask = (1.0 - mask).clamp(0.0, 1.0)

	mask = ApplyOverlay(mask, mask_b1hw, params)

	return mask


@register_mode("Structure")
def ModeStructure(mask_b1hw, image_bchw, params):
	mode     = params.get("Mode", "Edges")
	strength = float(params.get("Sensitivity", 1.0))
	radius   = int(params.get("Detail Scale", 3))
	invert   = bool(params.get("Invert Selection", False))

	luma = LuminanceB1HW(image_bchw).detach().clone().contiguous()

	if mode == "Edges":
		if radius > 1:
			luma_blur = GaussianBlurB1HW(luma, float(radius))
		else:
			luma_blur = luma

		edges = SobelEdgeMagnitudeB1HW(luma_blur)
		mask  = edges
	elif mode == "Contours":
		if radius > 1:
			luma_blur = GaussianBlurB1HW(luma, float(radius))
		else:
			luma_blur = luma

		dil     = torch.nn.functional.max_pool2d(luma_blur, kernel_size=3, stride=1, padding=1)
		ero     = -torch.nn.functional.max_pool2d(-luma_blur, kernel_size=3, stride=1, padding=1)
		contour = (dil - ero).abs()

		mask = contour
	elif mode == "Hough Lines":
		if radius > 1:
			luma_blur = GaussianBlurB1HW(luma, float(radius))
		else:
			luma_blur = luma

		edges = SobelEdgeMagnitudeB1HW(luma_blur)

		directions = []
		for angle in [0, 30, 60, 90, 120, 150]:
			rad = angle * math.pi / 180.0
			c = math.cos(rad)
			s = math.sin(rad)

			kernel = torch.tensor([[c, 0.0, -c]], device = edges.device).view(1, 1, 1, 3)

			resp = torch.nn.functional.conv2d(edges, kernel, padding = (0, 1))
			directions.append(resp.abs())

		line_strength = torch.stack(directions, dim = 0).max(dim = 0).values
		mask          = line_strength

		line_strength = torch.stack(directions, dim = 0).max(dim = 0).values
		mask          = line_strength

	else:
		mask = luma

	mask = mask - mask.min()

	if mask.max() > 0:
		mask = mask / mask.max()

	mask = (mask * strength).clamp(0.0, 1.0)

	if radius > 0:
		mask = GaussianBlurB1HW(mask, float(radius)).clamp(0.0, 1.0)

	if invert:
		mask = (1.0 - mask).clamp(0.0, 1.0)

	mask = ApplyOverlay(mask, mask_b1hw, params)

	return mask


def NormalizeHexColor(value: Any) -> str | None:
	if not isinstance(value, str):
		return None

	color = value.strip()
	if not color:
		return None

	if color.startswith("0x") or color.startswith("0X"):
		color = color[2:]

	if not color.startswith("#"):
		color = "#" + color

	if len(color) == 4:
		color = "#" + "".join(ch * 2 for ch in color[1:])

	if len(color) != 7:
		return None

	try:
		int(color[1:], 16)
	except ValueError:
		return None

	return color.lower()


def ExtractTargetHexColors(target_hue: Any) -> list[str]:
	default_color = "#ffffff"

	if isinstance(target_hue, str):
		parsed = NormalizeHexColor(target_hue)
		return [parsed or default_color]

	if isinstance(target_hue, dict):
		colors = CollectColorsFromObject(target_hue)
		if colors:
			return colors

	if isinstance(target_hue, (list, tuple)):
		colors = [NormalizeHexColor(c) for c in target_hue]
		colors = [c for c in colors if c is not None]
		if colors:
			return colors

	return [default_color]


def CollectColorsFromObject(value: Any) -> list[str]:
	pairs: list[tuple[int, str]] = []
	visited_ids: set[int] = set()

	def Visit(obj: Any) -> None:
		obj_id = id(obj)
		if obj_id in visited_ids:
			return
		visited_ids.add(obj_id)

		if isinstance(obj, dict):
			for key, val in obj.items():
				if isinstance(key, str):
					match = re.search(r"(?:^|\.)(Color\s+(\d+))$", key)
					if match:
						color_idx = int(match.group(2))
						parsed = NormalizeHexColor(val)
						if parsed is not None:
							pairs.append((color_idx, parsed))
				Visit(val)
			return

		if isinstance(obj, (list, tuple)):
			for item in obj:
				Visit(item)

	Visit(value)

	if not pairs:
		return []

	pairs.sort(key = lambda x: x[0])
	return [color for _, color in pairs]


def DistanceTransformChamfer(binary_mask, max_dist):
	device = binary_mask.device
	INF = 1e9

	dist = torch.where(binary_mask == 0,
					   torch.zeros_like(binary_mask),
					   torch.full_like(binary_mask, INF))

	kernel = torch.tensor([[1., 1., 1.],
						   [1., 0., 1.],
						   [1., 1., 1.]], device=device).view(1, 1, 3, 3)

	for _ in range(max_dist):
		new_dist = torch.nn.functional.conv2d(dist, kernel, padding = 1)
		new_dist = torch.where(new_dist + 1 < dist, new_dist + 1, dist)
		if torch.allclose(new_dist, dist):
			break
		dist = new_dist

	dist = dist.clamp(0.0, float(max_dist))
	return dist


def RGBtoHSV(rgb):
	r, g, b = rgb[0], rgb[1], rgb[2]
	mx = torch.max(rgb)
	mn = torch.min(rgb)
	df = mx - mn

	if df == 0:
		h = 0.0
	elif mx == r:
		h = (60 * ((g - b) / df) + 360) % 360
	elif mx == g:
		h = (60 * ((b - r) / df) + 120) % 360
	else:
		h = (60 * ((r - g) / df) + 240) % 360

	s = 0.0 if mx == 0 else df / mx
	v = mx

	return torch.tensor([h / 360.0, s, v], dtype = torch.float32, device = rgb.device)


def RGBtoHSVImage(img_bchw):
	r = img_bchw[:, 0:1]
	g = img_bchw[:, 1:1+1]
	b = img_bchw[:, 2:2+1]

	mx = torch.max(img_bchw, dim = 1, keepdim = True).values
	mn = torch.min(img_bchw, dim = 1, keepdim = True).values
	df = mx - mn + 1e-6

	h = torch.zeros_like(mx)

	mask_r = (mx == r)
	mask_g = (mx == g)
	mask_b = (mx == b)

	h[mask_r] = (60 * ((g - b) / df) % 360)[mask_r]
	h[mask_g] = (60 * ((b - r) / df + 2) % 360)[mask_g]
	h[mask_b] = (60 * ((r - g) / df + 4) % 360)[mask_b]

	h = h / 360.0
	s = df / (mx + 1e-6)
	v = mx

	return torch.cat([h, s, v], dim = 1)


def AsB1HWMask(mask: torch.Tensor) -> torch.Tensor:
	if mask.dim() == 2:
		mask = mask.unsqueeze(0)

	if mask.dim() == 3:
		mask = mask.unsqueeze(1)

	if mask.dim() != 4:
		raise ValueError(f"Invalid mask shape: {tuple(mask.shape)}")
	
	return mask


def AsBHWMask(mask: torch.Tensor) -> torch.Tensor:
	mask_b1hw = AsB1HWMask(mask)

	return mask_b1hw[:, 0, :, :]


def AsBCHWImage(image: torch.Tensor) -> torch.Tensor:
	if image.dim() != 4:
		raise ValueError(f"Invalid image shape: {tuple(image.shape)}")
	
	if image.shape[-1] in (1, 3, 4):
		return image.permute(0, 3, 1, 2)
	
	return image


def AsBHWCImage(image_bchw: torch.Tensor) -> torch.Tensor:
	if image_bchw.dim() != 4:
		raise ValueError(f"Invalid image shape: {tuple(image_bchw.shape)}")
	
	return image_bchw.permute(0, 2, 3, 1)


def ResizeMaskToImage(mask_b1hw: torch.Tensor, image_bchw: torch.Tensor) -> torch.Tensor:
	if mask_b1hw.shape[-2:] == image_bchw.shape[-2:]:
		return mask_b1hw
	
	return F.interpolate(mask_b1hw, size = image_bchw.shape[-2:], mode = "bilinear", align_corners = False)


def CombineMasksMax(masks: list[torch.Tensor], image_bchw: torch.Tensor) -> torch.Tensor:
	if len(masks) == 0:
		raise ValueError("At least one mask input is required")
	
	combined: torch.Tensor | None = None

	for m in masks:
		m_b1hw   = AsB1HWMask(m)
		m_b1hw   = ResizeMaskToImage(m_b1hw, image_bchw).clamp(0.0, 1.0)
		combined = m_b1hw if combined is None else torch.max(combined, m_b1hw)

	return combined.clamp(0.0, 1.0)


def ExtractAutogrowMasks(masks_input) -> list[torch.Tensor]:
	if masks_input is None:
		return []
	
	if isinstance(masks_input, torch.Tensor):
		return [masks_input]
	
	if isinstance(masks_input, (list, tuple)):
		return [m for m in masks_input if m is not None]
	
	if isinstance(masks_input, dict):
		keys = list(masks_input.keys())

		try:
			keys_sorted = sorted(keys, key = lambda k: int(k) if str(k).isdigit() else str(k))
		except Exception:
			keys_sorted = sorted(keys, key = lambda k: str(k))
		return [masks_input[k] for k in keys_sorted if masks_input[k] is not None]
	
	return [masks_input]


def GrowMask(InvertMask: bool, mask_b1hw: torch.Tensor, grow_pixels: int) -> torch.Tensor:
	if grow_pixels == 0:
		return mask_b1hw
	
	if InvertMask:
		grow_pixels = -grow_pixels

	k   = abs(int(grow_pixels))
	ks  = 2 * k + 1
	pad = k

	if grow_pixels > 0:
		return F.max_pool2d(mask_b1hw, kernel_size = ks, stride = 1, padding = pad)
	
	return -F.max_pool2d(-mask_b1hw, kernel_size = ks, stride = 1, padding = pad)


def FillHoles(mask_b1hw: torch.Tensor) -> torch.Tensor:
	device     = mask_b1hw.device
	dtype      = mask_b1hw.dtype

	mask_np    = mask_b1hw.detach().cpu().numpy().copy()
	b, c, h, w = mask_np.shape
	filled     = mask_np.copy()

	for batch_idx in range(b):
		for ch_idx in range(c):
			binary_slice = (mask_np[batch_idx, ch_idx] > 0.5).astype(bool)
			filled_slice = ndimage.binary_fill_holes(binary_slice).astype(mask_np.dtype)
			filled[batch_idx, ch_idx] = filled_slice

	result = torch.from_numpy(filled).to(device=device, dtype=dtype)

	return result.clamp(0.0, 1.0)


def GaussianKernel1D(sigma: float, device: torch.device, dtype: torch.dtype) -> torch.Tensor:
	s = float(max(0.0, sigma))

	if s <= 0.0:
		return torch.tensor([1.0], device = device, dtype = dtype)
	
	radius = int(math.ceil(3.0 * s))
	x = torch.arange(-radius, radius + 1, device = device, dtype = dtype)
	k = torch.exp(-(x * x) / (2.0 * s * s))
	k = k / (k.sum() + 1e-12)

	return k


def GaussianBlurB1HW(mask_b1hw: torch.Tensor, sigma: float) -> torch.Tensor:
	s = float(sigma)

	if s <= 0.0:
		return mask_b1hw
	
	b, c, h, w = mask_b1hw.shape
	k1         = GaussianKernel1D(s, mask_b1hw.device, mask_b1hw.dtype)
	r          = (k1.numel() - 1) // 2

	if r <= 0:
		return mask_b1hw
	
	x      = k1.view(1, 1, 1, -1).repeat(c, 1, 1, 1)
	y      = k1.view(1, 1, -1, 1).repeat(c, 1, 1, 1)
	padded = F.pad(mask_b1hw, (r, r, r, r), mode = "reflect")
	out    = F.conv2d(padded, x, groups = c)
	out    = F.conv2d(out, y, groups = c)

	return out


def SmoothEdges(mask_b1hw: torch.Tensor, smooth: float) -> torch.Tensor:
	s = float(smooth)

	if s <= 0.0:
		return mask_b1hw
	
	binary  = (mask_b1hw > 0.5).to(mask_b1hw.dtype)
	blurred = GaussianBlurB1HW(binary, s)

	return (blurred > 0.5).to(mask_b1hw.dtype)


def Levels(mask_b1hw: torch.Tensor, black_level: float, white_level: float, gamma: float) -> torch.Tensor:
	bl = float(black_level)
	wl = float(white_level)
	g  = float(gamma)

	if g <= 0.0:
		g = 1.0

	offset = 1.0 - bl
	scale  = (wl + bl - 1.0)
	out    = (offset + mask_b1hw * scale).clamp(0.0, 1.0)

	if abs(g - 1.0) > 1e-6:
		out = out.pow(1.0 / g).clamp(0.0, 1.0)

	return out


def LuminanceB1HW(image_bchw: torch.Tensor) -> torch.Tensor:
	if image_bchw.shape[1] == 1:
		l = image_bchw
	else:
		r = image_bchw[:, 0:1]
		g = image_bchw[:, 1:2] if image_bchw.shape[1] > 1 else r
		b = image_bchw[:, 2:3] if image_bchw.shape[1] > 2 else r
		l = 0.2126 * r + 0.7152 * g + 0.0722 * b

	return l.clamp(0.0, 1.0)


def ApplyBrightnessContrastMultiplier(x: torch.Tensor, brightness: float, contrast: float, multiplier: float) -> torch.Tensor:
	b = float(brightness)
	c = float(contrast)
	m = float(multiplier)

	if c < 0.0:
		c = 0.0

	out = (x - 0.5) * c + 0.5
	out = out * b
	out = out * m

	return out.clamp(0.0, 1.0)


def SobelEdgeMagnitudeB1HW(luma_b1hw: torch.Tensor) -> torch.Tensor:
	if luma_b1hw.dim() != 4 or luma_b1hw.shape[1] != 1:
		raise ValueError(f"Invalid luma shape for Sobel: {tuple(luma_b1hw.shape)}")
	
	device = luma_b1hw.device
	dtype  = luma_b1hw.dtype
	kx     = torch.tensor([[-1.0, 0.0, 1.0], [-2.0, 0.0, 2.0], [-1.0, 0.0, 1.0]], device = device, dtype = dtype).view(1, 1, 3, 3)
	ky     = torch.tensor([[-1.0, -2.0, -1.0], [0.0, 0.0, 0.0], [1.0, 2.0, 1.0]], device = device, dtype = dtype).view(1, 1, 3, 3)
	padded = F.pad(luma_b1hw, (1, 1, 1, 1), mode = "reflect")
	gx     = F.conv2d(padded, kx)
	gy     = F.conv2d(padded, ky)
	mag    = torch.sqrt(gx * gx + gy * gy + 1e-12)
	den    = mag.amax(dim = (2, 3), keepdim = True).clamp(min = 1e-6)

	return (mag / den).clamp(0.0, 1.0)


def EdgeMagnitudeSharpB1HW(luma, edge_blur):
	k_size = int(round(edge_blur)) * 2 + 1
	pad    = k_size // 2
	max_v  = F.max_pool2d(luma, kernel_size = k_size, stride = 1, padding = pad)
	min_v  = -F.max_pool2d(-luma, kernel_size = k_size, stride = 1, padding = pad)
	edges  = max_v - min_v
	edges  = (edges / (edges.max() + 1e-6)).clamp(0, 1)

	return edges


def ImageWithAlphaFromMask(image_bchw: torch.Tensor, mask_b1hw: torch.Tensor, invert_alpha: bool, mask_opacity: float) -> torch.Tensor:
	mask  = mask_b1hw.clamp(0.0, mask_opacity)
	alpha = (1.0 - mask) if invert_alpha else mask
	alpha = alpha.clamp(0.0, 1.0)

	if image_bchw.shape[1] < 3:
		rgb = image_bchw.repeat(1, 3, 1, 1)
	else:
		rgb = image_bchw[:, 0:3].clone()

	return torch.cat([rgb, alpha], dim = 1).clamp(0.0, 1.0)


def SanitizeMask(m, image_bchw):
	if not isinstance(m, torch.Tensor):
		return m

	m = m.detach().cpu()
	m = torch.nan_to_num(m, nan = 0.0, posinf = 1.0, neginf = 0.0)

	if m.dtype not in (torch.float32, torch.float16, torch.bfloat16):
		m = m.float()

	return m.contiguous().to(image_bchw.device)

def ApplyNoiseMaskToLatent(latent, mask_b1hw):
	if not isinstance(latent, dict) or "samples" not in latent:
		return latent

	mask = torch.nan_to_num(mask_b1hw, nan = 0.0, posinf = 1.0, neginf = 0.0)
	mask = mask.float().contiguous()

	_, _, h, w = mask.shape
	mask       = mask.reshape(-1, 1, h, w)

	device = latent["samples"].device
	mask   = mask.to(device)

	out               = latent.copy()
	out["noise_mask"] = mask
	return out

def Process(
	Mask            : Any,
	Image           : Any,
	InvertMask      : bool,
	FillHolesToggle : bool,
	GrowMaskPixels  : int,
	BlurMaskPixels  : int,
	SmoothEdgesSigma: int,
	InvertAlpha     : bool,
	MaskOpacity     : float,
	Advanced        : Any,
	Latent          : Dict[str, Any]
) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
	with torch.no_grad():
		if isinstance(Image, torch.Tensor):
			Image = Image.detach().clone().contiguous()

		image_bchw = AsBCHWImage(Image)
		masks_list = ExtractAutogrowMasks(Mask)
		masks_list = [SanitizeMask(m, image_bchw) for m in masks_list]
		mask_b1hw  = CombineMasksMax(masks_list, image_bchw).detach().clone().contiguous()

		if bool(InvertMask):
			mask_b1hw = (1.0 - mask_b1hw).clamp(0.0, 1.0)

		mask_b1hw = GrowMask(bool(InvertMask), mask_b1hw, int(GrowMaskPixels or 0)).clamp(0.0, 1.0)
		mask_b1hw = mask_b1hw.detach().clone().contiguous()

		if bool(FillHolesToggle):
			mask_b1hw = FillHoles(mask_b1hw).detach().clone().contiguous()

		mask_b1hw = SmoothEdges(mask_b1hw, float(SmoothEdgesSigma or 0.0)).clamp(0.0, 1.0)
		mask_b1hw = mask_b1hw.detach().clone().contiguous()

		blur_px = int(BlurMaskPixels or 0)
		if blur_px > 0:
			mask_b1hw = GrowMask(bool(InvertMask), mask_b1hw, blur_px).clamp(0.0, 1.0)
			mask_b1hw = GaussianBlurB1HW(mask_b1hw, float(blur_px)).clamp(0.0, 1.0)
			mask_b1hw = mask_b1hw.detach().clone().contiguous()

		advanced_mode = None
		if isinstance(Advanced, dict):
			advanced_mode = Advanced.get("Advanced", None)
			if advanced_mode in ADVANCED_MODES:
				mask_b1hw = ADVANCED_MODES[advanced_mode](
					mask_b1hw,
					image_bchw,
					Advanced
				).detach().clone().contiguous()

		latent_out = ApplyNoiseMaskToLatent(Latent, mask_b1hw)

		preview_bchw = ImageWithAlphaFromMask(
			image_bchw,
			mask_b1hw,
			bool(InvertAlpha),
			float(MaskOpacity),
		)

		return latent_out, AsBHWMask(mask_b1hw), AsBHWCImage(preview_bchw)


# Presets management
FILENAME = "JohnsMaskEditorPresets.json"


def StoragePath() -> str:
	return os.path.join(folder_paths.get_user_directory(), FILENAME)


def LoadAll() -> dict:
	path = StoragePath()

	if not os.path.exists(path):
		return {"presets": {}}

	try:
		with open(path, "r", encoding="utf-8") as f:
			data = json.load(f)
	except Exception:
		return {"presets": {}}

	if not isinstance(data, dict):
		return {"presets": {}}

	presets = data.get("presets", {})

	if not isinstance(presets, dict):
		presets = {}

	return {"presets": presets}


def SaveAll(data: dict) -> None:
	path = StoragePath()
	os.makedirs(os.path.dirname(path), exist_ok = True)
	tmp = path + ".tmp"

	with open(tmp, "w", encoding="utf-8") as f:
		json.dump(data, f, ensure_ascii=False, indent = 2)

	os.replace(tmp, path)


def GetTitles() -> list[str]:
	data   = LoadAll()
	titles = [t for t in data["presets"].keys() if isinstance(t, str) and t.strip()]
	titles.sort(key = lambda x: x.lower())
	return titles


def GetPreset(title: str) -> dict | None:
	if not title:
		return None

	data    = LoadAll()
	lowered = title.lower()

	for k, v in data["presets"].items():
		if k.lower() == lowered and isinstance(v, dict):
			return v

	return None


def UpsertPreset(title: str, payload: dict) -> None:
	title = (title or "").strip()
	if not title:
		raise ValueError("Title is required.")

	if not isinstance(payload, dict):
		raise ValueError("Invalid preset payload.")

	data    = LoadAll()
	presets = data["presets"]

	lowered = title.lower()
	for k in list(presets.keys()):
		if k.lower() == lowered:
			presets.pop(k)
			break

	presets[title] = payload

	sorted_presets = dict(
		sorted(presets.items(), key = lambda x: x[0].lower())
	)

	SaveAll({"presets": sorted_presets})


def DeletePreset(title: str) -> None:
	title = (title or "").strip()
	if not title:
		return

	data    = LoadAll()
	presets = data["presets"]
	lowered = title.lower()

	for k in list(presets.keys()):
		if k.lower() == lowered:
			presets.pop(k)
			break

	SaveAll({"presets": presets})


@PromptServer.instance.routes.get("/JohnsMaskEditorPresets")
async def PresetTitles(request):
	return web.json_response({"titles": GetTitles()})


@PromptServer.instance.routes.get("/JohnsMaskEditorPreset")
async def PresetGet(request):
	title = request.query.get("title", "")
	item = GetPreset(title)

	if not item:
		return web.json_response({"error": "Not found"}, status=404)

	return web.json_response(item)


@PromptServer.instance.routes.post("/JohnsMaskEditorPreset")
async def PresetPost(request):
	try:
		body = await request.json()
	except Exception:
		body = {}

	title = body.get("title", "")
	payload = body.get("payload", {})

	try:
		UpsertPreset(title, payload)
		return web.json_response({"ok": True})
	except Exception as e:
		return web.json_response({"ok": False, "error": str(e)}, status=400)


@PromptServer.instance.routes.delete("/JohnsMaskEditorPreset")
async def PresetDelete(request):
	try:
		body = await request.json()
	except Exception:
		body = {}

	title = body.get("title", "")

	try:
		DeletePreset(title)
		return web.json_response({"ok": True})
	except Exception as e:
		return web.json_response({"ok": False, "error": str(e)}, status=400)
