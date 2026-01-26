import { getBackendUrl } from "src/envService";
import { Experience } from "src/experiences/experienceService/experiences.types";

export interface BulkReportData {
  user_id: string;
  registration_code?: string;
  experiences: Experience[];
  conversation_conducted_at: string | null;
}

export interface BulkDownloadFilters {
  started_before?: string;
  started_after?: string;
  page_size?: number;
}

export class BulkDownloadReportsService {
  private static instance: BulkDownloadReportsService;
  private readonly baseUrl: string;

  private constructor() {
    this.baseUrl = `${getBackendUrl()}/reports`;
  }

  public static getInstance(): BulkDownloadReportsService {
    if (!BulkDownloadReportsService.instance) {
      BulkDownloadReportsService.instance = new BulkDownloadReportsService();
    }
    return BulkDownloadReportsService.instance;
  }

  /**
   * Stream reports from the backend API using NDJSON format
   * @param token - Security token for authentication
   * @param filters - Optional filters for date and page size
   * @param onBatch - Callback for each batch of reports received
   * @param onProgress - Optional callback for progress updates (total reports received so far)
   * @returns Promise that resolves when streaming is complete
   */
  public async streamReports(
    token: string,
    filters: BulkDownloadFilters,
    onBatch: (reports: BulkReportData[]) => void | Promise<void>,
    onProgress?: (count: number) => void
  ): Promise<void> {
    const params = new URLSearchParams();
    params.append("token", token);

    if (filters.page_size) {
      params.append("page_size", filters.page_size.toString());
    }

    if (filters.started_before) {
      params.append("started_before", filters.started_before);
    }

    if (filters.started_after) {
      params.append("started_after", filters.started_after);
    }

    const url = `${this.baseUrl}?${params.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/x-ndjson",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch reports: ${response.status} ${response.statusText} - ${errorText}`);
    }

    if (!response.body) {
      throw new Error("Response body is null");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let reportCount = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // Process any remaining data in buffer
          if (buffer.trim()) {
            try {
              const batch = JSON.parse(buffer) as BulkReportData[];
              reportCount += batch.length;
              await onBatch(batch);
              if (onProgress) {
                onProgress(reportCount);
              }
            } catch (error) {
              console.error("Error parsing final batch:", error);
            }
          }
          break;
        }

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines (separated by newline)
        const lines = buffer.split("\n");
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || "";

        // Process each complete line as a batch
        for (const line of lines) {
          if (line.trim()) {
            try {
              const batch = JSON.parse(line) as BulkReportData[];
              reportCount += batch.length;
              await onBatch(batch);
              if (onProgress) {
                onProgress(reportCount);
              }
            } catch (error) {
              console.error("Error parsing batch line:", error, "Line:", line);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
