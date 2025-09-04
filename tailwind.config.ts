import type { Config } from "tailwindcss";

const config: Config = {
  // Tells Tailwind where to look for classNames in your project
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],

  theme: {
    extend: {
      // You can add custom colors, fonts, spacing, etc. here later if needed
    },
  },

  plugins: [],
};

export default config;
