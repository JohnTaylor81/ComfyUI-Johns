from __future__ import annotations


def SafeInt(value, default = 0):
	try:
		return int(value)
	except Exception:
		return default


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


def NormalizeAutoGrow(values):
	if values is None:
		return []

	if isinstance(values, list):
		return values

	if isinstance(values, tuple):
		return list(values)

	if isinstance(values, dict):
		keys = sorted(values.keys(), key = AutogrowSortKey)

		return [values[k] for k in keys]

	return [values]


def Run(Input, Selection):
	selection = SafeInt(Selection, default = 0)

	if isinstance(Input, dict):
		if selection in Input:
			return Input[selection]

		key = str(selection)

		if key in Input:
			return Input[key]

	values = NormalizeAutoGrow(Input)

	if not values:
		return None

	if selection < 0:
		selection = 0
	elif selection >= len(values):
		selection = len(values) - 1

	return values[selection]
