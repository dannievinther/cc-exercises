import { defineConfig, fontProviders } from "astro/config";

// https://astro.build/config
export default defineConfig({
  image: {
    responsiveStyles: true,
    layout: "constrained",
  },
  svgo: true,
  compressHTML: true,
  fonts: [
    {
      provider: fontProviders.local(),
      name: "Mona Sans",
      cssVariable: "--font-mona",
      fallbacks: ["system-ui", "sans-serif"],
      options: {
        variants: [
          {
            weight: "200 900",
            stretch: "75% 125%",
            style: "normal",
            src: ["./src/assets/fonts/Mona-Sans.woff2"],
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: "OpMn",
      cssVariable: "--font-mono",
      fallbacks: ["Consolas", "Monaco", "monospace"],
      options: {
        variants: [
          {
            weight: 500,
            style: "normal",
            src: ["./src/assets/fonts/OperatorMono-Medium.woff2"],
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: "flex",
      cssVariable: "--font-flex",
      fallbacks: ["sans-serif"],
      options: {
        variants: [
          {
            weight: 700,
            stretch: "200% 1000%",
            style: "normal",
            src: ["./src/assets/fonts/flexible-variable.woff2"],
          },
        ],
      },
    },
  ],
  experimental: {
    clientPrerender: true,
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "viewport",
  },
});
