import "src/_test_utilities/consoleMock";
import Info, { DATA_TEST_ID } from "./Info";
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
    render(<Info />);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // AND the component should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.INFO_ROOT)).toBeDefined();
    // AND the frontend info should be displayed

    // AND the frontend info should be displayed
    await waitFor(() => {
      expect(screen.getByText("fooFrontend")).toBeInTheDocument();
    });

    expect(screen.getByText("barFrontend")).toBeInTheDocument();
    expect(screen.getByText("bazFrontend")).toBeInTheDocument();
    expect(screen.getByText("gooFrontend")).toBeInTheDocument();

    // AND the component should match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.INFO_ROOT)).toMatchSnapshot();
  });
});
