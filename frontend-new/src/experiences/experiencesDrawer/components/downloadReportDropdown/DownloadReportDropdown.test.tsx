// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import DownloadReportDropdown, { CVFormat, MENU_ITEM_ID } from "./DownloadReportDropdown";
import { DATA_TEST_ID as DOWNLOAD_BUTTON_DATA_TEST_ID } from "src/experiences/experiencesDrawer/components/downloadReportButton/DownloadReportButton";
import { DATA_TEST_ID as CONTEXT_MENU_DATA_TEST_ID } from "src/theme/ContextMenu/ContextMenu";
import userEvent from "@testing-library/user-event";
import { render, screen } from "src/_test_utilities/test-utils";
import { mockExperiences } from "src/experiences/experienceService/_test_utilities/mockExperiencesResponses";
import { MenuItemConfig } from "src/theme/ContextMenu/menuItemConfig.types";
import { PDFReportDownloadProvider } from "src/experiences/report/reportPdf/provider";
import { DocxReportDownloadProvider } from "src/experiences/report/reportDocx/provider";
import { waitFor } from "@testing-library/react";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import { TabiyaUser } from "src/auth/auth.types";
import MetricsService from "src/metrics/metricsService";
import { EventType } from "src/metrics/types";
import { MetricsError } from "src/error/commonErrors";
import { resetAllMethodMocks } from "src/_test_utilities/resetAllMethodMocks";

// mock the DownloadReportButton
jest.mock("src/experiences/experiencesDrawer/components/downloadReportButton/DownloadReportButton", () => {
  const actual = jest.requireActual("src/experiences/experiencesDrawer/components/downloadReportButton/DownloadReportButton");
  return {
    __esModule: true,
    ...actual,
    default: jest.fn().mockImplementation((props) => (
      <button data-testid={actual.DATA_TEST_ID.DOWNLOAD_REPORT_BUTTON_CONTAINER} onClick={props.notifyOnDownloadPdf}>
        Download Report
      </button>
    ))
  };
});

// mock the ContextMenu
jest.mock("src/theme/ContextMenu/ContextMenu", () => {
  const actual = jest.requireActual("src/theme/ContextMenu/ContextMenu");
  return {
    __esModule: true,
    ...actual,
    default: jest.fn(
      ({ open, items, notifyOnClose }: { open: boolean; items: MenuItemConfig[]; notifyOnClose: () => void }) => {
        return (
          <>
            {open && (
              <div data-testid={actual.DATA_TEST_ID.MENU}>
                {items.map((item) => (
                  <div key={item.id} data-testid={item.id} onClick={item.action}>
                    {item.text}
                  </div>
                ))}
              </div>
            )}
            <div data-testid="outside-click" onClick={notifyOnClose} />
          </>
        );
      }
    ),
  };
});

// mock the PDFReportDownloadProvider
jest.mock("src/experiences/report/reportPdf/provider", () => {
  return {
    PDFReportDownloadProvider: jest.fn().mockImplementation(() => ({
      download: jest.fn(),
    })),
  };
});

// mock the DocxReportDownloadProvider
jest.mock("src/experiences/report/reportDocx/provider", () => {
  return {
    DocxReportDownloadProvider: jest.fn().mockImplementation(() => ({
      download: jest.fn(),
    })),
  };
});

