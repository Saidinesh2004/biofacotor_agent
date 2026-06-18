import { useState, useEffect } from "react";
import { User, Loader2, Check, Plus, Leaf, Wifi, WifiOff } from "lucide-react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import api from "@/lib/api";

const navItems = [
  { name: "Dashboard", href: "/" },
  { name: "Farmers", href: "/farmers" },
  { name: "Campaigns", href: "/campaigns" },
  { name: "Responses", href: "/responses" },
  { name: "Reports", href: "/reports" },
];

const cn = (...classes: string[]) => classes.filter(Boolean).join(" ");

export function TopNav() {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Profile Data States
  const [profile, setProfile] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const fetchProfile = async () => {
    try {
      const res = await api.get("/admins/profile");
      setProfile(res.data);
      setFullName(res.data.full_name || "");
      setPhone(res.data.phone_number || "");
      setEmail(res.data.email || "");
    } catch (error) {
      console.error("Failed to load admin profile", error);
    }
  };

  useEffect(() => {
    fetchProfile();
    const handleProfileUpdateEvent = () => {
      fetchProfile();
    };
    window.addEventListener("profile-updated", handleProfileUpdateEvent);
    
    // Connection health checker
    const checkConnection = async () => {
      try {
        await api.get("/");
        setIsConnected(true);
      } catch (err) {
        setIsConnected(false);
      }
    };
    checkConnection();
    const interval = setInterval(checkConnection, 10000);

    return () => {
      window.removeEventListener("profile-updated", handleProfileUpdateEvent);
      clearInterval(interval);
    };
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMsg("Full Name is required.");
      return;
    }

    // Phone number validation: must be at least 6 digits
    if (phone) {
      const digitCount = phone.replace(/\D/g, "").length;
      if (digitCount < 6) {
        setErrorMsg("Phone number must contain at least 6 digits.");
        return;
      }
    }

    try {
      setSaving(true);
      setErrorMsg("");
      setSuccessMsg("");

      // Update profile data
      await api.put("/admins/profile", {
        full_name: fullName,
        phone_number: phone,
        email: email
      });

      setSuccessMsg("Profile updated successfully!");
      
      // Dispatch custom event to notify Dashboard and layout
      window.dispatchEvent(new Event("profile-updated"));

      setTimeout(() => {
        setIsProfileOpen(false);
        setSuccessMsg("");
      }, 1000);

    } catch (error: any) {
      setErrorMsg(error.response?.data?.detail || "Failed to save profile changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="h-20 sticky top-0 z-30 flex items-center justify-between px-6 bg-white/80 backdrop-blur-xl border-b border-black/[0.06] shadow-sm select-none">
        
        {/* Left Side: Brand Logo */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#22C55E] to-[#14B8A6] flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300">
                <Leaf className="h-5 w-5 text-white" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#84CC16] border-2 border-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-gradient leading-none tracking-tight">Biofactor</span>
              <span className="text-[10px] uppercase tracking-[0.15em] text-[#475569] font-medium mt-1">Agri-Tech</span>
            </div>
          </Link>
        </div>

        {/* Center: Premium Tab-based Links */}
        <div className="hidden lg:flex items-center gap-1.5 p-1 bg-black/[0.02] border border-black/[0.04] rounded-2xl">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "relative px-4 py-2 text-sm font-medium transition-all duration-300 rounded-xl border",
                  isActive 
                    ? "text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/20 shadow-sm" 
                    : "text-[#475569] border-transparent hover:text-[#0F172A] hover:bg-black/[0.02]"
                )}
              >
                <span className="relative z-10">{item.name}</span>
              </Link>
            );
          })}
        </div>

        {/* Right Side: Utilities */}
        <div className="flex items-center gap-4">
          
          {/* Connection Status Icon */}
          <div 
            className="flex items-center justify-center h-9 w-9 rounded-xl hover:bg-black/[0.02] transition-colors cursor-help"
            title={isConnected === null ? "Connecting to backend..." : isConnected ? "Backend Connected" : "Backend Offline"}
          >
            {isConnected === null ? (
              <Loader2 className="h-4.5 w-4.5 text-[#475569] animate-spin" />
            ) : isConnected ? (
              <Wifi className="h-4.5 w-4.5 text-[#22C55E] animate-pulse" strokeWidth={2.5} />
            ) : (
              <WifiOff className="h-4.5 w-4.5 text-red-500" strokeWidth={2.5} />
            )}
          </div>

          {/* New Campaign button */}
          <Button
            onClick={() => navigate("/campaigns")}
            size="sm"
            className="hidden sm:flex bg-gradient-to-br from-[#22C55E] to-[#14B8A6] hover:from-[#16A34A] hover:to-[#0D9488] text-white rounded-xl h-9 px-4 text-xs font-semibold shadow-glow-green border-0 transition-all duration-200"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            New Campaign
          </Button>

          {/* Profile Avatar */}
          <button
            onClick={() => setIsProfileOpen(true)}
            className="relative group flex-shrink-0"
            title="Admin Profile"
          >
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#22C55E] to-[#14B8A6] flex items-center justify-center ring-2 ring-black/[0.06] group-hover:ring-[#22C55E]/30 transition-all duration-200">
              <User className="h-4 w-4 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#84CC16] rounded-full border-2 border-white" />
          </button>

        </div>
      </header>

      {/* Admin Profile Modal */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="sm:max-w-[450px] bg-white border-black/[0.08] text-[#0F172A] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Admin Profile</DialogTitle>
            <DialogDescription className="text-[#475569]">
              View and edit your personal admin details.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveProfile} className="space-y-5 py-2">
            {/* Profile Avatar */}
            <div className="flex flex-col items-center space-y-3">
              <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-[#22C55E] to-[#14B8A6] flex items-center justify-center shadow-lg">
                <User className="h-10 w-10 text-white/90" />
              </div>
              {profile?.full_name && (
                <p className="text-sm font-semibold text-[#0F172A]">{profile.full_name}</p>
              )}
            </div>

            {/* Profile Form Details */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-[#475569] text-xs font-medium">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="bg-black/[0.02] border-black/[0.08] text-[#0F172A] focus:border-[#22C55E]/40 rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-[#475569] text-xs font-medium">Phone Number</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-black/[0.02] border-black/[0.08] text-[#0F172A] focus:border-[#22C55E]/40 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[#475569] text-xs font-medium">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-black/[0.02] border-black/[0.08] text-[#0F172A] focus:border-[#22C55E]/40 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[#475569] text-xs font-medium">Role</Label>
                  <Input
                    value={profile?.role || "Admin"}
                    disabled
                    className="bg-black/[0.01] border-black/[0.04] text-[#475569]/60 cursor-not-allowed rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[#475569] text-xs font-medium">Account Created</Label>
                  <Input
                    value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "N/A"}
                    disabled
                    className="bg-black/[0.01] border-black/[0.04] text-[#475569]/60 cursor-not-allowed rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* Messaging Alerts */}
            {errorMsg && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl">
                {errorMsg}
              </p>
            )}

            {successMsg && (
              <p className="text-xs text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E]/20 p-2.5 rounded-xl flex items-center justify-center gap-1.5 font-medium">
                <Check className="h-4 w-4" /> {successMsg}
              </p>
            )}

            <DialogFooter className="border-t border-black/[0.06] pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsProfileOpen(false)}
                disabled={saving}
                className="border-black/[0.08] text-[#475569] hover:bg-black/[0.02] hover:text-[#0F172A] rounded-xl"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={saving} 
                className="bg-gradient-to-r from-[#22C55E] to-[#14B8A6] hover:from-[#16A34A] hover:to-[#0D9488] text-white min-w-[80px] rounded-xl border-0"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
