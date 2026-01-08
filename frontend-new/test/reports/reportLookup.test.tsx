import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import PublicReportPage from "src/experiences/report/PublicReportPage";

const mockGetPublicReport = jest.fn();

jest.mock("src/experiences/report/publicReportService", () => ({
  PublicReportService: {
    getInstance: () => ({
      getPublicReport: mockGetPublicReport,
    }),
  },
}));

jest.mock("@react-pdf/renderer", () => ({
  PDFViewer: ({ children }: { children: React.ReactNode }) => <div data-testid="pdf-viewer">{children}</div>,
  PDFDownloadLink: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("PublicReportPage report lookup", () => {
  beforeEach(() => {
    mockGetPublicReport.mockResolvedValue({
      user_id: "user-123",
      experiences: [],
      conversation_conducted_at: null,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderWithRoute = (initialEntry: string) => {
    return render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/report/:id" element={<PublicReportPage />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it("prefers registration code identifier when provided", async () => {
    renderWithRoute("/report/reg-abc?token=rt-1");

    await waitFor(() => {
      expect(mockGetPublicReport).toHaveBeenCalledWith("reg-abc", "rt-1");
    });

    expect(screen.getByText("common.buttons.download")).toBeInTheDocument();
  });

  it("falls back to user id when no registration code match", async () => {
    renderWithRoute("/report/user-456");

    await waitFor(() => {
      expect(mockGetPublicReport).toHaveBeenCalledWith("user-456", null);
    });

    expect(screen.getByTestId("pdf-viewer")).toBeInTheDocument();
  });
});
