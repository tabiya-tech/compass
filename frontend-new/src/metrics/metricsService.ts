import { getBackendUrl } from "src/envService";
import { MetricsEventUnion } from "src/metrics/types";

export default class MetricsService {
  readonly apiServerUrl: string;
  private static instance: MetricsService;

  private constructor() {
    this.apiServerUrl = getBackendUrl();
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
   * Sends a metrics event to the backend.
   * @param event The metrics event to send
   * @returns {Promise<void>}
   */
  public async sendMetricsEvent(event: MetricsEventUnion): Promise<void> {
    const metricsURL = `${this.apiServerUrl}/metrics`;

    try {
      const response = await fetch(metricsURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        console.error("Failed to send metrics event:", await response.text());
      }
    } catch (error) {
      // We don't want metrics failures to affect the user experience
      console.error("Error sending metrics event:", error);
    }
  }
}
