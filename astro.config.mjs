import { defineConfig } from "astro/config";
import icon from "astro-icon";

// https://astro.build/config
export default defineConfig({
  image: {
    responsiveStyles: true,
    layout: "constrained",
  },
  experimental: {
    clientPrerender: true,
  },
  prefetch: {
    prefetchAll: true,
  },
  integrations: [icon()],
});
