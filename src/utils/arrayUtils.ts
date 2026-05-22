/**
 * Safely converts any value to an array.
 * If the value is already an array, it returns it.
 * If the value is null, undefined, or not an array, it returns an empty array [].
 * This guarantees that .map(), .filter(), and .length will never crash the UI.
 */
export function toArray<T>(value: T[] | any): T[] {
  return Array.isArray(value) ? value : [];
}
