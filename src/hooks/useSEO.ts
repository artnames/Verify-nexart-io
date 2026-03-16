import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description: string;
  path: string;
  type?: 'website' | 'article';
}

const BASE_URL = 'https://verify.nexart.io';

/**
 * Sets document head meta tags and canonical link for SEO.
 * Call once per page component.
 */
export function useSEO({ title, description, path, type = 'website' }: SEOProps) {
  useEffect(() => {
    const url = `${BASE_URL}${path}`;

    document.title = title;

    setMeta('description', description);
    setMeta('og:title', title, 'property');
    setMeta('og:description', description, 'property');
    setMeta('og:url', url, 'property');
    setMeta('og:type', type, 'property');
    setMeta('twitter:title', title, 'name');
    setMeta('twitter:description', description, 'name');

    // Canonical
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = url;

    return () => {
      canonical?.remove();
    };
  }, [title, description, path, type]);
}

function setMeta(key: string, value: string, attr: 'name' | 'property' = 'name') {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = value;
}
