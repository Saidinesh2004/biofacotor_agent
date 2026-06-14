import { Bell, Menu, Search, SunMoon, User } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TopNav({ toggleSidebar }: { toggleSidebar: () => void }) {
  return (
    <header className="h-16 glass sticky top-0 z-30 flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center">
        <Button variant="ghost" size="icon" className="md:hidden mr-2" onClick={toggleSidebar}>
          <Menu className="h-5 w-5" />
        </Button>
        <div className="hidden md:flex relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          <input 
            type="text" 
            placeholder="Search farmers, campaigns..." 
            className="h-9 w-64 lg:w-96 bg-slate-900/50 border border-white/10 rounded-full pl-9 pr-4 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-slate-500"
          />
        </div>
      </div>

      <div className="flex items-center space-x-2 md:space-x-4">
        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white rounded-full">
          <SunMoon className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white relative rounded-full">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full animate-pulse"></span>
        </Button>
        <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center cursor-pointer border border-white/10 hover-glow">
          <User className="h-4 w-4 text-white" />
        </div>
      </div>
    </header>
  );
}
