import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://tokengod.lol").replace(/\/$/, "");

  return {
    rules: [
      { userAgent: "*", allow: "/" },
      { userAgent: ["Twitterbot", "facebookexternalhit", "LinkedInBot"], allow: "/" },
    ],
    host: siteUrl,
  };
}
