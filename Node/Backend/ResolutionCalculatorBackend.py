from __future__ import annotations
from typing import Any, Tuple


def JohnsAspectRatios(): 
	return (
		"1:4 - Polyvision",
		"9:32 - Super Ultratall",
		"25:69 - Ultra Tallavision",
		"5:12 - Silver Ratio",
		"27:64 - Consumer Ultratall",
		"5:11 - Super Tallavision",
		"6:13 - Modern Smartphone",
		"1:2 - Univisium",
		"10:19 - Digital TALLMAX",
		"20:37 - American Tallcreen",
		"9:16 - Mid-Late 2010s Smartphone",
		"3:5 - Early 2010s Smartphone",
		"10:16 - Golden Ratio",
		"9:14 - Middle Ground",
		"2:3 - 35mm Film",
		"100:143 - IMAX TallFilm",
		"8:11 - Academy Ratio",
		"3:4 - Tallscreen TV",
		"4:5 - Classic Portrait",
		"16:19 - Fox Movietone",
		"1:1 - Square",
		"19:16 - Fox Movietone",
		"5:4 - Early Television",
		"4:3 - Fullscreen TV",
		"11:8 - Academy Ratio",
		"143:100 - IMAX Film",
		"3:2 - 35mm Film",
		"14:9 - Middle Ground",
		"16:10 - Golden Ratio",
		"5:3 - European Widescreen",
		"16:9 - HD Video",
		"37:20 - American Widescreen",
		"19:10 - Digital IMAX",
		"2:1 - Univisium",
		"13:6 - Modern Smartphone",
		"11:5 - Super Panavision",
		"64:27 - Consumer Ultrawide",
		"12:5 - Silver Ratio",
		"69:25 - Ultra Panavision",
		"32:9 - Super Ultrawide",
		"4:1 - Polyvision"
	)

def NearestDivisibleBy(value: int, n: int) -> int: 
	if n <= 0: 
		return int(value)
	
	if value <= 0:
		return 0
	
	return max(n, int(round(value / n)) * n)
	
def ParseAspectRatio(ratio: str) -> Tuple[int, int]: 
	part = ratio.split(" - ", 1)[0]
	a, b = part.split(":")

	return int(a), int(b)

def Compute(
	aspect_ratio        : str,
	width               : int,
	height              : int,
	multiplier          : float,
	nearest_divisible_by: int,
	image               : Any = None
) -> Tuple[int, int]: 
	ar_w, ar_h = ParseAspectRatio(aspect_ratio)

	if image is not None: 
		try: 
			h_img  = int(image.shape[1])
			w_img  = int(image.shape[2])
			width  = w_img
			height = h_img
		except Exception: 
			pass

	w = int(width)
	h = int(height)

	if w == 0 and h == 0:
		return (0, 0)

	if w == 0 and h > 0:
		w = int(round(h * (ar_w / ar_h)))
	elif h == 0 and w > 0:
		h = int(round(w * (ar_h / ar_w)))

	m = float(multiplier) if multiplier is not None else 1.0
	
	if m <= 0:
		m = 1.0

	w = int(round(w * m))
	h = int(round(h * m))

	n = int(nearest_divisible_by)
	if n > 0:
		w = NearestDivisibleBy(w, n)
		h = NearestDivisibleBy(h, n)

	return (int(w), int(h))
