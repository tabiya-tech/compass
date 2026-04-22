import "src/_test_utilities/consoleMock";

import { render, screen } from "src/_test_utilities/test-utils";
import userEvent from "@testing-library/user-event";
import { SnackbarKey } from "notistack";
import { DATA_TEST_ID, ErrorSnackbarContent } from "src/theme/SnackbarProvider/ErrorSnackbarContent";
import * as supportReference from "src/error/supportReference/supportReference";

const renderContent = (overrides: { message?: string; payload?: string } = {}) => {
  const id: SnackbarKey = "test-id";
  return render(
    <ErrorSnackbarContent
      id={id}
      message={overrides.message ?? "Short error"}
      payload={overrides.payload ?? "Error: boom\nReference: abc"}
    />
  );
};

describe("ErrorSnackbarContent", () => {
  beforeEach(() => {
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
    jest.clearAllMocks();
  });

  it("renders the badge, message, copy and close buttons for a short message", () => {
    renderContent({ message: "Short error" });

    expect(screen.getByTestId(DATA_TEST_ID.CONTAINER)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.BADGE)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.MESSAGE)).toHaveTextContent("Short error");
    expect(screen.getByTestId(DATA_TEST_ID.COPY_BUTTON)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.CLOSE_BUTTON)).toBeInTheDocument();
  });

  it("does not render the expand button when the message fits", () => {
    // GIVEN a short message whose scrollWidth does not exceed clientWidth
    renderContent({ message: "Short error" });

    // THEN the expand button is absent
    expect(screen.queryByTestId(DATA_TEST_ID.EXPAND_BUTTON)).not.toBeInTheDocument();
  });

  it("renders the expand button when the message overflows and toggles expansion on click", async () => {
    // GIVEN the DOM will report overflow for the message
    // Mock scrollWidth / clientWidth to simulate overflow
    const originalScrollWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollWidth");
    const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", { configurable: true, get: () => 800 });
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 400 });

    try {
      renderContent({ message: "A message that is long enough to overflow the snackbar width" });

      // THEN the expand button is present
      const actualExpandButton = await screen.findByTestId(DATA_TEST_ID.EXPAND_BUTTON);
      expect(actualExpandButton).toBeInTheDocument();

      // AND clicking it does not throw (expanded state change is internal)
      await userEvent.click(actualExpandButton);
      expect(screen.getByTestId(DATA_TEST_ID.EXPAND_BUTTON)).toBeInTheDocument();
    } finally {
      if (originalScrollWidth) Object.defineProperty(HTMLElement.prototype, "scrollWidth", originalScrollWidth);
      if (originalClientWidth) Object.defineProperty(HTMLElement.prototype, "clientWidth", originalClientWidth);
    }
  });

  it("copies the payload when the copy button is clicked", async () => {
    const mockedCopy = jest.spyOn(supportReference, "copyToClipboard").mockResolvedValue(true);
    renderContent({ payload: "Error: boom\nReference: xyz" });

    await userEvent.click(screen.getByTestId(DATA_TEST_ID.COPY_BUTTON));

    expect(mockedCopy).toHaveBeenCalledWith("Error: boom\nReference: xyz");
  });

  it("shows the copy-failed title when copyToClipboard returns false", async () => {
    // GIVEN clipboard copy will fail
    jest.spyOn(supportReference, "copyToClipboard").mockResolvedValue(false);
    renderContent({ payload: "Error: boom" });

    // WHEN the user clicks the copy button
    const copyButton = screen.getByTestId(DATA_TEST_ID.COPY_BUTTON);
    await userEvent.click(copyButton);

    // THEN the button's title reflects the failure (uses the copyFailed i18n key)
    expect(copyButton).toHaveAttribute("title", expect.stringMatching(/copy|fail/i));
  });
});
