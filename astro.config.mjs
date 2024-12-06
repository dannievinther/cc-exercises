import { defineConfig } from "astro/config";
import icon from "astro-icon";

// https://astro.build/config
export default defineConfig({
  image: {
    experimentalLayout: "responsive",
  },
  experimental: {
    responsiveImages: true,
    clientPrerender: true,
  },
  prefetch: {
    prefetchAll: true,
  },
  integrations: [icon()],
});
