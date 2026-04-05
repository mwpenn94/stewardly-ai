/**
 * SEOHead — Sets document title and meta tags for SEO.
 * Uses useEffect to update document.title and meta tags dynamically.
 */
import { useEffect } from "react";

interface SEOHeadProps {
  title: string;
  description?: string;
  ogImage?: string;
  ogType?: string;
  canonical?: string;
  noIndex?: boolean;
}

export function SEOHead({
  title,
  description,
  ogImage,
  ogType = "website",
  canonical,
  noIndex = false,
}: SEOHeadProps) {
  useEffect(() => {
    const suffix = " | Stewardly AI";
    document.title = title.includes("Stewardly") ? title : `${title}${suffix}`;

    const setMeta = (name: string, content: string, property = false) => {
      const attr = property ? "property" : "name";
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.content = content;
    };

    if (description) {
      setMeta("description", description);
      setMeta("og:description", description, true);
    }
    setMeta("og:title", title, true);
    setMeta("og:type", ogType, true);
    if (ogImage) setMeta("og:image", ogImage, true);
    if (noIndex) setMeta("robots", "noindex, nofollow");

    // Canonical link
    if (canonical) {
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.rel = "canonical";
        document.head.appendChild(link);
      }
      link.href = canonical;
    }
  }, [title, description, ogImage, ogType, canonical, noIndex]);

  return null;
}
