import { render, screen } from "src/_test_utilities/test-utils";
import ErrorPage, { DATA_TEST_ID } from "./ErrorPage";

describe("ErrorPage", () => {
  test("ErrorPage renders correctly", () => {
    // GIVEN an error message
    const errorMessage = "404 Error - Page Not Found";

    jest.spyOn(console, "error");
    jest.spyOn(console, "warn");

    // WHEN the ErrorPage component is rendered
    render(<ErrorPage errorMessage={errorMessage} />);

    // THEN the ErrorPage component should render without errors
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the ErrorPage component container should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.ERROR_CONTAINER)).toBeInTheDocument();
    // AND the ErrorPage component illustration should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.ERROR_ILLUSTRATION)).toBeInTheDocument();
    // AND the ErrorPage component message should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.ERROR_MESSAGE)).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    // AND the ErrorPage component should match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.ERROR_CONTAINER)).toMatchSnapshot();
  });
});
