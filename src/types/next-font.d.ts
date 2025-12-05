import { NextFont } from 'next/dist/compiled/@next/font';

declare module 'next/font/google' {
  export function Inter(options: {
    subsets?: Array<'latin' | 'latin-ext' | 'cyrillic' | 'cyrillic-ext' | 'greek' | 'greek-ext' | 'vietnamese'>;
    display?: 'auto' | 'block' | 'swap' | 'fallback' | 'optional';
    variable?: string;
    preload?: boolean;
    fallback?: string[];
    adjustFontFallback?: boolean | string;
    weight?: string | number | Array<string | number>;
    style?: 'normal' | 'italic' | Array<'normal' | 'italic'>;
    axes?: string[];
  }): NextFont;
}
