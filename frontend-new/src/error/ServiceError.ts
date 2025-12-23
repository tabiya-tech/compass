export class ServiceError extends Error {
  serviceName: string;
  serviceFunction: string;

  constructor(serviceName: string, serviceFunction: string, message: string, cause?: unknown) {
    super(message);
    this.serviceName = serviceName;
    this.serviceFunction = serviceFunction;

    // if the cause is an object, or a JSON representation of an object,
    // then add it as an object to the details property,
    // otherwise just add the details as a string
    if (typeof cause === "string") {
      try {
        this.cause = JSON.parse(cause);
      } catch (e) {
        this.cause = cause;
      }
    } else {
      this.cause = cause;
    }
  }
}
