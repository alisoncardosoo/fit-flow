import { BottomNav } from "@/components/BottomNav";
import { RouteTransition } from "@/components/RouteTransition";
import { PushBridge } from "@/components/PushBridge";

export function AppShell() {
  return (
    <div className="relative min-h-screen">
      {/* Page content reserves dock space via pb-dock on each route container,
          so AppShell intentionally does NOT pad the bottom here. */}
      <div className="mx-auto max-w-md">
        <RouteTransition />
      </div>
      <BottomNav />
      <PushBridge />
    </div>
  );
}
