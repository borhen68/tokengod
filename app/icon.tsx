import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, background: "#bfff5b", borderRadius: 14 }}>
      {[25, 36, 25].map((width, index) => <span key={index} style={{ width, height: 5, display: "flex", borderRadius: 99, background: "#07141e" }} />)}
    </div>,
    size,
  );
}
