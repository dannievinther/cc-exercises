import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  image: {
    responsiveStyles: true,
    layout: "constrained",
  },
  experimental: {
    clientPrerender: true,
    svgo: true,
    fonts: [
      {
        provider: "local",
        name: "Mona Sans",
        cssVariable: "--font-mona",
        fallbacks: ["system-ui", "sans-serif"],
        variants: [
          {
            weight: "200 900",
            stretch: "75% 125%",
            style: "normal",
            src: ["./src/assets/fonts/Mona-Sans.woff2"],
          },
        ],
      },
      {
        provider: "local",
        name: "OpMn",
        cssVariable: "--font-mono",
        fallbacks: ["Consolas", "Monaco", "monospace"],
        variants: [
          {
            weight: 500,
            style: "normal",
            src: ["./src/assets/fonts/OperatorMono-Medium.woff2"],
          },
        ],
      },
      {
        provider: "local",
        name: "flex",
        cssVariable: "--font-flex",
        fallbacks: ["sans-serif"],
        variants: [
          {
            weight: 700,
            stretch: "200% 1000%",
            style: "normal",
            src: ["./src/assets/fonts/flexible-variable.woff2"],
          },
        ],
      },
    ],
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "viewport",
  },
});
