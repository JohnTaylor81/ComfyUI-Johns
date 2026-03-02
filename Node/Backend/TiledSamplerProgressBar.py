from __future__ import annotations
import os
import sys
import time
import psutil                                   # type: ignore
import torch                                    # type: ignore
from   rich.panel        import Panel           # type: ignore
from   rich              import box             # type: ignore
from   rich.console      import Console         # type: ignore
from   rich.text         import Text            # type: ignore
from   rich.progress_bar import ProgressBar     # type: ignore
from   rich.progress     import Progress        # type: ignore
from   rich.progress     import ProgressColumn  # type: ignore
from   rich.table        import Table           # type: ignore
from   rich.segment      import Segment         # type: ignore


def OpenTTY():
	if os.name == "nt":
		try:
			return open("CONOUT$", "w")
		except OSError:
			pass
	else:
		try:
			return open("/dev/tty", "w")
		except OSError:
			pass
	return sys.stdout


tty               = OpenTTY()
RICH_CONSOLE      = Console(file = tty, force_terminal = True)
MAX_VISIBLE_TASKS = 25


def FormatDuration(seconds: float) -> str:
	if seconds <= 0:
		return "00.000s"
	
	total_ms           = int(round(seconds * 1000))
	hours,   remainder = divmod(total_ms, 3_600_000)
	minutes, remainder = divmod(remainder, 60_000)
	secs,    ms        = divmod(remainder, 1000)

	if hours > 0:
		return f"{hours:02d}:{minutes:02d}:{secs:02d}s"
	elif minutes > 0:
		return f"{minutes:02d}:{secs:02d}.{ms:03d}s"

	return f"{secs:02d}.{ms:03d}s"


def FormatTaskElapsed(seconds: float) -> str:
	return FormatDuration(seconds)


def GetProcessState(task):
	if task.completed == 0:
		return "init"
	
	return "finished" if task.finished else "running"


class LabelColumn(ProgressColumn):
	def render(self, task):
		styles = task.fields["styles"]
		state  = GetProcessState(task)

		return Text(task.description, style=styles["label"][state])


class ProgressBarColumn(ProgressColumn):
	def render(self, task):
		styles = task.fields["styles"]
		state  = GetProcessState(task)

		return ProgressBar(
			total          = task.total,
			completed      = task.completed,
			complete_style = styles["bar"][state],
			finished_style = styles["bar"][state]
		)


class CompletedColumn(ProgressColumn):
	def render(self, task):
		styles        = task.fields["styles"]
		state         = GetProcessState(task)
		width         = len(str(task.total))
		completed_str = f"{task.completed:0{width}d}"

		return Text(f"{completed_str}/{task.total}", style = styles["completed"][state])


class PercentageColumn(ProgressColumn):
	def render(self, task):
		styles = task.fields["styles"]
		state  = GetProcessState(task)
		pct    = (task.completed / task.total * 100) if task.total else 0

		return Text(f"{pct:03.0f}%", style = styles["percentage"][state])


class TaskTimeColumn(ProgressColumn):
	def render(self, task):
		styles  = task.fields["styles"]
		state   = GetProcessState(task)
		elapsed = float(task.fields.get("elapsed_task", 0.0))

		return Text(FormatTaskElapsed(elapsed), justify = "right", style = styles["task_time"][state])


