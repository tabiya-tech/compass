import { saveAs } from "./saveAs";

describe("saveAs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should use msSaveOrOpenBlob when available (IE scenario)", () => {
    // GIVEN: A navigator with msSaveOrOpenBlob (simulating Internet Explorer)
    const msSaveOrOpenBlobMock = jest.fn();
    Object.defineProperty(window.navigator, "msSaveOrOpenBlob", {
      value: msSaveOrOpenBlobMock,
      configurable: true,
    });
    // AND: A Blob and filename
    const givenBlob = new Blob(["Test content"], { type: "text/plain" });
    const givenFilename = "test.txt";

    // WHEN: The saveAs function is called with the given Blob and filename
    saveAs(givenBlob, givenFilename);

    // THEN: msSaveOrOpenBlob should be called with the Blob and filename
    expect(msSaveOrOpenBlobMock).toHaveBeenCalledWith(givenBlob, givenFilename);

    // Reset the DOM state
    // Clean up: Remove the mocked property
    delete (window.navigator as any).msSaveOrOpenBlob;
  });

  /**
   * There is not much to test here besides that a download url was generated
   * based on the blob and an anchor is clicked and nothing fails.
   * The test is week as it does not check the actual download, but better than nothing.
   */
  it("should create a temporary URL and trigger download (non-IE scenario)", () => {
    // GIVEN: A standard environment without msSaveOrOpenBlob
    // No need to mock navigator but we need to mock URL.createObjectURL and URL.revokeObjectURL
    // as it is not available in JSDOM
    const givenDownloadUrl = "blob:http://localhost/blobid";
    Object.defineProperty(window.URL, "createObjectURL", {
      writable: true,
      value: jest.fn(() => givenDownloadUrl),
    });
    Object.defineProperty(window.URL, "revokeObjectURL", {
      writable: true,
      value: jest.fn(),
    });

    // AND: A Blob and filename
    const blob = new Blob(["Test content"], { type: "text/plain" });
    const filename = "test.txt";

    // Spy on document methods
    const clickSpy = jest.spyOn(HTMLElement.prototype, "click");
    // WHEN: The saveAs function is called with the given Blob and filename
    saveAs(blob, filename);

    // THEN: an url should be created with the blob
    expect(window.URL.createObjectURL).toHaveBeenCalledWith(blob);

    // AND: The click method should be called on the anchor
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
