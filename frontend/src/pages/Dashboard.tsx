import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Users, PhoneForwarded, MessageSquare, Phone,
  Calendar, Play, CheckCircle, AlertCircle, BarChart2,
  Zap, CloudRain, Sprout
} from "lucide-react";
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area 
} from "recharts";

const Sparkline = ({ data, color }: { data: number[]; color: string }) => {
  const chartData = data.map((val, i) => ({ value: val, index: i }));
  return (
    <div className="w-[100px] h-[35px] flex-shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke={color} 
            strokeWidth={1.5} 
            fill={`url(#grad-${color.replace('#', '')})`} 
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default function Dashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);

  const heroImages = [
    "/carousel_farmer_phone.png",
    "/carousel_terrace_farm.png",
    "/carousel_sunrays_wheat.png"
  ];

  const [stats, setStats] = useState<any>({
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

    const handleProfileUpdate = () => {
      fetchProfile();
    };
    window.addEventListener("profile-updated", handleProfileUpdate);

    return () => {
      clearInterval(interval);
      clearInterval(heroInterval);
      window.removeEventListener("profile-updated", handleProfileUpdate);
    };
  }, []);

  const iconMap: Record<string, any> = {
    CheckCircle,
    Play,
    Calendar,
    Phone,
    MessageSquare,
    Users
  };

  const coreCards = [
    { 
      title: "Total Farmers Registered", 
      value: stats.total_farmers || 0, 
      icon: Users, 
      color: "#22C55E", 
      iconBg: "bg-emerald-500/10", 
      iconColor: "text-emerald-600", 
      trend: stats.trends?.total_farmers || "0%", 
      chartData: stats.sparkline_data?.total_farmers || [0, 0, 0, 0, 0, 0] 
    },
    { 
      title: "Farmers Reached", 
      value: stats.total_farmers_contacted || 0, 
      icon: PhoneForwarded, 
      color: "#14B8A6", 
      iconBg: "bg-teal-500/10", 
      iconColor: "text-teal-600", 
      trend: stats.trends?.farmers_reached || "0%", 
      chartData: stats.sparkline_data?.farmers_reached || [0, 0, 0, 0, 0, 0] 
    },
    { 
      title: "Calls Completed", 
      value: stats.total_calls_completed || 0, 
      icon: Phone, 
      color: "#3B82F6", 
      iconBg: "bg-blue-500/10", 
      iconColor: "text-blue-600", 
      trend: stats.trends?.calls_completed || "0%", 
      chartData: stats.sparkline_data?.calls_completed || [0, 0, 0, 0, 0, 0] 
    },
    { 
      title: "Responses Received", 
      value: stats.total_responses_received || 0, 
      icon: MessageSquare, 
      color: "#84CC16", 
      iconBg: "bg-lime-500/10", 
      iconColor: "text-lime-600", 
      trend: stats.trends?.responses_received || "0%", 
      chartData: stats.sparkline_data?.responses_received || [0, 0, 0, 0, 0, 0] 
    },
  ];

  const totalCamps = stats.total_campaigns || 0;
  const campaignCards = [
    { title: "Total", value: stats.total_campaigns || 0, icon: BarChart2, color: "text-[#D1D5DB]", barColor: "bg-emerald-500", pct: totalCamps > 0 ? Math.round(((stats.total_campaigns || 0) / totalCamps) * 100) : 0 },
    { title: "Scheduled", value: stats.scheduled_campaigns || 0, icon: Calendar, color: "text-[#14B8A6]", barColor: "bg-teal-500", pct: totalCamps > 0 ? Math.round(((stats.scheduled_campaigns || 0) / totalCamps) * 100) : 0 },
    { title: "Running", value: stats.running_campaigns || 0, icon: Play, color: "text-[#84CC16]", barColor: "bg-lime-500", pct: totalCamps > 0 ? Math.round(((stats.running_campaigns || 0) / totalCamps) * 100) : 0 },
    { title: "Completed", value: stats.completed_campaigns || 0, icon: CheckCircle, color: "text-[#22C55E]", barColor: "bg-emerald-500", pct: totalCamps > 0 ? Math.round(((stats.completed_campaigns || 0) / totalCamps) * 100) : 0 },
    { title: "Failed", value: stats.failed_campaigns || 0, icon: AlertCircle, color: "text-[#EF4444]", barColor: "bg-red-500", pct: totalCamps > 0 ? Math.round(((stats.failed_campaigns || 0) / totalCamps) * 100) : 0 },
  ];

  const cn = (...classes: string[]) => classes.filter(Boolean).join(" ");

  const activityData = stats.activity_chart_data && stats.activity_chart_data.length > 0
    ? stats.activity_chart_data
    : [
        { name: "12 AM", "Calls Made": 0, "Calls Answered": 0, "WhatsApp Sent": 0, "Responses Received": 0 },
        { name: "4 AM", "Calls Made": 0, "Calls Answered": 0, "WhatsApp Sent": 0, "Responses Received": 0 },
        { name: "8 AM", "Calls Made": 0, "Calls Answered": 0, "WhatsApp Sent": 0, "Responses Received": 0 },
        { name: "12 PM", "Calls Made": 0, "Calls Answered": 0, "WhatsApp Sent": 0, "Responses Received": 0 },
        { name: "4 PM", "Calls Made": 0, "Calls Answered": 0, "WhatsApp Sent": 0, "Responses Received": 0 },
        { name: "8 PM", "Calls Made": 0, "Calls Answered": 0, "WhatsApp Sent": 0, "Responses Received": 0 },
        { name: "12 AM", "Calls Made": 0, "Calls Answered": 0, "WhatsApp Sent": 0, "Responses Received": 0 }
      ];

  const callsByStatus = stats.calls_by_status || { Answered: 0, Missed: 0, Failed: 0, Busy: 0 };
  const answeredCalls = callsByStatus.Answered || 0;
  const missedCalls = callsByStatus.Missed || 0;
  const failedCalls = callsByStatus.Failed || 0;
  const busyCalls = callsByStatus.Busy || 0;
  const totalCalls = answeredCalls + missedCalls + failedCalls + busyCalls;

  const pieData = [
    { name: 'Answered', value: answeredCalls, fill: '#22C55E' },
    { name: 'Missed', value: missedCalls, fill: '#EAB308' },
    { name: 'Failed', value: failedCalls, fill: '#EF4444' },
    { name: 'Busy', value: busyCalls, fill: '#3B82F6' }
  ];

  const recentActivities = (stats.recent_activities || []).map((act: any) => ({
    ...act,
    icon: iconMap[act.icon] || MessageSquare
  }));

  const insights = stats.farming_insights || {
    temp: "28°C",
    weather: "Light Rain",
    humidity: "65%",
    wind_speed: "12 km/h",
    advisory: "Good time for fertilizer application for Paddy and Maize crops.",
    recommendation: "Farmers in your region are more responsive between 6 PM - 8 PM."
  };

  const topCampaigns = stats.top_campaigns || [];

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
              <div className="h-16 w-16 rounded-2xl overflow-hidden shadow-lg border border-black/[0.05]">
                <img src="/welcome_farmer.png" alt="Farmer" className="w-full h-full object-cover" />
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
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xs font-bold text-slate-500 tracking-[0.15em] uppercase">Core Performance</h2>
          <select className="border-0 bg-transparent text-sm font-semibold text-slate-600 outline-none cursor-pointer">
            <option>This Month</option>
          </select>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {coreCards.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <Card key={i} className="relative overflow-hidden rounded-[24px] border border-black/[0.05] bg-white shadow-sm p-6 group hover:border-[#22C55E] transition-all duration-300 hover:-translate-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.title}</span>
                  <div className={cn("p-2.5 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", stat.iconBg)}>
                    <Icon className={cn("h-5 w-5", stat.iconColor)} />
                  </div>
                </div>
                <div className="flex items-end justify-between mt-4">
                  <div>
                    <div className="text-3xl font-black text-[#0F172A] tracking-tight">{stat.value.toLocaleString()}</div>
                    <span className="text-xs font-semibold text-emerald-600 mt-1 block">
                      {stat.trend.startsWith("-") ? "↓" : "↑"} {stat.trend} vs last period
                    </span>
                  </div>
                  <Sparkline data={stat.chartData} color={stat.color} />
                </div>
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
              <Card key={i} className="relative overflow-hidden rounded-[24px] border border-black/[0.05] bg-white shadow-sm p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[#22C55E]/40">
                <div className="flex items-center justify-between">
                  <div className={cn("p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center", stat.color)}>
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-500">{stat.pct}%</span>
                </div>
                <div className="text-3xl font-black text-[#0F172A] tracking-tight mt-4">{stat.value.toLocaleString()}</div>
                <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">{stat.title}</p>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-3">
                  <div className={cn("h-full rounded-full", stat.barColor)} style={{ width: `${stat.pct}%` }} />
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Charts & Timeline Feed Grid */}
      <div className="grid gap-6 lg:grid-cols-4">
        {/* Today's Activity Chart */}
        <Card className="relative overflow-hidden rounded-[24px] border border-black/[0.05] bg-white shadow-sm lg:col-span-2">
          <CardHeader className="p-6 pb-2 flex flex-row justify-between items-center space-y-0">
            <CardTitle className="text-sm font-bold text-[#0F172A]">Today's Activity</CardTitle>
            <select className="border-0 bg-transparent text-xs font-semibold text-slate-500 outline-none cursor-pointer">
              <option>Daily</option>
            </select>
          </CardHeader>
          <CardContent className="h-[280px] p-6 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="madeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22C55E" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="answeredGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="waGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#A855F7" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#A855F7" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="respGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F97316" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#F97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.04)" vertical={false} />
                <XAxis dataKey="name" stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#FFFFFF', 
                    borderColor: 'rgba(15,23,42,0.08)', 
                    color: '#0F172A',
                    borderRadius: '16px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
                    fontSize: '11px'
                  }}
                />
                <Area type="monotone" dataKey="Calls Made" stroke="#22C55E" strokeWidth={2} fill="url(#madeGrad)" />
                <Area type="monotone" dataKey="Calls Answered" stroke="#3B82F6" strokeWidth={2} fill="url(#answeredGrad)" />
                <Area type="monotone" dataKey="WhatsApp Sent" stroke="#A855F7" strokeWidth={2} fill="url(#waGrad)" />
                <Area type="monotone" dataKey="Responses Received" stroke="#F97316" strokeWidth={2} fill="url(#respGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Calls by Status Chart */}
        <Card className="relative overflow-hidden rounded-[24px] border border-black/[0.05] bg-white shadow-sm flex flex-col justify-between">
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-sm font-bold text-[#0F172A]">Calls by Status</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px] p-6 pt-0 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="relative w-full h-[160px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#FFFFFF', 
                      borderColor: 'rgba(15,23,42,0.08)', 
                      color: '#0F172A',
                      borderRadius: '16px',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
                      fontSize: '11px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Centered Label */}
              <div className="absolute flex flex-col items-center justify-center pointer-events-none select-none">
                <span className="text-2xl font-black text-slate-800 tracking-tight">{totalCalls}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Calls</span>
              </div>
            </div>

            {/* Vertical Legend List */}
            <div className="w-full flex-col space-y-2 text-xs">
              {pieData.map((item, index) => {
                const pct = totalCalls > 0 ? Math.round((item.value / totalCalls) * 100) : 0;
                return (
                  <div key={index} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                      <span className="font-semibold text-slate-600">{item.name}</span>
                    </div>
                    <span className="font-bold text-slate-700">{item.value} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity Timeline Feed */}
        <Card className="relative overflow-hidden rounded-[24px] border border-black/[0.05] bg-white shadow-sm flex flex-col justify-between">
          <CardHeader className="p-6 pb-2 flex flex-row justify-between items-center space-y-0">
            <CardTitle className="text-sm font-bold text-[#0F172A]">Recent Activity</CardTitle>
            <button className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-all">View All</button>
          </CardHeader>
          <CardContent className="p-6 pt-2 overflow-y-auto max-h-[280px] flex-1">
            <div className="relative pl-6 space-y-5 border-l border-slate-100">
              {recentActivities.map((act: any, i: number) => {
                const Icon = act.icon;
                return (
                  <div key={i} className="relative">
                    {/* timeline dot indicator */}
                    <div className={cn("absolute -left-[35px] top-0.5 h-[18px] w-[18px] rounded-full border border-white flex items-center justify-center shadow-sm", act.iconBg)}>
                      <Icon className={cn("h-2.5 w-2.5", act.iconColor)} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800 leading-tight pr-8">{act.title}</p>
                      <span className="text-[10px] font-bold text-slate-400 mt-1 block uppercase tracking-wider">{act.time}</span>
                    </div>
                  </div>
                );
              })}
              {recentActivities.length === 0 && (
                <div className="text-slate-400 text-xs font-semibold text-center py-8">
                  No recent activities
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Farming Insights & Top Performing Campaigns */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Farming Insights */}
        <Card className="relative overflow-hidden rounded-[24px] border border-black/[0.05] bg-white shadow-sm flex flex-col justify-between lg:col-span-2">
          <CardHeader className="p-6 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-bold text-[#0F172A]">Farming Insights</CardTitle>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase bg-emerald-50 text-emerald-700 border border-emerald-100/50 shadow-sm gap-1">
              <Zap className="h-2.5 w-2.5 text-emerald-600 animate-pulse" /> AI Powered
            </span>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between p-6 pt-0 space-y-4 relative">
            
            {/* Split layout inside Insights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Weather info */}
              <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4 flex flex-col justify-between shadow-sm relative overflow-hidden min-h-[120px]">
                <div className="flex justify-between items-start">
                  <CloudRain className="h-7 w-7 text-sky-500" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Today</span>
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-black text-slate-800 tracking-tight">{insights.temp}</span>
                  <span className="text-[10px] font-bold text-slate-500 block mt-0.5">{insights.weather}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-[9px] font-semibold text-slate-400 uppercase">
                  <span>Hum: {insights.humidity}</span>
                  <span>Wind: {insights.wind_speed}</span>
                </div>
              </div>

              {/* Crop Advisory */}
              <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4 flex flex-col justify-between shadow-sm min-h-[120px]">
                <div className="flex justify-between items-start">
                  <Sprout className="h-6 w-6 text-emerald-600" />
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Crop Advisory</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed font-semibold mt-2 line-clamp-3">
                  {insights.advisory}
                </p>
              </div>

              {/* AI recommendation */}
              <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4 flex flex-col justify-between shadow-sm min-h-[120px]">
                <div className="flex justify-between items-start">
                  <Zap className="h-6 w-6 text-amber-500" />
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">AI Rec</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed font-semibold mt-2 line-clamp-3">
                  {insights.recommendation}
                </p>
              </div>
            </div>

            {/* Bottom Graphic Banner */}
            <div className="relative w-full h-16 rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
              <img src="/gallery_smart_ag.png" alt="Crop Landscape Banner" className="w-full h-full object-cover object-bottom" />
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/40 via-transparent to-transparent flex items-center p-4">
                <span className="text-white text-[10px] font-bold tracking-widest uppercase">Smart Agriculture Systems</span>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Top Performing Campaigns Table */}
        <Card className="relative overflow-hidden rounded-[24px] border border-black/[0.05] bg-white shadow-sm flex flex-col justify-between lg:col-span-3">
          <CardHeader className="p-6 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-bold text-[#0F172A]">Top Performing Campaigns</CardTitle>
            <button className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-all">View All</button>
          </CardHeader>
          <CardContent className="p-6 pt-2 overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-2.5">Campaign</th>
                  <th className="py-2.5">Reach</th>
                  <th className="py-2.5 text-right">Response Rate</th>
                  <th className="py-2.5 text-right pr-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/50">
                {topCampaigns.map((camp: any, idx: number) => (
                  <tr key={idx}>
                    <td className="py-3 font-semibold text-slate-800">{camp.campaign_name}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2 max-w-[120px]">
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${camp.reach}%` }} />
                        </div>
                        <span className="font-bold text-slate-500">{camp.reach}%</span>
                      </div>
                    </td>
                    <td className="py-3 text-right font-bold text-slate-700">{camp.response_rate}%</td>
                    <td className="py-3 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100/50">
                        {camp.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {topCampaigns.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400 font-semibold">
                      No campaigns registered
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
