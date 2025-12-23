/**
 * Serializes an unknown error into a plain object, handling various data types,
 * circular references, and nested errors. It captures essential properties of Error objects
 * such as name, message, and stack trace. It also builds a `messageChain` string
 * that traces nested error messages for easier debugging.
 *
 * The returned object is safe for logging and transmission (e.g., for json serialization)
 * It avoids infinite recursion with circular references and limits the depth of serialization.
 *
 * @param {unknown} error - The error to serialize. Can be any value (Error, object, primitive).
 * @returns {any} A serialized representation of the error, including a `messageChain` if applicable.
 */
export function serializeError(error: unknown): any {
  return _serializeError(error, new WeakSet(), 0, true, []);
}

/**
 * Internal recursive function to serialize errors and nested structures.
 *
 * @param {any} error - The current value being serialized.
 * @param {WeakSet<any>} seen - A set of previously visited objects to detect circular references.
 * @param {number} depth - Current recursion depth.
 * @param {boolean} isRoot - Whether this is the root error being serialized.
 * @param {string[]} messageChain - Accumulates a formatted chain of nested error messages.
 * @returns {any} Serialized representation of the error or value.
 */
function _serializeError(error: any, seen: WeakSet<any>, depth: number, isRoot: boolean, messageChain: string[]): any {
  const MAX_DEPTH = 5;

  if (depth > MAX_DEPTH) {
    return "[Truncated: Max depth reached]";
  }

  if (error instanceof Date) {
    return error.toISOString();
  }

  if (typeof error === "symbol") {
    return `Symbol(${error.description || ""})`;
  }

  if (typeof error === "bigint") {
    return error.toString();
  }

  if (typeof error === "function") {
    return "[Function]";
  }

  if (typeof error === "object" && error !== null) {
    if (seen.has(error)) return "[Circular]";
    seen.add(error);

    if (error instanceof Error) {
      const serialized: any = {
        name: error.name,
        message: error.message,
        stack: truncateStack(error.stack, 10),
      };

      // Add current error to the message chain
      let indent = "";
      if (depth > 0) {
        indent = " ".repeat(depth) + "↳ ";
      }
      messageChain.push(`${indent}${serialized.name || "Error"}: ${serialized.message || ""}`);
      // Iterate own properties only
      for (const key of Object.getOwnPropertyNames(error)) {
        if (!(key in serialized)) {
          try {
            // @ts-ignore
            const val = error[key];
            if (typeof val !== "function" && val !== undefined) {
              serialized[key] = _serializeError(val, seen, depth + 1, false, messageChain);
            }
          } catch {
            serialized[key] = "[Unreadable property]";
          }
        }
      }
      if (isRoot) {
        serialized.messageChain = messageChain.join("\n");
      }

      return serialized;
    }

    // Generic object
    const serialized: any = {};
    for (const key of Object.keys(error)) {
      try {
        const val = error[key];
        if (typeof val !== "function" && val !== undefined) {
          serialized[key] = _serializeError(val, seen, depth + 1, false, messageChain);
        }
      } catch {
        serialized[key] = "[Unreadable property]";
      }
    }
    return serialized;
  }

  return error;
}

/**
 * Truncates a stack trace to a maximum number of lines.
 *
 * @param {string | undefined} stack - The original stack trace string.
 * @param {number} maxLines - Maximum number of lines to retain.
 * @returns {string | undefined} A truncated stack trace or the original if within limit.
 */
function truncateStack(stack: string | undefined, maxLines: number): string | undefined {
  if (!stack) return stack;

  const lines = stack.split("\n");
  if (lines.length <= maxLines) return stack;

  return [...lines.slice(0, maxLines), `... (${lines.length - maxLines} more lines)`].join("\n");
}
