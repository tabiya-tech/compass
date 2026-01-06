import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import PublicReportPage from "./PublicReportPage";

const mockGetPublicReport = jest.fn();

jest.mock("./publicReportService", () => ({
  PublicReportService: {
    getInstance: () => ({
      getPublicReport: mockGetPublicReport,
    }),
  },
}));

jest.mock("@react-pdf/renderer", () => {
  const React = require("react");
  return {
    PDFViewer: ({ children }: { children: React.ReactNode }) => <div data-testid="pdf-viewer">{children}</div>,
    PDFDownloadLink: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
    Document: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Page: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Text: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Image: () => <div />, // Prevent attempts to load assets during tests
    Font: { register: jest.fn() },
    StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  };
});

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("src/theme/Backdrop/Backdrop", () => ({
  Backdrop: ({ isShown }: { isShown: boolean }) => (isShown ? <div data-testid="backdrop" /> : null),
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
