// Get coordinates using geolocation API
export const getCoordinates = async (): Promise<[number, number]> => {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation is not supported by your browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve([roundToDecimalPlace(position.coords.latitude), roundToDecimalPlace(position.coords.longitude)]);
      },
      (error) => {
        reject(error);
      }
    );
  });
};

function roundToDecimalPlace(num: number): number {
  // add some random value to anonymize the location even further
  const randomValue = Math.random() * 0.8 + 0.1;
  return Math.round((num + randomValue) * 10) / 10;
}