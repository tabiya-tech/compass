import { getBackendUrl } from "src/envService";
import { MetricsEventUnion } from "src/metrics/types";
import { customFetch } from "src/utils/customFetch/customFetch";
import { StatusCodes } from "http-status-codes";
import { MetricsError } from "src/error/commonErrors";

export const METRICS_FLUSH_INTERVAL_MS = 15000; // 15 seconds

export default class MetricsService {
  readonly apiServerUrl: string;
  private static instance: MetricsService | null;
  private _eventBuffer: MetricsEventUnion[] = [];
  private _flushInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.apiServerUrl = getBackendUrl();
    // Start the flush interval immediately after the service is created
    this.startFlushInterval();
  }

  /**
   * Get the singleton instance of the MetricsService.
   * @returns {MetricsService} The singleton instance of the MetricsService.
   */
  static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  /**
   * Starts the interval that periodically flushes the event buffer
   */
  private startFlushInterval(): void {
    if (this._flushInterval === null) {
      this._flushInterval = setInterval(() => {
        this.flushEvents().then(() => {
          console.debug("Metrics events flushed successfully");
        });
      }, METRICS_FLUSH_INTERVAL_MS);
    }
  }

  /**
   * Stops the interval that periodically flushes the event buffer
   */
  private stopFlushInterval(): void {
    if (this._flushInterval !== null) {
      console.debug("Stopping metrics flush interval");
      clearInterval(this._flushInterval);
      this._flushInterval = null;
    }
  }

  /**
   * Adds a metrics event to the buffer. The event will be sent in the next flush.
   * @param event The metrics event to send
   */
  public sendMetricsEvent(event: MetricsEventUnion): void {
    try {
      console.debug("Adding metrics event to buffer:", event.event_type);
      this._eventBuffer.push(event);
    } catch (err) {
      console.error(new MetricsError("Failed to add metrics event to buffer", err));
    }
  }

  /**
   * Flushes all buffered events to the backend
   * @returns {Promise<void>}
   */
  private async flushEvents(): Promise<void> {
    if (this._eventBuffer.length === 0) {
      return;
    }

    console.debug(`Flushing ${this._eventBuffer.length} metrics events`);

    try {
      await customFetch(`${this.apiServerUrl}/metrics`, {
        method: "POST",
        expectedStatusCode: StatusCodes.ACCEPTED,
        serviceName: "MetricsService",
        serviceFunction: "flushEvents",
        failureMessage: "Failed to send metrics events",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(this._eventBuffer),
      });
    } catch (error) {
      console.error(error);
    } finally {
      // Clear the buffer regardless of the outcome
      this._eventBuffer = [];
    }
  }

  /**
   * Cleans up the service, stopping the flush interval
   * should be called by the consumer of this service when the service is no longer needed
   */
  public dispose(): void {
    this.stopFlushInterval();
    // we set the instance to null here to allow the service to be re-initialized
    // next time getInstance is called a new instance will be created with a new flush interval
    MetricsService.instance = null;
  }
}
