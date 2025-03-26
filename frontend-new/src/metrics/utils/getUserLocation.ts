import { UserLocationEvent } from "src/metrics/types";

/**
 * Function to get user location and IP address for metrics recording.
 * @returns Promise<UserLocationEvent> object containing location and IP information
 */
export const getUserLocation = async (): Promise<Omit<UserLocationEvent, "event_type" | "user_id">> => {
  try {
    const [coordinates, ip_address] = await Promise.all([
      _getCoordinates(),
      _getIP()
    ]);

    return {
      coordinates,
      ip_address
    };
  } catch (error) {
    console.debug("Failed to get user location:", error);
    return {
      coordinates: [0, 0],
      ip_address: "UNKNOWN"
    };
  }
}; 

// Get IP address using ipify API
const _getIP = async (): Promise<string> => {
  try {
    const response = await fetch("https://api64.ipify.org?format=json");
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.debug("Failed to get IP address:", error);
    return "UNKNOWN";
  }
};

// Get coordinates using geolocation API
const _getCoordinates = async (): Promise<[number, number]> => {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation is not supported by your browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve([position.coords.latitude, position.coords.longitude]);
      },
      (error) => {
        reject(error);
      }
    );
  });
};