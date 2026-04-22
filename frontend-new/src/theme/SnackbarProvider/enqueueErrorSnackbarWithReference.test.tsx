import "src/_test_utilities/consoleMock";

import { render, screen } from "src/_test_utilities/test-utils";
import userEvent from "@testing-library/user-event";
import { enqueueErrorSnackbarWithReference } from "src/theme/SnackbarProvider/enqueueErrorSnackbarWithReference";
import { DATA_TEST_ID } from "src/theme/SnackbarProvider/ErrorSnackbarContent";
import * as supportReference from "src/error/supportReference/supportReference";

const Trigger = ({ error }: { error: unknown }) => (
  <button
    data-testid="trigger"
    onClick={() => enqueueErrorSnackbarWithReference("Display message", { where: "Test place", error })}
  >
    trigger
  </button>
);

describe("enqueueErrorSnackbarWithReference", () => {
  beforeEach(() => {
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
    jest.clearAllMocks();
  });

  it("opens a persistent error snackbar with message, copy and close actions", async () => {
    render(<Trigger error={new Error("boom")} />);

    await userEvent.click(screen.getByTestId("trigger"));

    expect(await screen.findByText("Display message")).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.CONTAINER)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.BADGE)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.COPY_BUTTON)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.CLOSE_BUTTON)).toBeInTheDocument();
  });

  it("copies the support payload when the copy button is clicked", async () => {
    const mockedCopy = jest.spyOn(supportReference, "copyToClipboard").mockResolvedValue(true);
    render(<Trigger error={new Error("boom")} />);

    await userEvent.click(screen.getByTestId("trigger"));
    await userEvent.click(await screen.findByTestId(DATA_TEST_ID.COPY_BUTTON));

    expect(mockedCopy).toHaveBeenCalledTimes(1);
    const actualPayload = mockedCopy.mock.calls[0][0];
    expect(actualPayload).toContain("Where: Test place");
    expect(actualPayload).toContain("Error:");
  });
});
