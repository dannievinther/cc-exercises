/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

// Extend HTML anchor attributes for experimental web platform features
declare namespace astroHTML.JSX {
  interface AnchorHTMLAttributes {
    interestfor?: string;
  }
}
