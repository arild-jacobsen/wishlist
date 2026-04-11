import type { Config } from "tailwindcss";

const config: Config = {
  // Enable class-based dark mode so we can toggle it from JavaScript.
  // Adding/removing the "dark" class on <html> switches all dark: variants.
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
