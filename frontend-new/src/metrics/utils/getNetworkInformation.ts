import { NetworkInformationEvent } from "src/metrics/types";

/**
 * Function to get network information for metrics recording.
 * @returns NetworkInformationEvent object containing network-related information
 */
export const getNetworkInformation = (): Omit<NetworkInformationEvent, "event_type" | "user_id"> => {
  // navigator.connection has limited support across browsers
  // see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/connection
  const connection = (navigator as any).connection;

  // Get effective connection type
  // slow-2g, 2g, 3g, or 4g
  const effectiveConnectionType = connection?.effectiveType ?? "UNKNOWN";

  return {
    effective_connection_type: effectiveConnectionType
  };
}; 