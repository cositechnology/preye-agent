const rule = {
    meta: {
        type: "problem",
        docs: {
            description: "Enforce stable React Query keys (avoid inline objects/functions in key arrays)",
            recommended: false,
        },
        messages: {
            unstableKey: "Prefer stable query keys; avoid inline objects/functions in the key array.",
        },
        schema: [],
    },
    create(context) {
        function isReactQueryHookName(name) {
            return (name === "useQuery" ||
                name === "useInfiniteQuery" ||
                name === "useSuspenseQuery");
        }
        function checkCallExpression(node) {
            let calleeName;
            if (node.callee.type === "Identifier")
                calleeName = node.callee.name;
            if (node.callee.type === "MemberExpression" &&
                node.callee.property.type === "Identifier") {
                calleeName = node.callee.property.name;
            }
            if (!calleeName || !isReactQueryHookName(calleeName))
                return;
            const keyArg = node.arguments[0];
            if (!keyArg || keyArg.type !== "ArrayExpression")
                return;
            const hasInline = keyArg.elements.some((el) => {
                if (!el)
                    return false;
                // Literals and identifiers are considered stable here
                if (el.type === "Literal" || el.type === "Identifier")
                    return false;
                // TemplateLiteral without expressions is also stable
                if (el.type === "TemplateLiteral" && el.expressions.length === 0)
                    return false;
                return true;
            });
            if (hasInline) {
                context.report({ node: keyArg, messageId: "unstableKey" });
            }
        }
        return {
            CallExpression: checkCallExpression,
        };
    },
};
export default rule;
