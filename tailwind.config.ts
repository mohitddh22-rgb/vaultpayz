import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: "#C9A227",
          light: "#E8D27A",
          dark: "#9A7B12",
        },
        ink: "#0B1020",
      },
    },
  },
  plugins: [],
};

export default config;
