from __future__ import annotations


def Run(Input, Selection):
	if isinstance(Input, dict):
		Values = list(Input.values())
		
		return Values[Selection]
	
	return Input[Selection]
