import { useEffect, useRef } from 'react';

const BASE_URL = 'https://verify.nexart.io';

/** Injects a JSON-LD script tag and removes it on unmount. */
export function useJsonLd(data: Record<string, unknown> | Record<string, unknown>[]) {
  const ref = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
    ref.current = script;
    return () => { script.remove(); };
  }, [JSON.stringify(data)]);
}

/** Organization schema for NexArt — reusable across pages. */
export const nexartOrganization = {
  '@type': 'Organization',
  name: 'NexArt',
  url: 'https://nexart.io',
  sameAs: [
    'https://docs.nexart.io',
    'https://nexart.io/protocol',
  ],
};

/** Build a BreadcrumbList schema. */
export function buildBreadcrumbs(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${BASE_URL}${item.path}`,
    })),
  };
}

/** Build a WebPage schema. */
export function buildWebPage(opts: { name: string; description: string; path: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: opts.name,
    description: opts.description,
    url: `${BASE_URL}${opts.path}`,
    isPartOf: {
      '@type': 'WebSite',
      name: 'NexArt Verification Portal',
      url: BASE_URL,
    },
    publisher: nexartOrganization,
  };
}
