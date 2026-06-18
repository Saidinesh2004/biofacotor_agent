import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Users, PhoneForwarded, MessageSquare, Phone,
  Calendar, Play, CheckCircle, AlertCircle, BarChart2, User,
  ArrowUpRight, Zap
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export default function Dashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [activeTipIndex, setActiveTipIndex] = useState(0);

  const heroImages = [
    "/carousel_farmer_phone.png",
    "/carousel_terrace_farm.png",
    "/carousel_sunrays_wheat.png"
  ];

  const farmingTips = [
    { title: "Smart Irrigation Alert", text: "Water crops early in the morning or late in the evening to reduce evaporation losses by up to 25%." },
    { title: "Pest Management Tip", text: "Regularly monitor crop foliage pattern changes. Early yellowing might indicate early-stage aphid infestation." },
    { title: "ElevenLabs Broadcast Tip", text: "Keep outbound audio alerts under 45 seconds to maintain high farmer engagement and response rates." },
    { title: "Soil Moisture Tip", text: "Sandy loam soils require frequent light irrigation compared to heavy clay soils which retain water longer." }
  ];

  const [stats, setStats] = useState({
    total_farmers: 0,
    calls_initiated: 0,
    calls_completed: 0,
    calls_failed: 0,
    total_responses: 0,
    today_calls: 0,
    today_responses: 0,
    total_campaigns: 0,
    scheduled_campaigns: 0,
    running_campaigns: 0,
    completed_campaigns: 0,
    failed_campaigns: 0,
    total_farmers_contacted: 0,
    total_calls_completed: 0,
    total_responses_received: 0
  });

  const fetchStats = async () => {
    try {
      const res = await api.get("/dashboard/stats");
      setStats(res.data);
    } catch (error) {
      console.error("Failed to fetch dashboard stats", error);
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await api.get("/admins/profile");
      setProfile(res.data);
    } catch (error) {
      console.error("Failed to fetch profile in dashboard", error);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchProfile();
    const interval = setInterval(fetchStats, 5000);
    
    const heroInterval = setInterval(() => {
      setActiveHeroIndex((prev) => (prev + 1) % heroImages.length);
    }, 5000);

    const tipInterval = setInterval(() => {
      setActiveTipIndex((prev) => (prev + 1) % farmingTips.length);
    }, 7000);

    const handleProfileUpdate = () => {
      fetchProfile();
    };
    window.addEventListener("profile-updated", handleProfileUpdate);

    return () => {
      clearInterval(interval);
      clearInterval(heroInterval);
      clearInterval(tipInterval);
      window.removeEventListener("profile-updated", handleProfileUpdate);
    };
  }, []);

  const coreCards = [
    { title: "Total Farmers Registered", value: stats.total_farmers, icon: Users, gradient: "from-[#84CC16]/15 to-transparent", iconBg: "bg-[#84CC16]/15", iconColor: "text-[#84CC16]", trend: "+12%" },
    { title: "Farmers Reached", value: stats.total_farmers_contacted, icon: PhoneForwarded, gradient: "from-[#14B8A6]/15 to-transparent", iconBg: "bg-[#14B8A6]/15", iconColor: "text-[#14B8A6]", trend: "+8%" },
    { title: "Calls Completed", value: stats.total_calls_completed, icon: Phone, gradient: "from-[#22C55E]/15 to-transparent", iconBg: "bg-[#22C55E]/15", iconColor: "text-[#22C55E]", trend: "+24%" },
    { title: "Responses Received", value: stats.total_responses_received, icon: MessageSquare, gradient: "from-[#84CC16]/15 to-transparent", iconBg: "bg-[#84CC16]/15", iconColor: "text-[#84CC16]", trend: "+18%" },
  ];

  const campaignCards = [
    { title: "Total", value: stats.total_campaigns, icon: BarChart2, color: "text-[#D1D5DB]" },
    { title: "Scheduled", value: stats.scheduled_campaigns, icon: Calendar, color: "text-[#14B8A6]" },
    { title: "Running", value: stats.running_campaigns, icon: Play, color: "text-[#84CC16]" },
    { title: "Completed", value: stats.completed_campaigns, icon: CheckCircle, color: "text-[#22C55E]" },
    { title: "Failed", value: stats.failed_campaigns, icon: AlertCircle, color: "text-[#EF4444]" },
  ];

  const cn = (...classes: string[]) => classes.filter(Boolean).join(" ");

  return (
    <div className="space-y-8 animate-sprout">

      {/* Welcome Banner (Premium Redesigned Hero Section) */}
      <div className="relative overflow-hidden rounded-[24px] border border-black/[0.05] bg-gradient-to-r from-white to-[#F1F5F9] shadow-md p-8">
        <div className="absolute inset-0 bg-gradient-to-r from-[#22C55E]/04 via-transparent to-[#14B8A6]/04" />
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#14B8A6]/5 rounded-full blur-[80px]" />
        
        {/* Embedded farming hero banner image carousel */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2 hidden lg:block w-[300px] h-[160px] rounded-2xl overflow-hidden shadow-sm border border-black/[0.05] bg-black/[0.02]">
          {heroImages.map((src, idx) => (
            <img
              key={src}
              src={src}
              alt={`Farming Carousel ${idx}`}
              className={cn(
                "absolute inset-0 w-full h-full object-cover transition-opacity duration-1000",
                idx === activeHeroIndex ? "opacity-100 animate-sun-glow" : "opacity-0 pointer-events-none"
              )}
            />
          ))}
        </div>

        <div className="relative flex flex-col md:flex-row items-center md:items-start justify-between gap-6 pr-0 lg:pr-[320px]">
          <div className="flex items-center gap-6">
            <div className="flex-shrink-0">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#22C55E] to-[#14B8A6] flex items-center justify-center shadow-lg shadow-[#22C55E]/15">
                <User className="h-8 w-8 text-white" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-black text-[#0F172A] tracking-tight flex items-center gap-2.5">
                Welcome back, {profile?.full_name || "Admin"}
                <Zap className="h-5 w-5 text-[#84CC16] animate-bounce" />
              </h2>
              <p className="text-sm text-[#475569] mt-1.5 leading-relaxed max-w-xl">
                Ready to manage your farmers and scale agricultural yields? Use the dashboard below to monitor real-time analytics, launch automated campaigns, and review AI-driven call summaries.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Core KPI Cards */}
      <div>
        <h2 className="text-xs font-bold text-[#475569] mb-4 uppercase tracking-[0.15em]">Core Performance</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {coreCards.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <Card key={i} className="relative overflow-hidden rounded-[24px] border border-black/[0.05] bg-white shadow-sm group hover:border-[#22C55E] transition-all duration-300 hover:-translate-y-1 hover:shadow-glow-green">
                {/* Glow highlight */}
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-10 group-hover:opacity-20 transition-opacity`} />
                <CardHeader className="relative flex flex-row items-center justify-between pb-3 space-y-0 p-6">
                  <CardTitle className="text-xs font-bold text-[#475569] uppercase tracking-wider">{stat.title}</CardTitle>
                  <div className={cn("p-3 rounded-2xl transition-transform duration-300 group-hover:scale-110", stat.iconBg, stat.iconColor)}>
                    <Icon className="h-5 w-5" />
                  </div>
                </CardHeader>
                <CardContent className="relative p-6 pt-0">
                  <div className="flex items-end justify-between">
                    <div className="text-3xl font-black text-[#0F172A] tracking-tight">{stat.value.toLocaleString()}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Campaign Summary */}
      <div>
        <h2 className="text-xs font-bold text-[#475569] mb-4 uppercase tracking-[0.15em]">Campaign Summary</h2>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {campaignCards.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <Card key={i} className="relative overflow-hidden rounded-[24px] border border-black/[0.05] bg-white shadow-sm group hover:border-[#22C55E]/40 transition-all duration-300 hover:-translate-y-1">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={cn("p-2 rounded-xl bg-black/[0.02] transition-transform duration-200 group-hover:scale-110", stat.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 text-[#94A3B8] opacity-0 group-hover:opacity-100 transition-all" />
                  </div>
                  <div className="text-3xl font-black text-[#0F172A] tracking-tight">{stat.value.toLocaleString()}</div>
                  <p className="text-[10px] text-[#475569]/70 mt-2 font-bold uppercase tracking-wider">{stat.title}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden rounded-[24px] border border-black/[0.05] bg-white shadow-sm lg:col-span-2">
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-sm font-semibold text-[#0F172A]">Today's Activity</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] p-6 pt-0">
             <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: "Today's Calls", count: stats.today_calls },
                { name: "Today's Responses", count: stats.today_responses }
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.04)" vertical={false} />
                <XAxis dataKey="name" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#FFFFFF', 
                    borderColor: 'rgba(15,23,42,0.08)', 
                    color: '#0F172A',
                    borderRadius: '16px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
                    fontSize: '12px'
                  }}
                  itemStyle={{ color: '#0F172A' }}
                  cursor={{ fill: 'rgba(34, 197, 94, 0.02)' }}
                />
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#14B8A6" />
                    <stop offset="100%" stopColor="#22C55E" />
                  </linearGradient>
                </defs>
                <Bar dataKey="count" fill="url(#barGrad)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden rounded-[24px] border border-black/[0.05] bg-white shadow-sm">
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-sm font-semibold text-[#0F172A]">Calls by Status</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center p-6 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Completed', value: stats.total_calls_completed, fill: '#14B8A6' },
                    { name: 'Failed', value: stats.calls_failed, fill: '#EF4444' }
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                  strokeWidth={0}
                >
                  <Cell fill="#14B8A6" />
                  <Cell fill="#EF4444" />
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#FFFFFF', 
                    borderColor: 'rgba(15,23,42,0.08)', 
                    color: '#0F172A',
                    borderRadius: '16px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
                    fontSize: '12px'
                  }}
                  itemStyle={{ color: '#0F172A' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Farming Insights Gallery */}
        <Card className="relative overflow-hidden rounded-[24px] border border-black/[0.05] bg-white shadow-sm flex flex-col justify-between">
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-sm font-semibold text-[#0F172A]">Farming Insights</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between p-6 pt-0 space-y-4">
            <div className="relative w-full h-28 rounded-2xl overflow-hidden border border-black/[0.05] shadow-sm bg-black/[0.02]">
              <img src="/gallery_smart_ag.png" alt="Smart Agriculture" className="w-full h-full object-cover" />
              <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-[#14B8A6] text-white text-[9px] font-bold tracking-wider uppercase shadow-sm">
                Agri-Tech
              </div>
            </div>

            <div className="h-16 flex flex-col justify-center relative overflow-hidden">
              {farmingTips.map((tip, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "absolute inset-0 flex flex-col justify-center transition-all duration-500",
                    idx === activeTipIndex 
                      ? "opacity-100 translate-y-0 scale-100 pointer-events-auto" 
                      : "opacity-0 translate-y-4 scale-95 pointer-events-none"
                  )}
                >
                  <span className="text-[10px] font-bold text-[#22C55E] uppercase tracking-wider block">
                    {tip.title}
                  </span>
                  <p className="text-[11px] text-[#475569] leading-relaxed mt-0.5 font-medium line-clamp-2" title={tip.text}>
                    {tip.text}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
