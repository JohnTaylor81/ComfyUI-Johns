
from __future__ import annotations
import ctypes
import datetime
import platform
import sys


class Fore:
	BLACK   = "\033[30m"
	RED     = "\033[31m"
	GREEN   = "\033[32m"
	YELLOW  = "\033[33m"
	BLUE    = "\033[34m"
	MAGENTA = "\033[35m"
	CYAN    = "\033[36m"
	WHITE   = "\033[37m"


class Style:
	BRIGHT    = "\033[1m"
	DIM       = "\033[2m"
	NORMAL    = "\033[22m"
	RESET_ALL = "\033[0m"


def EnableWindowsANSI():
	if platform.system() != "Windows":
		return

	kernel32 = ctypes.windll.kernel32
	enable_virtual_terminal_processing = 0x0004

	for handle_id in (-11, -12):
		handle = kernel32.GetStdHandle(handle_id)

		if handle in (0, -1):
			continue

		mode = ctypes.c_uint32()

		if not kernel32.GetConsoleMode(handle, ctypes.byref(mode)):
			continue

		kernel32.SetConsoleMode(handle, mode.value | enable_virtual_terminal_processing)


EnableWindowsANSI()


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
