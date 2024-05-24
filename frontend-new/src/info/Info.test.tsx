import "src/_test_utilities/consoleMock";
import Info, { DATA_TEST_ID, InfoProps } from "./Info";
import { act } from "@testing-library/react";
import { render, screen, waitFor } from "src/_test_utilities/test-utils";
import { setupFetchSpy } from "src/_test_utilities/fetchSpy";

describe("Testing Info component", () => {
  beforeEach(() => {
    // Mock the fetch API using setupFetchSpy
    setupFetchSpy(
      200,
      {
        date: "fooFrontend",
        branch: "barFrontend",
        buildNumber: "bazFrontend",
        sha: "gooFrontend",
      },
      "application/json;charset=UTF-8"
    );

    // Clear console mocks
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
  });

  afterEach(() => {
    // Restore the original fetch implementation
    jest.restoreAllMocks();
  });

  test("it should show frontend info successfully", async () => {
    // WHEN the component is rendered
    await act(async () => {
      render(<Info />);
    });

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // AND the component should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.INFO_ROOT)).toBeDefined();
    expect(screen.getByTestId(DATA_TEST_ID.INFO_ROOT)).toMatchSnapshot();

    // AND the frontend info should be displayed
    await waitFor(() => {
      expect(screen.getByText("fooFrontend")).toBeDefined();
      expect(screen.getByText("barFrontend")).toBeDefined();
      expect(screen.getByText("bazFrontend")).toBeDefined();
      expect(screen.getByText("gooFrontend")).toBeDefined();
    });
  });
});
