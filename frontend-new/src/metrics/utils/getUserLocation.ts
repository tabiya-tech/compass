// Get coordinates using geolocation API
export const getCoordinates = async (): Promise<[number, number]> => {
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