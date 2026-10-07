import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const STORAGE_KEY = "kubo-admin-theme";

export type ThemePreference = "light" | "dark" | "system";

function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function apply(preference: ThemePreference) {
  const dark = preference === "dark" || (preference === "system" && prefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

/**
 * Dark mode for the dashboard.
 *
 * The `dark` class goes on <html> because dialogs, dropdowns and toasts render
 * into a portal at the document root — scoping it to the dashboard's own
 * wrapper would leave those stuck in light mode. It is removed again when the
 * dashboard unmounts, so the public marketing pages keep their own styling.
 */
export function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>("system");

  useEffect(() => {
    let stored: ThemePreference = "system";
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark" || saved === "system") stored = saved;
    } catch {
      // Private browsing or blocked storage — fall back to following the OS.
    }

    setPreference(stored);
    apply(stored);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (stored === "system") apply("system");
    };
    media.addEventListener("change", onSystemChange);

    return () => {
      media.removeEventListener("change", onSystemChange);
      document.documentElement.classList.remove("dark");
    };
  }, []);

  function choose(next: ThemePreference) {
    setPreference(next);
    apply(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice still applies for this visit; it just will not be remembered.
    }
  }

  const Icon = preference === "dark" ? Moon : preference === "light" ? Sun : Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" title="Appearance">
          <Icon className="size-4" />
          <span className="sr-only">Change appearance</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => choose("light")}>
          <Sun className="size-4" />
          Light
          {preference === "light" ? <span className="ml-auto text-xs">✓</span> : null}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => choose("dark")}>
          <Moon className="size-4" />
          Dark
          {preference === "dark" ? <span className="ml-auto text-xs">✓</span> : null}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => choose("system")}>
          <Monitor className="size-4" />
          System
          {preference === "system" ? <span className="ml-auto text-xs">✓</span> : null}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