describe("DownloadReportDropdown", () => {
  const mockData = {
    name: "John Doe",
    email: "john@example.com",
    phone: "1234567890",
    address: "123 Main St",
    conversationConductedAt: "2021-06-01T00:00:00",
    experiences: mockExperiences,
  };

  beforeEach(() => {
    // Reset all method mocks on the singletons that may have been mocked
    // As a good practice, we should the mock*Once() methods to avoid side effects between tests
    // As a precaution, we reset all method mocks to ensure that no side effects are carried over between tests
    resetAllMethodMocks(UserPreferencesStateService.getInstance());
    resetAllMethodMocks(AuthenticationStateService.getInstance());
  })

  test("should show the download report dropdown when the button is clicked", async () => {
    // GIVEN the component is rendered
    render(<DownloadReportDropdown {...mockData} />);

    // WHEN the download report button is clicked
    const downloadReportButton = screen.getByTestId(DOWNLOAD_BUTTON_DATA_TEST_ID.DOWNLOAD_REPORT_BUTTON_CONTAINER);
    await userEvent.click(downloadReportButton);

    // THEN the dropdown should be shown
    const contextMenu = screen.getByTestId(CONTEXT_MENU_DATA_TEST_ID.MENU);
    expect(contextMenu).toBeInTheDocument();
    // AND the PDF and DOCX options should be shown
    expect(screen.getByTestId(MENU_ITEM_ID.PDF)).toBeInTheDocument();
    expect(screen.getByTestId(MENU_ITEM_ID.DOCX)).toBeInTheDocument();
    // AND no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND to match the snapshot
    expect(contextMenu).toMatchSnapshot();
  });

  test("should call notifyOnClose when the report dropdown is closed", async () => {
    // GIVEN the component is rendered
    render(<DownloadReportDropdown {...mockData} />);

    // WHEN the download report button is clicked to open the dropdown
    const downloadReportButton = screen.getByTestId(DOWNLOAD_BUTTON_DATA_TEST_ID.DOWNLOAD_REPORT_BUTTON_CONTAINER);
    await userEvent.click(downloadReportButton);
    // AND the user clicks outside the dropdown
    await userEvent.click(screen.getByTestId("outside-click")); // from the mock

    // THEN the dropdown should be closed
    const contextMenu = screen.queryByTestId(CONTEXT_MENU_DATA_TEST_ID.MENU);
    await waitFor(() => {
      expect(contextMenu).not.toBeInTheDocument();
    });
    // AND no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test.each(
    [
      [CVFormat.PDF, MENU_ITEM_ID.PDF, PDFReportDownloadProvider],
      [CVFormat.DOCX, MENU_ITEM_ID.DOCX, DocxReportDownloadProvider],
  ]
  )("should call the appropriate provider when the %s option is clicked", async ( givenFormat: CVFormat, givenMenuItem: string, expectedProvider) => {
    // GIVEN there is an active session and user
    const givenSessionId = 123;
    jest.spyOn(UserPreferencesStateService.getInstance(), "getActiveSessionId").mockReturnValueOnce(givenSessionId);
    const givenUserId = "foo-id";
    jest.spyOn(AuthenticationStateService.getInstance(), "getUser").mockReturnValueOnce({ id: givenUserId } as TabiyaUser);

    // AND the metrics service will successfully send the event
    jest.spyOn(MetricsService.getInstance(), "sendMetricsEvent").mockReturnValueOnce();

    // AND the component is rendered
    render(<DownloadReportDropdown {...mockData} />);
    // AND the dropdown is shown
    const downloadReportButton = screen.getByTestId(DOWNLOAD_BUTTON_DATA_TEST_ID.DOWNLOAD_REPORT_BUTTON_CONTAINER);
    await userEvent.click(downloadReportButton);

    // WHEN the given option is clicked
    await userEvent.click(screen.getByTestId(givenMenuItem));

    // THEN expect the expected provider should be called
    expect(expectedProvider).toHaveBeenCalled();
    // AND the metrics event should be sent
    expect(MetricsService.getInstance().sendMetricsEvent).toHaveBeenCalledWith({
      event_type: EventType.CV_DOWNLOADED,
      cv_format: givenFormat,
      user_id: givenUserId,
      session_id: givenSessionId,
      timestamp: expect.any(String),
    });
    // AND no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should handle error when downloading Report", async () => {
    // GIVEN the download will fail
    const mockError = new Error("Download failed");
    (PDFReportDownloadProvider as jest.Mock).mockImplementation(() => ({
      download: jest.fn().mockRejectedValue(mockError),
    }));

    // WHEN the component is rendered
    render(<DownloadReportDropdown {...mockData} />);
    // AND the dropdown is shown
    const downloadReportButton = screen.getByTestId(DOWNLOAD_BUTTON_DATA_TEST_ID.DOWNLOAD_REPORT_BUTTON_CONTAINER);
    await userEvent.click(downloadReportButton);
    // AND the PDF option is clicked
    await userEvent.click(screen.getByTestId(MENU_ITEM_ID.PDF));

    // THEN expect the error to be thrown
    expect(console.error).toHaveBeenCalledWith("Error downloading report", mockError);
  });

  test("should handle when user_id is not available", async () => {
    // GIVEN the user_id is not available
    jest.spyOn(AuthenticationStateService.getInstance(), "getUser").mockReturnValueOnce(null);
    // AND the component is rendered
    render(<DownloadReportDropdown {...mockData} />);
    // AND the dropdown is shown
    const downloadReportButton = screen.getByTestId(DOWNLOAD_BUTTON_DATA_TEST_ID.DOWNLOAD_REPORT_BUTTON_CONTAINER);
    await userEvent.click(downloadReportButton);

    // WHEN the PDF option is clicked
    await userEvent.click(screen.getByTestId(MENU_ITEM_ID.PDF));

    // THEN expect the error to be thrown
    expect(console.error).toHaveBeenCalledWith(new MetricsError(`Unable to send CVDownload metrics: User id: undefined, Session id: undefined`));
  });

  test("should handle when session_id is not available", async () => {
    // GIVEN the session_id is not available
    jest.spyOn(UserPreferencesStateService.getInstance(), "getActiveSessionId").mockReturnValueOnce(null);
    // AND the component is rendered
    render(<DownloadReportDropdown {...mockData} />);
    // AND the dropdown is shown
    const downloadReportButton = screen.getByTestId(DOWNLOAD_BUTTON_DATA_TEST_ID.DOWNLOAD_REPORT_BUTTON_CONTAINER);
    await userEvent.click(downloadReportButton);

    // WHEN the PDF option is clicked
    await userEvent.click(screen.getByTestId(MENU_ITEM_ID.PDF));

    // THEN expect the error to be thrown
    expect(console.error).toHaveBeenCalledWith(new MetricsError(`Unable to send CVDownload metrics: User id: undefined, Session id: undefined`));
  });
});
