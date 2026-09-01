type DataFastProperty = string | number | boolean | null | undefined;

declare global {
  interface Window {
    datafast?: (eventName: string, properties?: Record<string, DataFastProperty>) => void;
  }
}

export function trackDataFast(
  eventName: string,
  properties: Record<string, DataFastProperty> = {},
) {
  if (typeof window === "undefined" || !window.datafast) return;

  const sanitized = Object.fromEntries(
    Object.entries(properties)
      .filter(([, value]) => value !== null && value !== undefined)
      .slice(0, 10)
      .map(([key, value]) => [key.slice(0, 64), String(value).slice(0, 255)]),
  );

  window.datafast(eventName.slice(0, 64), sanitized);
}
