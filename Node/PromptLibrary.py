from __future__ import annotations
from comfy_api.latest import io  # type: ignore
from .Backend import PromptLibraryBackend
import re
import random


def ExpandWildcards(text: str) -> str:
	def replace(match):
		options = match.group(1).split("|")
		return random.choice(options).strip()
	
	return re.compile(r"\{([^{}]+)\}").sub(replace, text)


class JohnsPromptLibrary(io.ComfyNode): 
	@classmethod
	def define_schema(cls) -> io.Schema: 
		return io.Schema(
			node_id        = "JohnsPromptLibrary",
			display_name   = "John's Prompt Library",
			category       = "John's",
			description    = "Save and Load Prompt Presets",
			search_aliases = ["prompt", "positive", "negative", "text", "string", "save", "load", "preset"],
			inputs         = [
				io.Clip.Input  ("Clip",     optional = True,                  display_name = "Clip"),
				io.String.Input("category", default  = "", multiline = False, display_name = "Category"),
				io.String.Input("title",    default  = "", multiline = False, display_name = "Title"),
				io.String.Input("prompt",   default  = "", multiline = True,  placeholder  = "Prompt..."),
				io.String.Input("negative", default  = "", multiline = True,  placeholder  = "Negative...")
			],
			outputs = [
				io.Conditioning.Output("Prompt Conditioning"),
				io.Conditioning.Output("Negative Conditioning"),
				io.String.Output("Prompt Text"),
				io.String.Output("Negative Text")
			]
		)

	@classmethod
	def fingerprint_inputs(cls, category, title, prompt, negative, Clip = None):
		has_wildcard = ("{" in prompt and "}" in prompt) or ("{" in negative and "}" in negative)

		if has_wildcard:
			import time
			return time.time()

		return (category, title, prompt, negative, Clip)

	@classmethod
	def execute(cls, category, title, prompt, negative, Clip = None) -> io.NodeOutput:
		if Clip is None:
			positive_tokens = None
			negative_tokens = None
		else:
			positive_tokens = Clip.encode_from_tokens_scheduled(Clip.tokenize(ExpandWildcards(prompt)))
			negative_tokens = Clip.encode_from_tokens_scheduled(Clip.tokenize(ExpandWildcards(negative)))

		return (positive_tokens, negative_tokens, prompt, negative)
