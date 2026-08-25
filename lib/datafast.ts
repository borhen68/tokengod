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
  if (typeof window === "undefined") return;
  window.datafast?.(eventName, properties);
}
