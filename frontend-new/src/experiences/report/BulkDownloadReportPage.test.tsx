import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import BulkDownloadReportPage from "./BulkDownloadReportPage";
import { BulkDownloadReportsService } from "./bulkDownloadReportsService";
import { globalAssetPreloader } from "./assetPreloader";
import * as saveAsModule from "src/experiences/saveAs";

// Mock dependencies
jest.mock("./bulkDownloadReportsService");
jest.mock("./assetPreloader");
jest.mock("src/experiences/saveAs");
jest.mock("jszip");
jest.mock("@react-pdf/renderer", () => ({
  pdf: jest.fn(() => ({
    toBlob: jest.fn().mockResolvedValue(new Blob(["pdf content"], { type: "application/pdf" })),
  })),
}));
jest.mock("./reportPdf/SkillReportPDF", () => {
  return jest.fn(() => null);
});
jest.mock("./reportDocx/SkillReportDocx", () => {
  return jest.fn().mockResolvedValue(new Blob(["docx content"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
});

describe("BulkDownloadReportPage", () => {
  const mockToken = "test-token-123";
  const mockServiceInstance = {
    streamReports: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (BulkDownloadReportsService.getInstance as jest.Mock).mockReturnValue(mockServiceInstance);
    (globalAssetPreloader.preloadAllAssets as jest.Mock).mockResolvedValue(undefined);
    (globalAssetPreloader.getCache as jest.Mock).mockReturnValue(new Map());
    Object.defineProperty(globalAssetPreloader, 'cacheSize', {
      get: jest.fn(() => 10),
      configurable: true
    });
  });

  const renderComponent = (token = mockToken) => {
    const path = token ? `/bulk-download?token=${token}` : "/bulk-download";
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/bulk-download" element={<BulkDownloadReportPage />} />
        </Routes>
      </MemoryRouter>
    );
  };

  describe("Rendering", () => {
    it("should render the page with all form elements", () => {
      renderComponent();

      expect(screen.getByText("Bulk Download Reports")).toBeInTheDocument();
      expect(screen.getByLabelText(/Started After/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Started Before/i)).toBeInTheDocument();
      expect(screen.getByText("Download Reports")).toBeInTheDocument();
    });

    it("should display security warning", () => {
      renderComponent();

      expect(screen.getByText("Security Notice")).toBeInTheDocument();
      expect(screen.getByText(/sensitive access token/i)).toBeInTheDocument();
    });

    it("should render error page when token is missing", () => {
      renderComponent("");

      expect(screen.getByText(/Unauthorized access to reports/i)).toBeInTheDocument();
    });

    it("should display file format options", () => {
      renderComponent();

      expect(screen.getByText("PDF Only")).toBeInTheDocument();
      expect(screen.getByText("DOCX Only")).toBeInTheDocument();
      expect(screen.getByText("Both")).toBeInTheDocument();
    });
  });

  describe("Date filters", () => {
    it("should update startedAfter when date is changed", () => {
      renderComponent();

      const startedAfterInput = screen.getByLabelText(/Started After/i) as HTMLInputElement;
      fireEvent.change(startedAfterInput, { target: { value: "2024-01-01T00:00" } });

      expect(startedAfterInput.value).toBe("2024-01-01T00:00");
    });

    it("should update startedBefore when date is changed", () => {
      renderComponent();

      const startedBeforeInput = screen.getByLabelText(/Started Before/i) as HTMLInputElement;
      fireEvent.change(startedBeforeInput, { target: { value: "2024-12-31T23:59" } });

      expect(startedBeforeInput.value).toBe("2024-12-31T23:59");
    });
  });

  describe("File format selection", () => {
    it("should select PDF only format", () => {
      renderComponent();

      const pdfButton = screen.getByText("PDF Only");
      fireEvent.click(pdfButton);

      // PDF button should be contained (Material-UI uses "contained" variant for selected)
      expect(pdfButton.closest("button")).toHaveClass("MuiButton-contained");
    });

    it("should select DOCX only format", () => {
      renderComponent();

      const docxButton = screen.getByText("DOCX Only");
      fireEvent.click(docxButton);

      expect(docxButton.closest("button")).toHaveClass("MuiButton-contained");
    });

    it("should default to Both format", () => {
      renderComponent();

      const bothButton = screen.getByText("Both");
      expect(bothButton.closest("button")).toHaveClass("MuiButton-contained");
    });
  });

  describe("Download functionality", () => {
    it("should show preloading status", async () => {
      renderComponent();

      mockServiceInstance.streamReports.mockImplementation(async () => {
        // Simulate no reports
        return;
      });

      const downloadButton = screen.getByText("Download Reports");
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(screen.getByText(/Preloading assets/i)).toBeInTheDocument();
      });
    });

    it("should show no reports error when stream returns empty", async () => {
      renderComponent();

      mockServiceInstance.streamReports.mockImplementation(async () => {
        // Empty stream - no batches
        return;
      });

      const downloadButton = screen.getByText("Download Reports");
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(screen.getByText(/No reports found/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it("should update progress during download", async () => {
      renderComponent();

      mockServiceInstance.streamReports.mockImplementation(
        async (_token: string, _filters: any, onBatch: (batch: any[]) => Promise<void>, onProgress: (count: number) => void) => {
          const batch = [
            { user_id: "user1", registration_code: "reg1", experiences: [], conversation_conducted_at: null },
          ];
          onProgress(1);
          await onBatch(batch);
        }
      );

      const downloadButton = screen.getByText("Download Reports");
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(screen.getByText(/Generating files/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it("should disable form elements during download", async () => {
      renderComponent();

      mockServiceInstance.streamReports.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      const downloadButton = screen.getByText("Download Reports");
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(screen.getByText("Downloading...")).toBeInTheDocument();
        expect(screen.getByLabelText(/Started After/i)).toBeDisabled();
        expect(screen.getByLabelText(/Started Before/i)).toBeDisabled();
      });
    });

    it("should call saveAs with generated zip", async () => {
      const mockSaveAs = jest.fn();
      (saveAsModule.saveAs as jest.Mock).mockImplementation(mockSaveAs);

      renderComponent();

      mockServiceInstance.streamReports.mockImplementation(
        async (_token: string, _filters: any, onBatch: (batch: any[]) => Promise<void>) => {
          const batch = [
            { user_id: "user1", registration_code: "reg1", experiences: [], conversation_conducted_at: null },
          ];
          await onBatch(batch);
        }
      );

      const downloadButton = screen.getByText("Download Reports");
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(mockSaveAs).toHaveBeenCalled();
        const callArgs = mockSaveAs.mock.calls[0];
        expect(callArgs[1]).toMatch(/brujula-reports-\d{4}-\d{2}-\d{2}\.zip/);
      }, { timeout: 5000 });
    });

    it("should display error message on failure", async () => {
      renderComponent();

      mockServiceInstance.streamReports.mockRejectedValue(new Error("Network error"));

      const downloadButton = screen.getByText("Download Reports");
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(screen.getByText(/Error: Network error/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it("should pass correct filters to service", async () => {
      renderComponent();

      mockServiceInstance.streamReports.mockResolvedValue(undefined);

      const startedAfterInput = screen.getByLabelText(/Started After/i);
      const startedBeforeInput = screen.getByLabelText(/Started Before/i);

      fireEvent.change(startedAfterInput, { target: { value: "2024-01-01T00:00" } });
      fireEvent.change(startedBeforeInput, { target: { value: "2024-12-31T23:59" } });

      const downloadButton = screen.getByText("Download Reports");
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(mockServiceInstance.streamReports).toHaveBeenCalledWith(
          mockToken.trim(),
          expect.objectContaining({
            started_after: "2024-01-01T00:00:00.000Z",
            started_before: "2024-12-31T23:59:00.000Z",
            page_size: 20,
          }),
          expect.any(Function),
          expect.any(Function)
        );
      });
    });
  });

  describe("Progress tracking", () => {
    it("should show completion message", async () => {
      renderComponent();

      mockServiceInstance.streamReports.mockImplementation(
        async (_token: string, _filters: any, onBatch: (batch: any[]) => Promise<void>) => {
          const batch = [
            { user_id: "user1", registration_code: "reg1", experiences: [], conversation_conducted_at: null },
          ];
          await onBatch(batch);
        }
      );

      const downloadButton = screen.getByText("Download Reports");
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(screen.getByText(/Successfully downloaded.*reports/i)).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it("should show progress percentage", async () => {
      renderComponent();

      mockServiceInstance.streamReports.mockImplementation(
        async (_token: string, _filters: any, onBatch: (batch: any[]) => Promise<void>, onProgress: (count: number) => void) => {
          const batch = [
            { user_id: "user1", registration_code: "reg1", experiences: [], conversation_conducted_at: null },
          ];
          onProgress(1);
          await onBatch(batch);
        }
      );

      const downloadButton = screen.getByText("Download Reports");
      fireEvent.click(downloadButton);

      await waitFor(() => {
        const progressBar = screen.getByRole("progressbar");
        expect(progressBar).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });
});
