// standard sentry mock
import "src/_test_utilities/sentryMock"
// mute the console
import "src/_test_utilities/consoleMock";

import Info, { DATA_TEST_ID, InfoProps } from "./Info";
import { act } from "react";
import { render, screen } from "src/_test_utilities/test-utils";
import InfoService from "./info.service";
import React from "react";
import { DATA_TEST_ID as BUG_REPORT_DATA_TEST_ID } from "src/feedback/bugReport/bugReportButton/BugReportButton";
import * as Sentry from "@sentry/react";

// Mock the info service
jest.mock("./info.service", () => {
  const mockInfoService = jest.fn();
  mockInfoService.prototype.loadInfo = jest.fn().mockImplementation(() => {
    return Promise.resolve([]);
  });
  return mockInfoService;
});

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
  test("it should show frontend info successfully", async () => {
    // GIVEN some frontend and backend info data are available and loaded
    const expectedFrontendInfoData: InfoProps = {
      date: "fooFrontend",
      branch: "barFrontend",
      buildNumber: "bazFrontend",
      sha: "gooFrontend",
    };
    const expectedBackendInfoData: InfoProps = {
      date: "fooBackend",
      branch: "barBackend",
      buildNumber: "bazBackend",
      sha: "gooBackend",
    };
    const infoDataPromise = Promise.resolve([expectedFrontendInfoData, expectedBackendInfoData]);

    // @ts-ignore
    InfoService.mockImplementationOnce(() => {
      return {
        loadInfo: () => {
          return infoDataPromise;
        },
      };
    });

    // AND sentry is initialized
    (Sentry.isInitialized as jest.Mock).mockReturnValue(true);

    // WHEN the component is rendered
    render(<Info />);
    await act(async () => {
      await infoDataPromise;
    });

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the component should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.INFO_ROOT)).toBeDefined();
    expect(screen.getByTestId(DATA_TEST_ID.INFO_ROOT)).toMatchSnapshot(DATA_TEST_ID.INFO_ROOT);
    // AND expect the bug report button to be rendered
    expect(screen.getByTestId(BUG_REPORT_DATA_TEST_ID.BUG_REPORT_BUTTON_CONTAINER)).toBeInTheDocument();
    // AND the frontend info should be displayed
    expect(screen.getByTestId(DATA_TEST_ID.VERSION_FRONTEND_ROOT)).toBeDefined();
    expect(screen.getByTestId(DATA_TEST_ID.VERSION_FRONTEND_ROOT)).toMatchSnapshot(DATA_TEST_ID.VERSION_FRONTEND_ROOT);
    // AND the backend info should be displayed
    expect(screen.getByTestId(DATA_TEST_ID.VERSION_BACKEND_ROOT)).toBeDefined();
    expect(screen.getByTestId(DATA_TEST_ID.VERSION_BACKEND_ROOT)).toMatchSnapshot(DATA_TEST_ID.VERSION_BACKEND_ROOT);
  });
});
