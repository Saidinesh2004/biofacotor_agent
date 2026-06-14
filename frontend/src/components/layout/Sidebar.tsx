import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  Megaphone, 
  Phone, 
  MessageCircle, 
  MessagesSquare, 
  BarChart3,
  Leaf
} from "lucide-react";
import { cn } from "@/lib/utils";

const sidebarLinks = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Farmers", href: "/farmers", icon: Users },
  { name: "Campaigns", href: "/campaigns", icon: Megaphone },
  { name: "Voice Calls", href: "/voice-calls", icon: Phone },
  { name: "WhatsApp Broadcast", href: "/whatsapp", icon: MessageCircle },
  { name: "Responses", href: "/responses", icon: MessagesSquare },
  { name: "Reports", href: "/reports", icon: BarChart3 },
];

export function Sidebar({ isOpen, setIsOpen }: { isOpen: boolean; setIsOpen: (val: boolean) => void }) {
  const location = useLocation();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 glass-card border-r border-white/5 transition-transform duration-300 md:translate-x-0 md:static flex flex-col",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-16 flex items-center px-6 border-b border-white/5">
          <Leaf className="h-6 w-6 text-primary mr-2" />
          <span className="text-xl font-bold text-gradient">Biofactor AI</span>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto hide-scrollbar">
          {sidebarLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.href;
            return (
              <Link
                key={link.name}
                to={link.href}
                className={cn(
                  "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                  isActive 
                    ? "bg-primary/10 text-primary border border-primary/20" 
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                )}
                onClick={() => setIsOpen(false)}
              >
                <Icon className={cn("mr-3 h-5 w-5", isActive ? "text-primary" : "text-slate-400 group-hover:text-slate-100")} />
                {link.name}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
