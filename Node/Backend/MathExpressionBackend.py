from __future__ import annotations
import ast
import math
import operator


class BreakSignal(Exception):
	pass


class ContinueSignal(Exception):
	pass


class MathExpression:
	BinOps = {
		ast.Add     : operator.add,
		ast.Sub     : operator.sub,
		ast.Mult    : operator.mul,
		ast.Div     : operator.truediv,
		ast.FloorDiv: operator.floordiv,
		ast.Mod     : operator.mod,
		ast.Pow     : operator.pow
	}

	UnaryOps = {
		ast.UAdd: operator.pos,
		ast.USub: operator.neg,
		ast.Not : operator.not_
	}

	BoolOps = {
		ast.And: all,
		ast.Or : any
	}

	CmpOps = {
		ast.Eq   : operator.eq,
		ast.NotEq: operator.ne,
		ast.Lt   : operator.lt,
		ast.LtE  : operator.le,
		ast.Gt   : operator.gt,
		ast.GtE  : operator.ge
	}

	@staticmethod
	def RoundUp(v): return math.ceil(v)


	@staticmethod
	def RoundDown(v): return math.floor(v)


	Functions = {
		"min"      : min,
		"max"      : max,
		"abs"      : abs,
		"floor"    : math.floor,
		"ceil"     : math.ceil,
		"round"    : round,
		"sqrt"     : math.sqrt,
		"sin"      : math.sin,
		"cos"      : math.cos,
		"tan"      : math.tan,
		"log"      : math.log,
		"exp"      : math.exp,
		"RoundUp"  : RoundUp.__func__,
		"RoundDown": RoundDown.__func__,
		"range"    : range,
	}


	@classmethod
	def eval(cls, node, vars):
		if isinstance(node, ast.Constant):
			return node.value

		if isinstance(node, ast.Name):
			return vars[node.id]

		if isinstance(node, ast.BinOp):
			return cls.BinOps[type(node.op)](
				cls.eval(node.left, vars),
				cls.eval(node.right, vars),
			)

		if isinstance(node, ast.UnaryOp):
			return cls.UnaryOps[type(node.op)](
				cls.eval(node.operand, vars)
			)

		if isinstance(node, ast.BoolOp):
			return cls.BoolOps[type(node.op)](
				cls.eval(v, vars) for v in node.values
			)

		if isinstance(node, ast.Compare):
			left = cls.eval(node.left, vars)
			for op, right in zip(node.ops, node.comparators):
				if not cls.CmpOps[type(op)](left, cls.eval(right, vars)):
					return False
			return True

		if isinstance(node, ast.IfExp):
			return cls.eval(node.body if cls.eval(node.test, vars) else node.orelse, vars)

		if isinstance(node, ast.Call):
			fn = cls.Functions[node.func.id]
			return fn(*[cls.eval(a, vars) for a in node.args])

		raise ValueError(f"Unsupported expression: {type(node).__name__}")


	@classmethod
	def exec_stmt(cls, node, vars):
		# Assignment
		if isinstance(node, ast.Assign):
			value = cls.eval(node.value, vars)
			for target in node.targets:
				if not isinstance(target, ast.Name):
					raise ValueError("Only simple variable assignments allowed")
				vars[target.id] = value
			return value

		# Standalone expression
		if isinstance(node, ast.Expr):
			return cls.eval(node.value, vars)

		# If / elif / else
		if isinstance(node, ast.If):
			cond   = cls.eval(node.test, vars)
			block  = node.body if cond else node.orelse
			result = None
			for stmt in block:
				result = cls.exec_stmt(stmt, vars)
			return result

		# For loop
		if isinstance(node, ast.For):
			if not isinstance(node.target, ast.Name):
				raise ValueError("Loop variable must be a simple name")

			iterable = cls.eval(node.iter, vars)
			result   = None

			for value in iterable:
				vars[node.target.id] = value
				try:
					for stmt in node.body:
						cls.exec_stmt(stmt, vars)
				except BreakSignal:
					break
				except ContinueSignal:
					continue

			return result

		# While loop
		if isinstance(node, ast.While):
			result = None
			while cls.eval(node.test, vars):
				try:
					for stmt in node.body:
						cls.exec_stmt(stmt, vars)
				except BreakSignal:
					break
				except ContinueSignal:
					continue
			return result

		# break
		if isinstance(node, ast.Break):
			raise BreakSignal()

		# continue
		if isinstance(node, ast.Continue):
			raise ContinueSignal()

		raise ValueError(f"Unsupported statement type: {type(node).__name__}")


	@classmethod
	def Evaluate(cls, Inputs, Expression, RoundInt):
		vars = {k: float(v) for k, v in Inputs.items() if v is not None}
		vars["ROUND_INT"] = RoundInt

		tree = ast.parse(Expression, mode="exec")

		last_expr_value = None

		for node in tree.body:
			if isinstance(node, ast.Expr):
				last_expr_value = cls.eval(node.value, vars)
			else:
				cls.exec_stmt(node, vars)

		explicit_outputs = {
			k: v for k, v in vars.items()
			if isinstance(k, str) and k.startswith("out_")
		}

		MAX  = 12
		full = {}
		for i in range(1, MAX + 1):
			key = f"out_{i}"

			if key in explicit_outputs:
				full[key] = explicit_outputs[key]
			else:
				full[key] = None

		if explicit_outputs:
			return full

		if last_expr_value is not None:
			full["out_1"] = last_expr_value
			return full

		return full
