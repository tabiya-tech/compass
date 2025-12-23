// mute chatty console
import "src/_test_utilities/consoleMock";

// standard sentry mock
import "src/_test_utilities/sentryMock";
import { render, screen } from "src/_test_utilities/test-utils";
import ErrorPage, { DATA_TEST_ID } from "src/error/errorPage/ErrorPage";
import { DATA_TEST_ID as BUG_REPORT_DATA_TEST_ID } from "src/feedback/bugReport/bugReportButton/BugReportButton";
import * as Sentry from "@sentry/react";

// mock the bugReport component
jest.mock("src/feedback/bugReport/bugReportButton/BugReportButton", () => {
  const actual = jest.requireActual("src/feedback/bugReport/bugReportButton/BugReportButton");
  return {
    ...actual,
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return <span data-testid={actual.DATA_TEST_ID.BUG_REPORT_BUTTON_CONTAINER}></span>;
    }),
  };
});
describe("ErrorPage", () => {
  test("ErrorPage renders correctly", () => {
    // GIVEN an error message
    const errorMessage = "404 Error - Page Not Found";
    // AND sentry is initialized
    (Sentry.isInitialized as jest.Mock).mockReturnValue(true);

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
    // AND expect the bug report button to be rendered
    expect(screen.getByTestId(BUG_REPORT_DATA_TEST_ID.BUG_REPORT_BUTTON_CONTAINER)).toBeInTheDocument();
    // AND the ErrorPage component should match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.ERROR_CONTAINER)).toMatchSnapshot();
  });
});
