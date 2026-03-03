from __future__ import annotations
import ast
import math
import operator
import re
from typing import Any, Dict

# Control-flow exceptions
class BreakSignal(Exception):
	pass

class ContinueSignal(Exception):
	pass

class EvalTimeoutError(RuntimeError):
	pass

class MathExpression:
	# Binary operator mapping
	BinOps = {
		ast.Add     : operator.add,
		ast.Sub     : operator.sub,
		ast.Mult    : operator.mul,
		ast.Div     : operator.truediv,
		ast.FloorDiv: operator.floordiv,
		ast.Mod     : operator.mod,
		ast.Pow     : operator.pow
	}

	# Augmented assignment mapping (+=, -=, etc.)
	AugOps = {
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

	# Explicit function whitelist
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

	# Allowed AST node types (whitelist)
	ALLOWED_NODES = (
		ast.Module, ast.Expr, ast.Assign, ast.AugAssign, ast.Name, ast.Constant,
		ast.BinOp, ast.UnaryOp, ast.BoolOp, ast.Compare, ast.IfExp, ast.Call,
		ast.For, ast.While, ast.Break, ast.Continue, ast.List, ast.Tuple,
		ast.Add, ast.Sub, ast.Mult, ast.Div, ast.FloorDiv, ast.Mod, ast.Pow,
		ast.UAdd, ast.USub, ast.Not, ast.And, ast.Or,
		ast.Eq, ast.NotEq, ast.Lt, ast.LtE, ast.Gt, ast.GtE,
		ast.Load, ast.Store
	)

	# Execution safety caps
	MAX_FOR_ITER = 100000
	MAX_WHILE_ITER = 100000

	@classmethod
	def validate_ast(cls, node: ast.AST) -> None:
		"""Walk the AST and raise ValueError if any disallowed node type is present."""
		for child in ast.walk(node):
			if not isinstance(child, cls.ALLOWED_NODES):
				raise ValueError(f"Disallowed AST node: {type(child).__name__}")

	@classmethod
	def eval(cls, node: ast.AST, vars: Dict[str, Any]) -> Any:
		"""Evaluate an expression AST node using only allowed operations and names."""
		if isinstance(node, ast.Constant):
			return node.value

		if isinstance(node, ast.Name):
			if node.id in vars:
				return vars[node.id]
			raise NameError(f"Unknown variable or name: {node.id}")

		if isinstance(node, ast.BinOp):
			op_type = type(node.op)
			if op_type not in cls.BinOps:
				raise ValueError(f"Unsupported binary operator: {op_type.__name__}")
			left = cls.eval(node.left, vars)
			right = cls.eval(node.right, vars)
			return cls.BinOps[op_type](left, right)

		if isinstance(node, ast.UnaryOp):
			op_type = type(node.op)
			if op_type not in cls.UnaryOps:
				raise ValueError(f"Unsupported unary operator: {op_type.__name__}")
			return cls.UnaryOps[op_type](cls.eval(node.operand, vars))

		if isinstance(node, ast.BoolOp):
			op_type = type(node.op)
			if op_type is ast.And:
				for v in node.values:
					if not bool(cls.eval(v, vars)):
						return False
				return True
			if op_type is ast.Or:
				for v in node.values:
					if bool(cls.eval(v, vars)):
						return True
				return False
			# fallback (shouldn't reach)
			return cls.BoolOps[op_type](cls.eval(v, vars) for v in node.values)

		if isinstance(node, ast.Compare):
			# Proper chained comparison handling
			left_val = cls.eval(node.left, vars)
			for op, comp in zip(node.ops, node.comparators):
				right_val = cls.eval(comp, vars)
				op_type = type(op)
				if op_type not in cls.CmpOps:
					raise ValueError(f"Unsupported comparison operator: {op_type.__name__}")
				if not cls.CmpOps[op_type](left_val, right_val):
					return False
				left_val = right_val
			return True

		if isinstance(node, ast.IfExp):
			test_val = cls.eval(node.test, vars)
			return cls.eval(node.body if test_val else node.orelse, vars)

		if isinstance(node, ast.Call):
			# Only allow simple name calls and only functions in the whitelist
			if not isinstance(node.func, ast.Name):
				raise ValueError("Only simple function calls allowed")
			fname = node.func.id
			if fname not in cls.Functions:
				raise NameError(f"Unknown function: {fname}")
			fn = cls.Functions[fname]
			args = [cls.eval(a, vars) for a in node.args]
			return fn(*args)

		if isinstance(node, ast.List):
			return [cls.eval(elt, vars) for elt in node.elts]

		if isinstance(node, ast.Tuple):
			return tuple(cls.eval(elt, vars) for elt in node.elts)

		raise ValueError(f"Unsupported expression node: {type(node).__name__}")

	@classmethod
	def exec_stmt(cls, node: ast.AST, vars: Dict[str, Any]) -> Any:
		"""Execute a statement AST node (assignment, loops, if, etc.)."""
		# Assignment: simple name targets only
		if isinstance(node, ast.Assign):
			value = cls.eval(node.value, vars)
			for target in node.targets:
				if not isinstance(target, ast.Name):
					raise ValueError("Only simple variable assignments allowed")
				vars[target.id] = value
			return value

		# Augmented assignment (e.g., x += 1)
		if isinstance(node, ast.AugAssign):
			if not isinstance(node.target, ast.Name):
				raise ValueError("AugAssign target must be a simple name")
			target_name = node.target.id
			if target_name not in vars:
				raise NameError(f"Unknown variable in augmented assignment: {target_name}")
			op_type = type(node.op)
			if op_type not in cls.AugOps:
				raise ValueError(f"Unsupported augmented operator: {op_type.__name__}")
			new_val = cls.AugOps[op_type](vars[target_name], cls.eval(node.value, vars))
			vars[target_name] = new_val
			return new_val

		# Standalone expression
		if isinstance(node, ast.Expr):
			return cls.eval(node.value, vars)

		# If / elif / else
		if isinstance(node, ast.If):
			cond = cls.eval(node.test, vars)
			block = node.body if cond else node.orelse
			result = None
			for stmt in block:
				result = cls.exec_stmt(stmt, vars)
			return result

		# For loop (only simple name target)
		if isinstance(node, ast.For):
			if not isinstance(node.target, ast.Name):
				raise ValueError("Loop variable must be a simple name")
			iterable = cls.eval(node.iter, vars)
			if not hasattr(iterable, "__iter__"):
				raise ValueError("For loop iterable is not iterable")
			result = None
			count = 0
			for value in iterable:
				vars[node.target.id] = value
				try:
					for stmt in node.body:
						cls.exec_stmt(stmt, vars)
				except BreakSignal:
					break
				except ContinueSignal:
					continue
				count += 1
				if count > cls.MAX_FOR_ITER:
					raise EvalTimeoutError("For loop exceeded maximum iterations")
			return result

		# While loop
		if isinstance(node, ast.While):
			result = None
			count = 0
			while cls.eval(node.test, vars):
				try:
					for stmt in node.body:
						cls.exec_stmt(stmt, vars)
				except BreakSignal:
					break
				except ContinueSignal:
					continue
				count += 1
				if count > cls.MAX_WHILE_ITER:
					raise EvalTimeoutError("While loop exceeded maximum iterations")
			return result

		# break / continue
		if isinstance(node, ast.Break):
			raise BreakSignal()
		if isinstance(node, ast.Continue):
			raise ContinueSignal()

		raise ValueError(f"Unsupported statement type: {type(node).__name__}")

	# --- Type conversion helpers moved into backend ---
	@staticmethod
	def _to_int(v: Any, round_int: bool) -> Any:
		if v is None:
			return None
		if isinstance(v, bool):
			return int(v)
		try:
			fv = float(v)
		except Exception:
			return None
		return int(round(fv)) if round_int else int(fv)

	@staticmethod
	def _to_float(v: Any, precision: int) -> Any:
		if v is None:
			return None
		try:
			fv = float(v)
		except Exception:
			return None
		try:
			return round(fv, precision)
		except Exception:
			return fv

	@staticmethod
	def _to_bool(v: Any) -> Any:
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

	@classmethod
	def Evaluate(cls, Inputs, Expression, FloatPrecision: int = 3, RoundInt: bool = False) -> Dict[str, Any]:
		"""
		Evaluate the provided Expression using Inputs and return a dict containing:
		- Int_1..Int_12 (ints or None)
		- Float_1..Float_12 (floats or None)
		- Bool_1..Bool_12 (bools or None)

		This method is strict and raises RuntimeError with clear messages on failure.
		"""
		# Guard Inputs being None
		Inputs = Inputs or {}
		# Convert inputs to numeric where possible; keep non-numeric as-is
		vars: Dict[str, Any] = {}
		for k, v in Inputs.items():
			if v is None:
				continue
			# Preserve booleans as booleans; convert other numeric-like to float
			if isinstance(v, bool):
				vars[k] = v
			else:
				try:
					vars[k] = float(v)
				except Exception:
					vars[k] = v

		vars["ROUND_INT"] = bool(RoundInt)

		annotation_pattern = re.compile(r'(\bout_(\d+))\s*\(\s*([^)]*?)\s*\)', flags = re.IGNORECASE)
		while True:
			new_expr, n = annotation_pattern.subn(r'\1', Expression)
			if n == 0:
				break
			Expression = new_expr

		# Parse and validate AST
		try:
			tree = ast.parse(Expression, mode="exec")
		except SyntaxError as e:
			raise RuntimeError(f"Syntax error in expression: {e}")

		try:
			cls.validate_ast(tree)
		except ValueError as e:
			raise RuntimeError(f"Disallowed syntax in expression: {e}")

		last_expr_value = None

		# Execute statements with structured error handling
		try:
			for node in tree.body:
				if isinstance(node, ast.Expr):
					last_expr_value = cls.eval(node.value, vars)
				else:
					cls.exec_stmt(node, vars)
		except EvalTimeoutError as e:
			raise RuntimeError(f"Evaluation aborted: {e}")
		except Exception as e:
			# Re-raise with clearer context
			raise RuntimeError(f"Expression evaluation error: {e}")

		# Collect explicit out_n variables if present
		explicit_outputs = {
			k: v for k, v in vars.items()
			if isinstance(k, str) and k.startswith("out_")
		}

		MAX = 12
		# Build raw outputs (raw user values)
		raw_outs = {}
		for i in range(1, MAX + 1):
			key = f"out_{i}"
			if key in explicit_outputs:
				raw_outs[key] = explicit_outputs[key]
			else:
				raw_outs[key] = None

		if explicit_outputs:
			# Use explicit outputs as provided
			pass
		elif last_expr_value is not None:
			raw_outs["out_1"] = last_expr_value

		# Convert raw_outs into typed outputs matching frontend node outputs
		result: Dict[str, Any] = {}
		for i in range(1, MAX + 1):
			raw = raw_outs.get(f"out_{i}", None)
			result[f"Int_{i}"]   = cls._to_int(raw, RoundInt)
			result[f"Float_{i}"] = cls._to_float(raw, FloatPrecision)
			result[f"Bool_{i}"]  = cls._to_bool(raw)

		return result