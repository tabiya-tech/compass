import { BulkDownloadReportsService, BulkReportData } from "./bulkDownloadReportsService";

// Mock the envService
jest.mock("src/envService", () => ({
  getBackendUrl: jest.fn(() => "http://localhost:8000"),
}));

describe("BulkDownloadReportsService", () => {
  let service: BulkDownloadReportsService;

  beforeEach(() => {
    service = BulkDownloadReportsService.getInstance();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("getInstance", () => {
    it("should return a singleton instance", () => {
      const instance1 = BulkDownloadReportsService.getInstance();
      const instance2 = BulkDownloadReportsService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("streamReports", () => {
    it("should successfully stream and parse NDJSON data", async () => {
      const mockReports: BulkReportData[] = [
        {
          user_id: "user1",
          registration_code: "reg1",
          experiences: [],
          conversation_conducted_at: "2024-01-01T00:00:00Z",
        },
        {
          user_id: "user2",
          registration_code: "reg2",
          experiences: [],
          conversation_conducted_at: "2024-01-02T00:00:00Z",
        },
      ];

      const mockStream = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(JSON.stringify(mockReports) + "\n"),
            })
            .mockResolvedValueOnce({ done: true, value: undefined }),
          releaseLock: jest.fn(),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const onBatch = jest.fn();
      const onProgress = jest.fn();

      await service.streamReports("test-token", { page_size: 10 }, onBatch, onProgress);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("token=test-token"),
        expect.objectContaining({
          method: "GET",
          headers: { Accept: "application/x-ndjson" },
        })
      );

      expect(onBatch).toHaveBeenCalledTimes(1);
      expect(onBatch).toHaveBeenCalledWith(mockReports);
      expect(onProgress).toHaveBeenCalledWith(2);
    });

    it("should handle multiple batches in stream", async () => {
      const batch1: BulkReportData[] = [
        { user_id: "user1", experiences: [], conversation_conducted_at: null },
      ];
      const batch2: BulkReportData[] = [
        { user_id: "user2", experiences: [], conversation_conducted_at: null },
      ];

      const mockStream = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(JSON.stringify(batch1) + "\n"),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(JSON.stringify(batch2) + "\n"),
            })
            .mockResolvedValueOnce({ done: true, value: undefined }),
          releaseLock: jest.fn(),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const onBatch = jest.fn();
      const onProgress = jest.fn();

      await service.streamReports("test-token", {}, onBatch, onProgress);

      expect(onBatch).toHaveBeenCalledTimes(2);
      expect(onBatch).toHaveBeenNthCalledWith(1, batch1);
      expect(onBatch).toHaveBeenNthCalledWith(2, batch2);
      expect(onProgress).toHaveBeenLastCalledWith(2);
    });

    it("should handle incomplete lines in buffer", async () => {
      const report: BulkReportData = {
        user_id: "user1",
        experiences: [],
        conversation_conducted_at: null,
      };

      const json = JSON.stringify([report]);
      const half1 = json.slice(0, json.length / 2);
      const half2 = json.slice(json.length / 2);

      const mockStream = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(half1),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(half2 + "\n"),
            })
            .mockResolvedValueOnce({ done: true, value: undefined }),
          releaseLock: jest.fn(),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const onBatch = jest.fn();

      await service.streamReports("test-token", {}, onBatch);

      expect(onBatch).toHaveBeenCalledTimes(1);
      expect(onBatch).toHaveBeenCalledWith([report]);
    });

    it("should include filters in request URL", async () => {
      const mockStream = {
        getReader: () => ({
          read: jest.fn().mockResolvedValueOnce({ done: true, value: undefined }),
          releaseLock: jest.fn(),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const filters = {
        page_size: 20,
        started_before: "2024-01-01T00:00:00Z",
        started_after: "2023-01-01T00:00:00Z",
      };

      await service.streamReports("test-token", filters, jest.fn());

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(fetchCall).toContain("token=test-token");
      expect(fetchCall).toContain("page_size=20");
      expect(fetchCall).toContain("started_before=2024-01-01T00%3A00%3A00Z");
      expect(fetchCall).toContain("started_after=2023-01-01T00%3A00%3A00Z");
    });

    it("should throw error when response is not ok", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: jest.fn().mockResolvedValue("Invalid token"),
      });

      await expect(service.streamReports("bad-token", {}, jest.fn())).rejects.toThrow(
        "Failed to fetch reports: 403 Forbidden - Invalid token"
      );
    });

    it("should throw error when response body is null", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: null,
      });

      await expect(service.streamReports("test-token", {}, jest.fn())).rejects.toThrow(
        "Response body is null"
      );
    });

    it("should handle JSON parse errors gracefully", async () => {
      const mockStream = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode("invalid json\n"),
            })
            .mockResolvedValueOnce({ done: true, value: undefined }),
          releaseLock: jest.fn(),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const onBatch = jest.fn();

      await service.streamReports("test-token", {}, onBatch);

      expect(onBatch).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error parsing batch line:",
        expect.any(Error),
        "Line:",
        "invalid json"
      );

      consoleSpy.mockRestore();
    });

    it("should handle empty lines in stream", async () => {
      const report: BulkReportData = {
        user_id: "user1",
        experiences: [],
        conversation_conducted_at: null,
      };

      const mockStream = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode("\n\n" + JSON.stringify([report]) + "\n\n"),
            })
            .mockResolvedValueOnce({ done: true, value: undefined }),
          releaseLock: jest.fn(),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const onBatch = jest.fn();

      await service.streamReports("test-token", {}, onBatch);

      expect(onBatch).toHaveBeenCalledTimes(1);
      expect(onBatch).toHaveBeenCalledWith([report]);
    });

    it("should release reader lock even if error occurs", async () => {
      const mockReleaseLock = jest.fn();
      const mockStream = {
        getReader: () => ({
          read: jest.fn().mockRejectedValue(new Error("Stream error")),
          releaseLock: mockReleaseLock,
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      await expect(service.streamReports("test-token", {}, jest.fn())).rejects.toThrow("Stream error");

      expect(mockReleaseLock).toHaveBeenCalled();
    });

    it("should handle final buffer with data when stream ends", async () => {
      const report: BulkReportData = {
        user_id: "user1",
        experiences: [],
        conversation_conducted_at: null,
      };

      // Send data without trailing newline
      const mockStream = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(JSON.stringify([report])),
            })
            .mockResolvedValueOnce({ done: true, value: undefined }),
          releaseLock: jest.fn(),
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const onBatch = jest.fn();

      await service.streamReports("test-token", {}, onBatch);

      expect(onBatch).toHaveBeenCalledTimes(1);
      expect(onBatch).toHaveBeenCalledWith([report]);
    });
  });
});
