import { Outlet } from "react-router-dom";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";

/**
 * Top-level admin layout: persistent sidebar on desktop, sticky header,
 * and a scrollable content region that renders the active admin route.
 */
export function AdminShell() {
  return (
    <div className="flex min-h-dvh bg-background">
      {/* Desktop sidebar */}
      <div className="sticky top-0 hidden h-dvh lg:block">
        <AdminSidebar />
      </div>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader />
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
