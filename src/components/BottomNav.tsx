import { NavLink } from "react-router-dom";
import { Home, Dumbbell, Users, Target, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", icon: Home, label: "Início" },
  { to: "/workouts", icon: Dumbbell, label: "Treinos" },
  { to: "/social", icon: Users, label: "Social" },
  { to: "/goals", icon: Target, label: "Metas" },
  { to: "/profile", icon: User, label: "Perfil" },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-dock pointer-events-none">
      <div className="mx-auto max-w-md px-4 pb-safe pt-2">
        <div className="glass-strong pointer-events-auto rounded-full px-3 py-3 shadow-pill">
          <ul className="flex items-center justify-between gap-1">
            {items.map(({ to, icon: Icon, label }) => (
              <li key={to} className="flex-1">
                <NavLink
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "group relative flex items-center justify-center gap-2 rounded-full px-3 py-3.5 transition-all duration-300",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-glow"
                        : "text-muted-foreground hover:text-foreground",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className="h-[24px] w-[24px] shrink-0" strokeWidth={2.4} />
                      <span
                        className={cn(
                          "overflow-hidden whitespace-nowrap text-[13px] font-bold transition-all duration-300",
                          isActive ? "max-w-[120px] opacity-100" : "max-w-0 opacity-0",
                        )}
                      >
                        {label}
                      </span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}
