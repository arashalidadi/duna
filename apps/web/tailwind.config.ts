import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        /*
         * Public marketing site palette (landing page). Deep-ocean navy scale +
         * a single restrained brass signal. Additive — the ERP semantic tokens
         * above are untouched and remain the system of record for the dashboard.
         */
        brand: {
          950: 'hsl(var(--brand-950))',
          900: 'hsl(var(--brand-900))',
          800: 'hsl(var(--brand-800))',
          700: 'hsl(var(--brand-700))',
          600: 'hsl(var(--brand-600))',
          500: 'hsl(var(--brand-500))',
          400: 'hsl(var(--brand-400))',
          300: 'hsl(var(--brand-300))',
          200: 'hsl(var(--brand-200))',
          100: 'hsl(var(--brand-100))',
          50: 'hsl(var(--brand-50))',
        },
        brass: {
          600: 'hsl(var(--brass-600))',
          500: 'hsl(var(--brass-500))',
          400: 'hsl(var(--brass-400))',
          300: 'hsl(var(--brass-300))',
          200: 'hsl(var(--brass-200))',
          100: 'hsl(var(--brass-100))',
        },

        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          hover: 'hsl(var(--primary-hover))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};

export default config;