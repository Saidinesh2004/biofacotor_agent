import { Outlet } from "react-router-dom";
import { TopNav } from "./TopNav";
import { AgricultureBackground } from "./AgricultureBackground";

export function Layout() {
  return (
    <div className="flex flex-col h-screen overflow-hidden relative bg-background">
      {/* Ambient Agriculture Animated Background */}
      <AgricultureBackground />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
          <div className="max-w-[1400px] mx-auto animate-fade-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
