import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: ".vite/renderer/main_window",
    }),
    router: {
      type: "hash",
    },
  },
};

export default config;
