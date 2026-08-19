import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        display: ["Space Grotesk", "sans-serif"],
        serif: ["Cormorant Garamond", "Georgia", "Times New Roman", "serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 15px hsl(204 100% 50% / 0.3)" },
          "50%": { boxShadow: "0 0 25px hsl(204 100% 50% / 0.6)" },
        },
        "emoji-float": {
          "0%": { opacity: "1", transform: "translateY(0) scale(0.5)" },
          "80%": { opacity: "0.6", transform: "translateY(-350px) scale(1.8)" },
          "100%": { opacity: "0", transform: "translateY(-400px) scale(1.8)" },
        },
        "emoji-wobble": {
          "0%, 100%": { transform: "rotate(0deg) scaleX(1) scaleY(1)" },
          "25%": { transform: "rotate(-8deg) scaleX(1.05) scaleY(0.95)" },
          "50%": { transform: "rotate(8deg) scaleX(0.95) scaleY(1.05)" },
          "75%": { transform: "rotate(-6deg) scaleX(1) scaleY(1)" },
        },
        "create-wave": {
          "0%, 100%": { transform: "rotate(0deg)" },
          "10%": { transform: "rotate(22deg)" },
          "22%": { transform: "rotate(-16deg)" },
          "34%": { transform: "rotate(24deg)" },
          "46%": { transform: "rotate(-14deg)" },
          "58%": { transform: "rotate(20deg)" },
          "70%": { transform: "rotate(-10deg)" },
          "82%": { transform: "rotate(8deg)" },
        },
        "poker-deal": {
          "0%": { opacity: "0", transform: "translateY(-18px) scale(0.6) rotate(-8deg)" },
          "60%": { opacity: "1", transform: "translateY(2px) scale(1.05) rotate(2deg)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1) rotate(0deg)" },
        },
        "poker-banner": {
          "0%": { opacity: "0", transform: "scale(0.7) translateY(6px)" },
          "12%": { opacity: "1", transform: "scale(1.06) translateY(0)" },
          "22%": { opacity: "1", transform: "scale(1) translateY(0)" },
          "82%": { opacity: "1", transform: "scale(1) translateY(0)" },
          "100%": { opacity: "0", transform: "scale(0.94) translateY(-4px)" },
        },
        "poker-winner-glow": {
          "0%, 100%": { boxShadow: "0 0 10px hsl(45 100% 55% / 0.5)" },
          "50%": { boxShadow: "0 0 26px hsl(45 100% 60% / 0.9)" },
        },
        "poker-twinkle": {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "0.95" },
        },
        "poker-chip-pop": {
          "0%": { opacity: "0", transform: "scale(0.5) translateY(6px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "poker-pot-pulse": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.08)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "emoji-float": "emoji-float 4.5s ease-out forwards",
        "emoji-wobble": "emoji-wobble 0.5s ease-in-out infinite",
        "create-wave": "create-wave 0.72s ease-in-out forwards",
        "poker-deal": "poker-deal 0.42s cubic-bezier(0.16,1,0.3,1) both",
        "poker-banner": "poker-banner 1.7s ease-in-out forwards",
        "poker-winner-glow": "poker-winner-glow 1.1s ease-in-out infinite",
        "poker-twinkle": "poker-twinkle 2.4s ease-in-out infinite",
        "poker-chip-pop": "poker-chip-pop 0.3s cubic-bezier(0.16,1,0.3,1) both",
        "poker-pot-pulse": "poker-pot-pulse 0.5s ease-in-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
