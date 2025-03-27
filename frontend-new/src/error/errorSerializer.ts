/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
export function serializeError(error: any): any {
  if (error instanceof Error) {
    const serialized: any = {
      name: error.name,
      message: error.message,
      stack: truncateStack(error.stack, 10), // limit stack lines
      class: error.name === "Error" ? error.constructor.name : error.name,
    };

    // Recursively serialize cause
    if (error.cause) {
      serialized.cause = serializeError(error.cause);
    }

    // Recursively serialize details from RestAPIError, FirebaseError etc.
    if (error.details) {
      serialized.details = serializeError(error.details);
    }
    // Include any other non-function properties
    for (const key in error) {
      if (!(key in serialized) && typeof error[key] !== "function") {
        serialized[key] = error[key];
      }
    }

    return serialized;
  }

  return { message: String(error) };
}


function truncateStack(stack: string | undefined, maxLines: number): string | undefined {
  if (!stack) return stack;

  const lines = stack.split("\n");
  if (lines.length <= maxLines) return stack;

  return [...lines.slice(0, maxLines), `... (${lines.length - maxLines} more lines)`].join("\n");
}