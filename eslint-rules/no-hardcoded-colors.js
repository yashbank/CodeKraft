/** docs/10 §7 / MASTER_SPEC §4.6: components consume design tokens only; no colour literals. */
const COLOR_RE = /(#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab)\()/;

function check(context, node, text) {
  if (COLOR_RE.test(text)) {
    context.report({ node, messageId: "color", data: { text: text.slice(0, 40) } });
  }
}

export default {
  meta: {
    type: "problem",
    docs: { description: "disallow hardcoded colour literals in components (tokens only)" },
    schema: [],
    messages: {
      color:
        "Hardcoded colour '{{text}}' in a component; use a design token (var(--ck-*) / Tailwind token class).",
    },
  },
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value === "string") check(context, node, node.value);
      },
      TemplateElement(node) {
        check(context, node, node.value.raw);
      },
    };
  },
};
