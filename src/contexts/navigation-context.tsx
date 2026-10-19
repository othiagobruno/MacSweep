import { createContext, useContext } from "react";
import type { Page } from "../types";

interface NavigationContextType {
  currentPage: Page;
  navigate: (page: Page) => void;
}

export const NavigationContext = createContext<NavigationContextType | null>(null);

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) throw new Error("useNavigation must be used within NavigationContext");
  return context;
}

/** Whether the calling page is the one currently on screen. */
export function useIsActivePage(page: Page): boolean {
  return useNavigation().currentPage === page;
}
