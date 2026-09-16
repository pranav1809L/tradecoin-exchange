import React, { createContext, useContext, useEffect, useState } from "react";

export type SiteTheme = "dark" | "glass" | "light" | "fintech" | "cyberpunk";

interface ThemeContextType {
  theme: SiteTheme;
  setTheme: (theme: SiteTheme) => void;
  toggleTheme?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: SiteTheme;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<SiteTheme>(() => {
    if (switchable) {
      const stored = localStorage.getItem("tradecoin-site-theme");
      return (stored as SiteTheme) || defaultTheme;
    }
    return defaultTheme;
  });

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.siteTheme = theme;
    root.classList.toggle("dark", theme !== "light");

    if (switchable) {
      localStorage.setItem("tradecoin-site-theme", theme);
    }
  }, [theme, switchable]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme: () => setTheme(prev => prev === "light" ? "dark" : "light"), switchable }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
