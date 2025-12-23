// Utility function to reset all mocks on the instance’s methods.
// @ts-ignore
export function resetAllMethodMocks(instance) {
  // Get the prototype of the instance to list instance methods.
  const proto = Object.getPrototypeOf(instance);

  // Iterate over all property names except the constructor.
  Object.getOwnPropertyNames(proto)
    .filter((prop) => prop !== "constructor" && typeof instance[prop] === "function")
    .forEach((methodName) => {
      const method = instance[methodName];
      // Check if the method is a Jest mock (spyOn attaches the mock properties)
      if (method && typeof method.mockReset === "function") {
        method.mockReset();
      }
    });
}