class TiledProgress:
	def __init__(self):
		self.progress = Progress(
			LabelColumn(),
			ProgressBarColumn(),
			CompletedColumn(),
			PercentageColumn(),
			TaskTimeColumn(),
			expand = True
		)

		self.tasks           = {}
		self.step_times      = []
		self.last_step_time  = 0.0
		self._last_timestamp = time.perf_counter()
		self.process         = psutil.Process(os.getpid())

	def AddProgressBar(
		self,
		label,
		work,
		init_style,
		running_style,
		finished_style
	):
		if work <= 0:
			return

		styles = dict(
			label = dict(
				init     = init_style,
				running  = running_style,
				finished = finished_style
			),
			bar = dict(
				init     = init_style,
				running  = running_style,
				finished = finished_style
			),
			completed = dict(
				init     = init_style,
				running  = running_style,
				finished = finished_style
			),
			percentage = dict(
				init     = init_style,
				running  = running_style,
				finished = finished_style
			),
			task_time = dict(
				init     = init_style,
				running  = running_style,
				finished = finished_style
			)
		)

		task_id = self.progress.add_task(
			label,
			total        = work,
			styles       = styles,
			elapsed_task = 0.0,
			start        = True
		)

		self.tasks[label] = task_id


	def advance(self, label):
		now                  = time.perf_counter()
		self.last_step_time  = now - self._last_timestamp
		self._last_timestamp = now
		self.step_times.append(self.last_step_time)

		if label in self.tasks:
			task_id = self.tasks[label]
			self.progress.advance(task_id, 1)
			task    = self.progress.tasks[task_id]
			elapsed = float(task.fields.get("elapsed_task", 0.0)) + self.last_step_time
			self.progress.update(task_id, elapsed_task = elapsed)

	def GetMem(self):
		mem = self.process.memory_info().rss / (1024 ** 3)

		return f"{mem:.2f}GB"

	def GetGpuStats(self):
		if not torch.cuda.is_available():
			return "N/A", "N/A", "N/A"

		device    = torch.cuda.current_device()
		allocated = torch.cuda.memory_allocated(device) / (1024 ** 3)
		reserved  = torch.cuda.memory_reserved(device) / (1024 ** 3)
		util_str  = "?"

		try:
			util = torch.cuda.utilization(device)
			util_str = f"{util}%"
		except Exception:
			pass

		if util_str == "?":
			try:
				import subprocess
				output = subprocess.check_output(
					["nvidia-smi",
					"--query-gpu=utilization.gpu",
					"--format=csv,noheader,nounits"]
				)
				util = output.decode().strip()
				util_str = f"{util}%"
			except Exception:
				pass

		return f"{allocated:.2f}GB", f"{reserved:.2f}GB", util_str

	def BuildLayout(self, avg: float, etr: float, has_hidden_tasks: bool = False):
		cpu_mem    = self.GetMem()
		gpu_alloc, gpu_reserved, gpu_util = self.GetGpuStats()

		stats_row = Table.grid(expand = True)
		stats_row.add_column(ratio = 1, justify = "center")
		stats_row.add_column(ratio = 1, justify = "center")
		stats_row.add_column(ratio = 1, justify = "center")
		stats_row.add_column(ratio = 1, justify = "center")
		stats_row.add_column(ratio = 1, justify = "center")
		stats_row.add_column(ratio = 1, justify = "center")

		stats_row.add_row(
			Text("Last Step:",  style = "yellow")       + Text(FormatDuration(self.last_step_time), style = "white"),
			Text("Average:",    style = "blue")         + Text(FormatDuration(avg),                 style = "white"),
			Text("RAM:",        style = "bright_black") + Text(cpu_mem,                             style = "white"),
			Text("GPU Alloc:",  style = "green")        + Text(gpu_alloc,                           style = "white"),
			Text("GPU Reserv:", style = "cyan")         + Text(gpu_reserved,                        style = "white"),
			Text("GPU Util:",   style = "magenta")      + Text(gpu_util,                            style = "white")
		)

		stats_panel = Panel(
			stats_row,
			border_style = "bright_black",
			box          = box.SQUARE
		)

		layout = Table.grid(expand = True)
		layout.add_row(self.progress)
		layout.add_row(stats_panel)

		subtitle = f"Estimated Time Rremaining: {FormatDuration(etr)}"
		if has_hidden_tasks:
			subtitle += " | Some tasks are hidden, resize window to show more or less"

		return Panel(
			layout,
			title          = "John's Tiled Sampler",
			title_align    = "left",
			subtitle       = subtitle,
			subtitle_align = "right",
			border_style   = "red",
			box            = box.SQUARE
		)

	def SetVisibleWindow(self, non_overall_task_ids: list[int], start: int, count: int, overall_id):
		end = int(start) + int(count)

		if overall_id is not None:
			self.progress.update(overall_id, visible = True)

		for index, task_id in enumerate(non_overall_task_ids):
			self.progress.update(task_id, visible = bool(start <= index < end))

	def ProgressBarRenderHeight(self, renderable) -> int:
		options  = RICH_CONSOLE.options.update_width(RICH_CONSOLE.size.width)
		segments = RICH_CONSOLE.render(renderable, options = options)

		return sum(1 for _ in Segment.split_lines(segments))

	def GetRunningTaskIndex(self, non_overall_task_ids: list[int]) -> int:
		if len(non_overall_task_ids) <= 0:
			return 0

		for index, task_id in enumerate(non_overall_task_ids):
			task = self.progress.tasks[task_id]

			if task.completed > 0 and not task.finished:
				return index

		for index, task_id in enumerate(non_overall_task_ids):
			if not self.progress.tasks[task_id].finished:
				return index

		return len(non_overall_task_ids) - 1

	def ResolveVisibleTaskCapacity(self, non_overall_task_ids: list[int], overall_id, avg: float, etr: float) -> int:
		max_non_overall = len(non_overall_task_ids)

		if max_non_overall <= 0:
			return 0

		visible_count = max_non_overall

		while visible_count > 0:
			self.SetVisibleWindow(non_overall_task_ids, 0, visible_count, overall_id)
			renderable = self.BuildLayout(avg, etr)

			if self.ProgressBarRenderHeight(renderable) <= int(RICH_CONSOLE.size.height):
				return visible_count
			
			visible_count -= 1

		return 0

	def render(self):
		overall_id = self.tasks.get("Overall")

		if overall_id is not None:
			total_work = sum(
				t.total for t in self.progress.tasks

				if t.id != overall_id
			)

			total_done = sum(
				t.completed for t in self.progress.tasks

				if t.id != overall_id
			)

			total_elapsed = sum(
				float(t.fields.get("elapsed_task", 0.0)) for t in self.progress.tasks

				if t.id != overall_id
			)

			self.progress.update(
				overall_id,
				total        = total_work,
				completed    = total_done,
				elapsed_task = total_elapsed
			)

		avg         = sum(self.step_times) / len(self.step_times) if self.step_times else 0.0
		task_ids    = [t for t in self.tasks.values() if t != overall_id]
		total_work  = sum(self.progress.tasks[t].total for t in task_ids)
		total_done  = sum(self.progress.tasks[t].completed for t in task_ids)
		remaining   = max(0, total_work - total_done)
		etr         = remaining * avg if avg > 0 else 0.0
		total_tasks = len(task_ids) + (1 if overall_id is not None else 0)

		if total_tasks <= MAX_VISIBLE_TASKS:
			self.SetVisibleWindow(task_ids, 0, len(task_ids), overall_id)

			return self.BuildLayout(avg, etr, has_hidden_tasks = False)

		visible_non_overall = self.ResolveVisibleTaskCapacity(task_ids, overall_id, avg, etr)
		if visible_non_overall >= len(task_ids):
			self.SetVisibleWindow(task_ids, 0, len(task_ids), overall_id)

			return self.BuildLayout(avg, etr, has_hidden_tasks = False)

		running_index = self.GetRunningTaskIndex(task_ids)
		center_index  = max(0, (int(visible_non_overall) - 1) // 2)
		start         = max(0, int(running_index) - int(center_index))
		max_start     = max(0, len(task_ids) - int(visible_non_overall))
		start         = min(start, max_start)
		self.SetVisibleWindow(task_ids, start, visible_non_overall, overall_id)

		return self.BuildLayout(avg, etr, has_hidden_tasks = True)


def AddProgressBars(
	progress: TiledProgress,
	prefix: str,
	work_list: list[int],
	init_style: str,
	running_style: str,
	finished_style: str
) -> None:
	for i, work in enumerate(work_list):
		if work <= 0:
			continue

		progress.AddProgressBar(
			label          = f"{prefix} {i + 1}",
			work           = int(work),
			init_style     = init_style,
			running_style  = running_style,
			finished_style = finished_style
		)
