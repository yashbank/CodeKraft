/**
 * NFR-DATA-03: money is integer minor units. In finance-class modules forbid float-producing
 * operations: parseFloat, Number(...) on non-literals, .toFixed(), Math.round/floor/ceil/trunc,
 * numeric literals with a fractional part, and the `/` operator (use lib/money helpers).
 */
const FORBIDDEN_MATH = new Set(["round", "floor", "ceil", "trunc", "fround"]);

export default {
  meta: {
    type: "problem",
    docs: { description: "disallow float arithmetic in money-handling modules (NFR-DATA-03)" },
    schema: [],
    messages: {
      parseFloat: "parseFloat is forbidden in money modules; money is integer minor units.",
      numberCall: "Number(...) coercion is forbidden in money modules; parse with Zod int schemas.",
      toFixed: ".toFixed() is forbidden in money modules; use lib/money.format.",
      math: "Math.{{name}} is forbidden in money modules; use lib/money (largest-remainder, bigint).",
      fractional: "Fractional numeric literal {{raw}} is forbidden in money modules.",
      division:
        "The / operator is forbidden in money modules; use lib/money.mulBps or allocate helpers.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const c = node.callee;
        if (c.type === "Identifier" && c.name === "parseFloat") {
          context.report({ node, messageId: "parseFloat" });
        }
        if (c.type === "Identifier" && c.name === "Number") {
          context.report({ node, messageId: "numberCall" });
        }
        if (c.type === "MemberExpression" && c.property.type === "Identifier") {
          if (c.property.name === "toFixed") context.report({ node, messageId: "toFixed" });
          if (
            c.object.type === "Identifier" &&
            c.object.name === "Math" &&
            FORBIDDEN_MATH.has(c.property.name)
          ) {
            context.report({ node, messageId: "math", data: { name: c.property.name } });
          }
        }
      },
      Literal(node) {
        if (typeof node.value === "number" && /\./.test(String(node.raw ?? ""))) {
          context.report({ node, messageId: "fractional", data: { raw: String(node.raw) } });
        }
      },
      BinaryExpression(node) {
        if (node.operator === "/") context.report({ node, messageId: "division" });
      },
    };
  },
};
