import type { MetadataRoute } from "next";
import { AI_CRAWLERS } from "@hm/shared/crawlers";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      ...AI_CRAWLERS.map((ua) => ({ userAgent: ua, disallow: "/" })),
      { userAgent: "*", allow: "/", disallow: ["/api/", "/gallery", "/portfolio", "/u/", "/verify/", "/write", "/settings"] },
    ],
  };
}
