
from __future__ import annotations
import sys
import datetime
import platform
from colorama import Fore, Style, init, AnsiToWin32


init(autoreset = True, convert = True, strip = False)


if platform.system() == "Windows":
	sys.stdout = AnsiToWin32(sys.stdout, convert=True).stream
	sys.stderr = AnsiToWin32(sys.stderr, convert=True).stream


class Console:
	COLORS = {
		"DEBUG"  : Fore.WHITE,
		"INFO"   : Fore.CYAN,
		"WARNING": Fore.YELLOW,
		"ERROR"  : Fore.RED,
		"SUCCESS": Fore.GREEN,
		"BLACK"  : Fore.BLACK,
		"RED"    : Fore.RED,
		"GREEN"  : Fore.GREEN,
		"YELLOW" : Fore.YELLOW,
		"BLUE"   : Fore.BLUE,
		"MAGENTA": Fore.MAGENTA,
		"CYAN"   : Fore.CYAN,
		"WHITE"  : Fore.WHITE,
		"BRIGHT" : Style.BRIGHT,
		"DIM"    : Style.DIM,
		"NORMAL" : Style.NORMAL,
		"RESET"  : Style.RESET_ALL
	}

	def __init__(self, name = None):
		self.name = name

	def Format(self, message, label, color, year, time, **kwargs):
		for color_name, color_code in self.COLORS.items():
			message = message.replace(f"{{{color_name}}}", color_code)
		
		if kwargs:
			message = message.format(**kwargs)
		
		parts = []

		if year:
			parts.append(datetime.datetime.now().strftime("%Y-%m-%d"))

		if time:
			parts.append(datetime.datetime.now().strftime("%H:%M:%S"))

		if self.name:
			parts.append(self.name)
			
		if label:
			parts.append(label)

		prefix = f"[{'|'.join(parts)}]" if parts else ""
		color  = self.COLORS.get(color, "")
		out    = f"{color}{prefix} {message}{Style.RESET_ALL}"
		stream = sys.stderr if label in ("ERROR",) else sys.stdout

		print(out, file = stream)

	def Log(self, message, label = None, color = None, year = False, time = True, **kwargs):
		self.Format(message, label, color, year, time, **kwargs)
