import { useId, type SVGProps } from 'react';

/**
 * Shared props every local art component accepts. `label` names the artwork
 * for assistive tech and for on-tap speech; omit it to mark the artwork as
 * purely decorative (aria-hidden).
 */
export interface ArtProps {
  label?: string;
  className?: string;
}

export function artA11yProps(artId: string, label?: string): SVGProps<SVGSVGElement> & Record<string, string> {
  if (label) {
    return {
      role: 'img',
      'aria-label': label,
      'data-art-id': artId,
    };
  }
  return {
    'aria-hidden': 'true',
    focusable: 'false',
    'data-art-id': artId,
  };
}

/**
 * Generates document-unique gradient/mask ids for an art component instance
 * so the same icon can render many times on one screen (counting clouds,
 * choice grids) without clashing SVG `id` definitions.
 */
export function useArtIds<Name extends string>(...names: Name[]): Record<Name, string> {
  const base = useId();
  const entries = names.map((name) => [name, `${base}${name}`] as const);
  return Object.fromEntries(entries) as Record<Name, string>;
}
