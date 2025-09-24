import { serializeError } from "./errorSerializer";

describe("serializeError", () => {
  it("serializes a Date object", () => {
    const date = new Date("2023-01-01T00:00:00Z");
    const result = serializeError(date);
    expect(result).toBe("2023-01-01T00:00:00.000Z");
  });

  it("serializes a Symbol", () => {
    const symbol = Symbol("test");
    const result = serializeError(symbol);
    expect(result).toBe("Symbol(test)");
  });

  it("serializes a BigInt", () => {
    const bigint = BigInt(1234567890);
    const result = serializeError(bigint);
    expect(result).toBe("1234567890");
  });

  it("serializes a function", () => {
    const func = () => {
    };
    const result = serializeError(func);
    expect(result).toBe("[Function]");
  });

  it("serializes an Error object", () => {
    const error = new Error("Test error");
    const result = serializeError(error);
    expect(result).toMatchObject({
      name: "Error",
      message: "Test error",
      messageChain: expect.stringContaining("Error: Test error"),
      stack: expect.any(String),
    });
  });


  it("serializes an Error object with nested custom cause", () => {
    // construct a deeply nested error
    const grandChildError = new Error("Grandchild error");
    const childError = new Error("Child error", { cause: grandChildError });
    const rootError = new Error("Root error", { cause: childError });

    const result = serializeError(rootError);

    expect(result).toMatchObject({
      name: "Error",
      message: "Root error",
      stack: expect.any(String),
      messageChain: expect.stringContaining("Error: Root error\n ↳ Error: Child error\n  ↳ Error: Grandchild error"),
      cause: {
        name: "Error",
        message: "Child error",
        stack: expect.any(String),
        cause: {
          name: "Error",
          message: "Grandchild error",
          stack: expect.any(String),
        },
      },
    });
  });

  it("serializes an Error object with more than one cause", () => {
    // construct a deeply nested error
    const grandChild1Error = new Error("Grandchild1 error");
    const child1Error = new Error("Child1 error", { cause: grandChild1Error });

    const grandChild2Error = new Error("Grandchild2 error");
    const child2Error = new Error("Child2 error", { cause: grandChild2Error });

    const rootError = new Error("Root error", { cause: [child1Error, child2Error] });

    const result = serializeError(rootError);

    expect(result).toMatchObject({
      name: "Error",
      message: "Root error",
      stack: expect.any(String),
      messageChain: expect.stringContaining("Error: Root error\n  ↳ Error: Child1 error\n   ↳ Error: Grandchild1 error\n  ↳ Error: Child2 error\n   ↳ Error: Grandchild2 error"),
      cause: {
        "0": {
          name: "Error",
          message: "Child1 error",
          stack: expect.any(String),
          cause: {
            name: "Error",
            message: "Grandchild1 error",
            stack: expect.any(String),
          },
        },
        "1": {
          name: "Error",
          message: "Child2 error",
          stack: expect.any(String),
          cause: {
            name: "Error",
            message: "Grandchild2 error",
            stack: expect.any(String),
          },
        }
      },
    });
  });

  it("serializes a generic object", () => {
    const obj = { key: "value" };
    const result = serializeError(obj);
    expect(result).toMatchObject({ key: "value" });
  });

  it("handles circular references", () => {
    const obj: any = {};
    obj.self = obj;
    const result = serializeError(obj);
    expect(result).toMatchObject({ self: "[Circular]" });
  });

  it("truncates deep objects", () => {
    const deepObj = { a: { b: { c: { d: { e: { f: "too deep" } } } } } };
    const result = serializeError(deepObj);
    expect(result).toEqual({ a: { b: { c: { d: { e: { f: "[Truncated: Max depth reached]" } } } } } });
  });

  it("handles unreadable properties", () => {
    const obj = {};
    Object.defineProperty(obj, "unreadable", {
      get() {
        throw new Error("Cannot read property");
      },
      enumerable: true,
    });
    const result = serializeError(obj);
    expect(result).toMatchObject({ unreadable: "[Unreadable property]" });
  });
});