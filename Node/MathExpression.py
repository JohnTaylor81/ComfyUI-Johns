from __future__ import annotations
from comfy_api.latest import io  # type: ignore
from .Backend.MathExpressionBackend import MathExpression


class JohnsMathExpression(io.ComfyNode):
	@classmethod
	def define_schema(cls):
		InputsTemplate = io.Autogrow.TemplatePrefix(
			io.MultiType.Input("Inputs", optional = True, types = [io.Int, io.Float, io.Boolean]), prefix = "N", min = 1, max = 50)

		return io.Schema(
			node_id      = "JohnsMathExpression",
			display_name = "Math Expression",
			category     = "John's/Utilities",
			description  = "Johns Math Expression (AST Evaluator)\n" \
							"Logic: Arithmetic, FloorDiv (//), Modulo (%), Power (**)\n" \
							"Comparisons: Chainable (e.g. 10 < N0 <= 100), ==, !=, <, >, etc.\n" \
							"Boolean Logic: and, or, not / Ternary: A if condition else B\n" \
							"Functions: min, max, abs, floor, ceil, round, sqrt, sin, cos, tan, log, exp\n" \
							"Helpers: RoundUp(x), RoundDown(x) / Iterators: range()\n" \
							"Pythonic Conditionals: Value IF condition ELSE alternative.\n" \
							"Dynamic UI: Define out_1 to out_12 to show/hide output sockets\n" \
							"Examples:\n" \
							"1. Megapixel Scaling (Target N2 MP):\n" \
							"   s = sqrt((N2 * 1e6) / (N0 * N1))\n" \
							"   out_1 = round(N0 * s / 64) * 64\n" \
							"   out_2 = round(N1 * s / 64) * 64\n" \
							"2. Safe Divide: N0 / N1 if N1 != 0 else 0\n"
							"3. Variables and loops:\n" \
							"   sum = 0\n" \
							"   for i in range(5):\n" \
							"       sum += i\n" \
							"   out_1 = sum\n",
			search_aliases = ["math", "add", "subtract", "multiply", "divide", "floor", "mod", "pow", "min", "max", "abs", "ceil", "round", "square", "sqrt", "sin", "cosin", "tan", "log", "exp"],
			inputs         = [
				io.Autogrow.Input("Inputs",         template     = InputsTemplate),
				io.String.Input  ("Expression",     display_name = "Expression",      default  = "N0 + N1", multiline = True),
				io.Int.Input     ("FloatPrecision", display_name = "Float Precision", default  = 3, min = 1, max = 6, step = 1),
				io.Boolean.Input ("RoundInt",       display_name = "Round Int",       default  = False, label_off = "Up", label_on = "Down")
			],
			outputs = [
				io.Int.Output("Int_1",  display_name = "Int 1"),
				io.Int.Output("Int_2",  display_name = "Int 2"),
				io.Int.Output("Int_3",  display_name = "Int 3"),
				io.Int.Output("Int_4",  display_name = "Int 4"),
				io.Int.Output("Int_5",  display_name = "Int 5"),
				io.Int.Output("Int_6",  display_name = "Int 6"),
				io.Int.Output("Int_7",  display_name = "Int 7"),
				io.Int.Output("Int_8",  display_name = "Int 8"),
				io.Int.Output("Int_9",  display_name = "Int 9"),
				io.Int.Output("Int_10", display_name = "Int 10"),
				io.Int.Output("Int_11", display_name = "Int 11"),
				io.Int.Output("Int_12", display_name = "Int 12"),
				io.Float.Output("Float_1",  display_name = "Float 1"),
				io.Float.Output("Float_2",  display_name = "Float 2"),
				io.Float.Output("Float_3",  display_name = "Float 3"),
				io.Float.Output("Float_4",  display_name = "Float 4"),
				io.Float.Output("Float_5",  display_name = "Float 5"),
				io.Float.Output("Float_6",  display_name = "Float 6"),
				io.Float.Output("Float_7",  display_name = "Float 7"),
				io.Float.Output("Float_8",  display_name = "Float 8"),
				io.Float.Output("Float_9",  display_name = "Float 9"),
				io.Float.Output("Float_10", display_name = "Float 10"),
				io.Float.Output("Float_11", display_name = "Float 11"),
				io.Float.Output("Float_12", display_name = "Float 12"),
				io.Boolean.Output("Bool_1",  display_name = "Bool 1"),
				io.Boolean.Output("Bool_2",  display_name = "Bool 2"),
				io.Boolean.Output("Bool_3",  display_name = "Bool 3"),
				io.Boolean.Output("Bool_4",  display_name = "Bool 4"),
				io.Boolean.Output("Bool_5",  display_name = "Bool 5"),
				io.Boolean.Output("Bool_6",  display_name = "Bool 6"),
				io.Boolean.Output("Bool_7",  display_name = "Bool 7"),
				io.Boolean.Output("Bool_8",  display_name = "Bool 8"),
				io.Boolean.Output("Bool_9",  display_name = "Bool 9"),
				io.Boolean.Output("Bool_10", display_name = "Bool 10"),
				io.Boolean.Output("Bool_11", display_name = "Bool 11"),
				io.Boolean.Output("Bool_12", display_name = "Bool 12")
			]
		)

	@classmethod
	def execute(cls, Inputs = None, Expression: str = "N0 + N1", FloatPrecision: int = 3, RoundInt: bool = False) -> io.NodeOutput:
		results = MathExpression.Evaluate(Inputs = Inputs, Expression = Expression, RoundInt = RoundInt)

		def ToInt(v):
			if v is None:
				return None
			
			if isinstance(v, bool):
				return int(v)
			
			try:
				fv = float(v)
			except Exception:
				return None
			
			return int(round(fv)) if RoundInt else int(fv)

		def ToFloat(v):
			if v is None:
				return None
			
			try:
				fv = float(v)
			except Exception:
				return None
			try:
				return round(fv, FloatPrecision)
			except Exception:
				return fv

		def ToBool(v):
			if v is None:
				return None
			
			if isinstance(v, bool):
				return v
			
			if isinstance(v, (int, float)):
				return bool(v)
			
			s = str(v).strip().lower()

			if s in ("true", "1", "yes", "y", "on"):
				return True
			
			if s in ("false", "0", "no", "n", "off", ""):
				return False
			
			return bool(s)

		MAX    = 12
		ints   = []
		floats = []
		bools  = []

		for i in range(1, MAX + 1):
			v = results.get(f"out_{i}", None)
			ints.append(ToInt(v))

		for i in range(1, MAX + 1):
			v = results.get(f"out_{i}", None)
			floats.append(ToFloat(v))

		for i in range(1, MAX + 1):
			v = results.get(f"out_{i}", None)
			bools.append(ToBool(v))

		return io.NodeOutput(*ints, *floats, *bools)
	