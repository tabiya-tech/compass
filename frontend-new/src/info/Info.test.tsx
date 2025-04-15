// standard sentry mock
import "src/_test_utilities/sentryMock";
// mute the console
import "src/_test_utilities/consoleMock";

import Info, { DATA_TEST_ID } from "./Info";
import { render, screen } from "src/_test_utilities/test-utils";
import InfoService from "./info.service";
import React from "react";
import * as Sentry from "@sentry/react";
import userEvent from "@testing-library/user-event";
import { VersionItem } from "./info.types";
import { resetAllMethodMocks } from "src/_test_utilities/resetAllMethodMocks";

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

describe("Testing Info component", () => {
  beforeEach(() => {
    // clear all method mocks
    resetAllMethodMocks(InfoService.getInstance());
  });
  test("it should show frontend info successfully", async () => {
    // GIVEN some frontend and backend info data are available and loaded
    const expectedFrontendInfoData: VersionItem = {
      date: "fooFrontend",
      branch: "barFrontend",
      buildNumber: "bazFrontend",
      sha: "gooFrontend",
    };
    const expectedBackendInfoData: VersionItem = {
      date: "fooBackend",
      branch: "barBackend",
      buildNumber: "bazBackend",
      sha: "gooBackend",
    };

    jest.spyOn(InfoService.getInstance(), "loadInfo").mockResolvedValueOnce({
      frontend: expectedFrontendInfoData,
      backend: expectedBackendInfoData,
    });

    // AND sentry is initialized
    (Sentry.isInitialized as jest.Mock).mockReturnValue(true);

    // WHEN the component is rendered
    render(<Info isOpen={true} notifyOnClose={jest.fn()} />);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the info drawer to be displayed
    const infoDrawer = screen.getByTestId(DATA_TEST_ID.INFO_DRAWER_CONTAINER);
    expect(infoDrawer).toBeDefined();
    // AND the info drawer header to be displayed
    expect(screen.getByTestId(DATA_TEST_ID.INFO_DRAWER_HEADER)).toBeDefined();
    // AND the info drawer header text to be displayed
    expect(screen.getByText("Application Information")).toBeDefined();
    // AND the info drawer header button to be displayed
    expect(screen.getByTestId(DATA_TEST_ID.INFO_DRAWER_HEADER_BUTTON)).toBeDefined();
    // AND the info drawer header icon to be displayed
    expect(screen.getByTestId(DATA_TEST_ID.INFO_DRAWER_HEADER_ICON)).toBeDefined();
    // AND the application info to be displayed
    expect(screen.getByTestId(DATA_TEST_ID.INFO_ROOT)).toBeDefined();
    expect(screen.getByTestId(DATA_TEST_ID.INFO_ROOT)).toMatchSnapshot(DATA_TEST_ID.INFO_ROOT);
    // AND the frontend info should be displayed
    expect(screen.getByTestId(DATA_TEST_ID.VERSION_FRONTEND_ROOT)).toBeDefined();
    expect(screen.getByTestId(DATA_TEST_ID.VERSION_FRONTEND_ROOT)).toMatchSnapshot(DATA_TEST_ID.VERSION_FRONTEND_ROOT);
    // AND the backend info should be displayed
    expect(screen.getByTestId(DATA_TEST_ID.VERSION_BACKEND_ROOT)).toBeDefined();
    expect(screen.getByTestId(DATA_TEST_ID.VERSION_BACKEND_ROOT)).toMatchSnapshot(DATA_TEST_ID.VERSION_BACKEND_ROOT);
    // AND the component to match the snapshot
    expect(infoDrawer).toMatchSnapshot();
  });

  test("should call notifyOnClose when the close button is clicked", async () => {
    // GIVEN the notifyOnClose
    const givenNotifyOnClose = jest.fn();
    // AND the Info service will return the correct version
    const expectedFrontendInfoData: VersionItem = {
      date: "fooFrontend",
      branch: "barFrontend",
      buildNumber: "bazFrontend",
      sha: "gooFrontend",
    };
    const expectedBackendInfoData: VersionItem = {
      date: "fooBackend",
      branch: "barBackend",
      buildNumber: "bazBackend",
      sha: "gooBackend",
    };
    jest.spyOn(InfoService.getInstance(), "loadInfo").mockResolvedValueOnce({
      frontend: expectedFrontendInfoData,
      backend: expectedBackendInfoData,
    });
    // AND the Info component is rendered
    render(<Info isOpen={true} notifyOnClose={givenNotifyOnClose} />);

    // WHEN the close button is clicked
    const closeButton = screen.getByTestId(DATA_TEST_ID.INFO_DRAWER_HEADER_BUTTON);
    await userEvent.click(closeButton);

    // THEN expect notifyOnClose to have been called
    expect(givenNotifyOnClose).toHaveBeenCalled();
  });
});
