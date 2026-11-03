"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  ClipboardCheck,
  Wrench,
  FolderOpen,
  Mail,
  Settings,
  Menu,
  X,
  LogOut,
  LayoutList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/login/actions";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/quotations", label: "Quotations", icon: FileText },
  { href: "/cr", label: "CR documents", icon: ClipboardCheck },
  { href: "/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/documents", label: "Documents", icon: FolderOpen },
  { href: "/emails", label: "Email log", icon: Mail },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

type Props = {
  userName: string;
  userEmail: string;
  children: React.ReactNode;
};

export function AppShell({ userName, userEmail, children }: Props) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const pathname = usePathname();

  // Lock page scroll while the mobile drawer is open.
  React.useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const nav = (
    <nav aria-label="Main" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={() => setDrawerOpen(false)}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-active text-white"
                : "text-sidebar-text hover:bg-sidebar-hover hover:text-white",
            )}
          >
            <Icon className={cn("size-[18px] shrink-0", active ? "text-indigo-300" : "text-slate-400 group-hover:text-slate-200")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-3 px-5 py-5">
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-white shadow-lg shadow-indigo-950/40">
        <LayoutList className="size-5" />
      </span>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-white">Client Manager</p>
        <p className="text-xs text-slate-400">Documents & clients</p>
      </div>
    </div>
  );

  const userFooter = (
    <div className="border-t border-white/10 p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-semibold text-indigo-200">
          {initials || "U"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{userName}</p>
          <p className="truncate text-xs text-slate-400">{userEmail}</p>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            title="Sign out"
            aria-label="Sign out"
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-sidebar-hover hover:text-white"
          >
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:flex">
      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-sidebar lg:flex">
        {brand}
        {nav}
        {userFooter}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="no-print fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="animate-fade-up absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-sidebar shadow-pop">
            <div className="flex items-center justify-between">
              {brand}
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation"
                className="mr-3 rounded-lg p-2 text-slate-400 hover:bg-sidebar-hover hover:text-white"
              >
                <X className="size-5" />
              </button>
            </div>
            {nav}
            {userFooter}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar, visible on small screens only (desktop uses the sidebar) */}
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground"
          >
            <Menu className="size-5" />
          </button>
          <span className="text-sm font-semibold">Client Manager</span>
        </header>

        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
