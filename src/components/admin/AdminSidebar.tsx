import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";
import { adminNav } from "./adminNav";

interface AdminSidebarProps {
  /** Called when a link is tapped — used to close the mobile drawer. */
  onNavigate?: () => void;
}

/**
 * Fixed left navigation for the admin panel. Rendered persistently on
 * desktop (lg+) and inside a slide-over drawer on mobile.
 */
export function AdminSidebar({ onNavigate }: AdminSidebarProps) {
  return (
    <aside className="flex h-full w-64 flex-col gap-6 border-r border-border/60 bg-[hsl(140_8%_6%)] px-4 py-6">
      {/* Brand */}
      <NavLink
        to="/admin/dashboard"
        onClick={onNavigate}
        className="flex items-center gap-3 px-2"
      >
        <img src={logo} alt="FitFlow" className="h-9 w-9 rounded-xl object-contain" />
        <div className="leading-tight">
          <p className="font-display text-lg font-bold tracking-tight">
            FitFlow<span className="text-primary">.</span>
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Admin
          </p>
        </div>
      </NavLink>

      {/* Nav */}
      <nav className="no-scrollbar flex flex-1 flex-col gap-1 overflow-y-auto">
        {adminNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0 transition",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                  )}
                />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer card */}
      <div className="rounded-2xl border border-border/60 bg-secondary/60 p-3">
        <p className="text-xs font-semibold">Plano Operacional</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Tudo funcionando normalmente.
        </p>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          <span className="text-[11px] text-success">Sistemas online</span>
        </div>
      </div>
    </aside>
  );
}
