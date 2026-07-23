"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileSpreadsheet,
  LayoutDashboard,
  LayoutTemplate,
  Menu,
  Search,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { CommandPalette } from "@/components/search/command-palette";
import { VoiceSheetsMark } from "@/components/brand/voicesheets-mark";
import { BinariaLogo } from "@/components/brand/binaria-logo";

export interface ShellUser {
  name: string | null;
  email: string;
  imageUrl: string | null;
}

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/spreadsheets", label: "Spreadsheets", icon: FileSpreadsheet },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({
  user,
  clerkEnabled,
  children,
}: {
  user: ShellUser;
  clerkEnabled: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const initials =
    (user.name ?? user.email)
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  const sidebar = (
    <div className="flex h-full flex-col gap-1 p-3">
      <Link href="/dashboard" className="mb-4 flex items-center gap-2 px-2 py-1">
        <VoiceSheetsMark className="h-7 w-7" />
        <span className="font-display text-lg font-bold tracking-tight">VoiceSheets</span>
      </Link>
      <nav className="flex flex-col gap-0.5">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all",
                active
                  ? "bg-primary/10 text-primary shadow-sm shadow-primary/5"
                  : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-2">
        <div className="rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Tip</p>
          <p className="mt-1">
            Press <kbd className="rounded border bg-background px-1">⌘K</kbd> to search anything.
          </p>
        </div>
        <a
          href="https://binariaanalytics.com"
          target="_blank"
          rel="noreferrer"
          className="flex flex-col items-center gap-1 rounded-xl border bg-card px-3 py-2.5 shadow-soft transition-colors hover:bg-accent/40"
        >
          <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/70">
            Powered by
          </span>
          <BinariaLogo className="text-[15px]" />
        </a>
      </div>
    </div>
  );

  return (
    <div className="vs-app-bg flex min-h-screen w-full bg-muted/40">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r bg-background md:block">{sidebar}</aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 border-r bg-background shadow-xl">
            <div className="flex justify-end p-2">
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex h-9 w-full max-w-sm items-center gap-2 rounded-full border bg-muted/40 px-4 text-sm text-muted-foreground transition-colors hover:bg-muted hover:shadow-sm"
          >
            <Search className="h-4 w-4" />
            <span>Search…</span>
            <kbd className="ml-auto hidden rounded-full border bg-background px-2 text-[10px] sm:inline">
              ⌘K
            </kbd>
          </button>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <div className="flex items-center gap-2 pl-1">
              <Avatar>
                {user.imageUrl && <AvatarImage src={user.imageUrl} alt={user.name ?? user.email} />}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden text-sm leading-tight sm:block">
                <div className="font-medium">{user.name ?? "You"}</div>
                <div className="text-xs text-muted-foreground">
                  {clerkEnabled ? user.email : "Dev mode"}
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
