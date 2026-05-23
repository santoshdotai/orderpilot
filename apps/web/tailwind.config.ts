import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#101828",
        panel: "#162033",
        mist: "#D5E2F3",
        coral: "#FF7A59",
        sand: "#FFF2D8",
        mint: "#48CFAE",
        gold: "#F5B63D",
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        body: ["Instrument Sans", "sans-serif"],
      },
      boxShadow: {
        float: "0 24px 60px rgba(12, 24, 44, 0.24)",
      },
      backgroundImage: {
        "hero-mesh":
          "radial-gradient(circle at top left, rgba(255,122,89,0.24), transparent 34%), radial-gradient(circle at 85% 20%, rgba(72,207,174,0.18), transparent 26%), radial-gradient(circle at bottom right, rgba(245,182,61,0.18), transparent 24%)",
      },
    },
  },
  plugins: [],
} satisfies Config;
