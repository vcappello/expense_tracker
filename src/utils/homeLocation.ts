const HOME_LOCATION_STORAGE_KEY = 'expense-tracker-home-location-v1';

export const HOME_LOCATION_RADIUS_METERS = 100;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

const isCoordinates = (value: unknown): value is Coordinates => {
  if (typeof value !== 'object' || value === null) return false;
  const coordinates = value as Record<string, unknown>;
  return (
    typeof coordinates.latitude === 'number' &&
    Number.isFinite(coordinates.latitude) &&
    coordinates.latitude >= -90 &&
    coordinates.latitude <= 90 &&
    typeof coordinates.longitude === 'number' &&
    Number.isFinite(coordinates.longitude) &&
    coordinates.longitude >= -180 &&
    coordinates.longitude <= 180
  );
};

export const loadHomeLocation = (): Coordinates | null => {
  const stored = localStorage.getItem(HOME_LOCATION_STORAGE_KEY);
  if (!stored) return null;

  const parsed: unknown = JSON.parse(stored);
  if (!isCoordinates(parsed)) {
    throw new Error('La posizione casa salvata non è valida');
  }
  return parsed;
};

export const saveHomeLocation = (coordinates: Coordinates): void => {
  if (!isCoordinates(coordinates)) {
    throw new Error('Le coordinate della posizione casa non sono valide');
  }
  localStorage.setItem(HOME_LOCATION_STORAGE_KEY, JSON.stringify(coordinates));
};

export const removeHomeLocation = (): void => {
  localStorage.removeItem(HOME_LOCATION_STORAGE_KEY);
};

export const isWithinHomeRadius = (
  coordinates: Coordinates,
  homeLocation: Coordinates
): boolean => {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = radians(homeLocation.latitude - coordinates.latitude);
  const longitudeDelta = radians(homeLocation.longitude - coordinates.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(coordinates.latitude)) *
      Math.cos(radians(homeLocation.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  const boundedHaversine = Math.min(1, Math.max(0, haversine));
  const distance =
    2 *
    earthRadiusMeters *
    Math.atan2(Math.sqrt(boundedHaversine), Math.sqrt(1 - boundedHaversine));

  return distance <= HOME_LOCATION_RADIUS_METERS;
};
