// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen } from "src/_test_utilities/test-utils";
import DownloadReportButton, {
  DATA_TEST_ID,
} from "src/experiences/experiencesDrawer/components/downloadReportButton/DownloadReportButton";

// mock help tip component
jest.mock("src/theme/HelpTip/HelpTip", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation((props) => <div data-testid={props["data-testid"]} />),
  };
});

describe("DownloadReportButton", () => {
  test("should render DownloadReportButton correctly when disabled is false", () => {
    // GIVEN the component
    const givenComponent = <DownloadReportButton disabled={false} notifyOnDownloadPdf={jest.fn()} />;

    // WHEN the component is rendered and the disabled is false
    render(givenComponent);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the download report button container to be in the document
    const downloadReportButtonContainer = screen.getByTestId(DATA_TEST_ID.DOWNLOAD_REPORT_BUTTON_CONTAINER);
    expect(downloadReportButtonContainer).toBeInTheDocument();
    // AND the download report button to be in the document
    const downloadReportButton = screen.getByTestId(DATA_TEST_ID.DOWNLOAD_REPORT_BUTTON);
    expect(downloadReportButton).toBeInTheDocument();
    // AND the download report button to be enabled
    expect(downloadReportButton).not.toBeDisabled();
    // AND the download report icon to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.DOWNLOAD_REPORT_ICON)).toBeInTheDocument();
    // AND the text "Download CV" to be in the document
    expect(screen.getByText("Download CV")).toBeInTheDocument();
    // AND the download report help tip to not be in the document
    expect(screen.queryByTestId(DATA_TEST_ID.DOWNLOAD_REPORT_HELP_TIP)).not.toBeInTheDocument();
    // AND to match the snapshot
    expect(downloadReportButtonContainer).toMatchSnapshot();
  });

  test("should render DownloadReportButton correctly when disabled is true", () => {
    // GIVEN the component
    const givenComponent = <DownloadReportButton disabled={true} notifyOnDownloadPdf={jest.fn()} />;

    // WHEN the component is rendered and the disabled is true
    render(givenComponent);

    // THEN expect the download report button container to be in the document
    const downloadReportButtonContainer = screen.getByTestId(DATA_TEST_ID.DOWNLOAD_REPORT_BUTTON_CONTAINER);
    expect(downloadReportButtonContainer).toBeInTheDocument();
    // AND the download report button to be in the document
    const downloadReportButton = screen.getByTestId(DATA_TEST_ID.DOWNLOAD_REPORT_BUTTON);
    expect(downloadReportButton).toBeInTheDocument();
    // AND the download report button to be disabled
    expect(downloadReportButton).toBeDisabled();
    // AND the download report icon to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.DOWNLOAD_REPORT_ICON)).toBeInTheDocument();
    // AND the text "Download CV" to be in the document
    expect(screen.getByText("Download CV")).toBeInTheDocument();
    // AND the download report help tip to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.DOWNLOAD_REPORT_HELP_TIP)).toBeInTheDocument();
    // AND to match the snapshot
    expect(downloadReportButtonContainer).toMatchSnapshot();
  });

  test("should render DownloadReportButton correctly when isLoading is true", () => {
    // GIVEN isLoading is true
    const givenIsLoading = true;

    // WHEN the component is rendered
    render(<DownloadReportButton isLoading={givenIsLoading} notifyOnDownloadPdf={jest.fn()} />);

    // THEN expect the download report button container to be in the document
    const downloadReportButtonContainer = screen.getByTestId(DATA_TEST_ID.DOWNLOAD_REPORT_BUTTON_CONTAINER);
    expect(downloadReportButtonContainer).toBeInTheDocument();
    // AND the download report button to be in the document
    const downloadReportButton = screen.getByTestId(DATA_TEST_ID.DOWNLOAD_REPORT_BUTTON);
    expect(downloadReportButton).toBeInTheDocument();
    // AND expect the download report progress icon to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.DOWNLOAD_REPORT_PROGRESS_ICON)).toBeInTheDocument();
    // AND the downloading text to be in the document
    expect(screen.getByText("Downloading")).toBeInTheDocument();
    // AND expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND to match the snapshot
    expect(downloadReportButtonContainer).toMatchSnapshot();
  });
});
