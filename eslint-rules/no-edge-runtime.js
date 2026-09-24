/** docs/12 §9.3: the app must stay portable to a Node container; the Edge runtime is forbidden. */
export default {
  meta: {
    type: "problem",
    docs: { description: "disallow `export const runtime = 'edge'` (portability, docs/12 §9.3)" },
    schema: [],
    messages: { edge: "Edge runtime is forbidden; the app must run in Node (docs/12 §9.3)." },
  },
  create(context) {
    return {
      ExportNamedDeclaration(node) {
        const d = node.declaration;
        if (!d || d.type !== "VariableDeclaration") return;
        for (const decl of d.declarations) {
          if (
            decl.id.type === "Identifier" &&
            decl.id.name === "runtime" &&
            decl.init &&
            decl.init.type === "Literal" &&
            decl.init.value === "edge"
          ) {
            context.report({ node: decl, messageId: "edge" });
          }
        }
      },
    };
  },
};
