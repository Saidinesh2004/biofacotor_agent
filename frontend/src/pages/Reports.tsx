import { useState, useEffect } from "react";
import api from "@/lib/api";
import { FileSpreadsheet, FileText, TrendingUp, Users, Activity, BarChart2, RefreshCw, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area
} from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const COLORS = ['#14B8A6', '#22C55E', '#84CC16', '#F59E0B', '#06B6D4', '#EF4444', '#8B5CF6'];

const tooltipStyle = {
  backgroundColor: '#FFFFFF',
  borderColor: 'rgba(0,0,0,0.08)',
  color: '#0F172A',
  borderRadius: '12px',
  boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
  fontSize: '12px',
};

export default function Reports() {
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [chartsData, setChartsData] = useState({
    status_distribution: [] as any[],
    village_distribution: [] as any[],
    crop_distribution: [] as any[],
    performance_trend: [] as any[]
  });
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const summaryRes = await api.get("/campaigns/analytics/summary");
      setAnalytics(summaryRes.data);
    } catch (error) {
      console.error("Failed to load analytics summary", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCharts = async () => {
    try {
      const url = selectedCampaignId 
        ? `/campaigns/analytics/charts?campaign_id=${selectedCampaignId}`
        : "/campaigns/analytics/charts";
      const res = await api.get(url);
      setChartsData(res.data);
    } catch (error) {
      console.error("Failed to load charts data", error);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    
    // Real-time updates: poll analytics every 5 seconds
    const interval = setInterval(() => {
      fetchAnalytics();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchCharts();
    
    // Real-time updates: poll charts every 5 seconds
    const interval = setInterval(() => {
      fetchCharts();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [selectedCampaignId]);

  const activeStats = () => {
    if (selectedCampaignId) {
      return analytics.find(a => a.campaign_id.toString() === selectedCampaignId) || null;
    }
    return null;
  };

  const round = (value: number, decimals: number) => {
    return Number(Math.round(Number(value + 'e' + decimals)) + 'e-' + decimals);
  };

  const currentCampaign = activeStats();

  const handleExportExcel = () => {
    if (analytics.length === 0) return;

    const headers = [
      "Campaign Name", "Campaign Type", "Created Date", "Targeted", "Reached",
      "Answered", "Failed", "Responses", "Avg Duration", "Success Rate", "Campaign Status"
    ];

    const csvContent = [
      headers.join(","),
      ...analytics.map((c) => [
        `"${c.campaign_name.replace(/"/g, '""')}"`,
        `"${c.campaign_type}"`,
        `"${c.created_at ? new Date(c.created_at).toLocaleString() : 'Manual Start'}"`,
        c.farmers_targeted,
        c.farmers_reached,
        c.campaign_type === "Voice Campaign" ? (c.calls_answered ?? 0) : "-",
        c.calls_failed,
        c.responses_collected,
        c.campaign_type === "Voice Campaign" ? `${c.average_duration ?? 0}s` : "-",
        `${c.success_rate}%`,
        `"${c.campaign_status ?? 'N/A'}"`
      ].join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "campaign_analytics_reports.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPDF = () => {
    window.print();
  };

  const cn = (...classes: string[]) => classes.filter(Boolean).join(" ");

  // Build dynamic metric cards based on selected campaign type
  let metricCards: any[] = [];
  if (currentCampaign) {
    if (currentCampaign.campaign_type === "WhatsApp Campaign") {
      metricCards = [
        { title: "Targeted Farmers", value: currentCampaign.farmers_targeted, icon: Users, gradient: "from-[#8B5CF6]/10 to-transparent", iconBg: "bg-[#8B5CF6]/10", iconColor: "text-[#8B5CF6]" },
        { title: "Reached (Delivered)", value: currentCampaign.farmers_reached, icon: Activity, gradient: "from-[#14B8A6]/10 to-transparent", iconBg: "bg-[#14B8A6]/10", iconColor: "text-[#14B8A6]" },
        { title: "Failed", value: currentCampaign.calls_failed, icon: Users, gradient: "from-[#EF4444]/10 to-transparent", iconBg: "bg-[#EF4444]/10", iconColor: "text-[#EF4444]" },
        { title: "Success Rate", value: `${currentCampaign.success_rate}%`, icon: TrendingUp, gradient: "from-[#84CC16]/10 to-transparent", iconBg: "bg-[#84CC16]/10", iconColor: "text-[#84CC16]" },
        { title: "Replies (Responses)", value: currentCampaign.responses_collected, icon: BarChart2, gradient: "from-[#F59E0B]/10 to-transparent", iconBg: "bg-[#F59E0B]/10", iconColor: "text-[#F59E0B]" },
        { 
          title: "Campaign Status", 
          value: currentCampaign.campaign_status, 
          icon: RefreshCw, 
          gradient: currentCampaign.campaign_status === "Successful" ? "from-[#22C55E]/10 to-transparent" : currentCampaign.campaign_status === "Partial Success" ? "from-[#F59E0B]/10 to-transparent" : "from-[#EF4444]/10 to-transparent", 
          iconBg: currentCampaign.campaign_status === "Successful" ? "bg-[#22C55E]/10" : currentCampaign.campaign_status === "Partial Success" ? "bg-[#F59E0B]/10" : "bg-[#EF4444]/10", 
          iconColor: currentCampaign.campaign_status === "Successful" ? "text-[#22C55E]" : currentCampaign.campaign_status === "Partial Success" ? "text-[#F59E0B]" : "text-[#EF4444]" 
        }
      ];
    } else {
      // Voice Campaign
      metricCards = [
        { title: "Targeted Farmers", value: currentCampaign.farmers_targeted, icon: Users, gradient: "from-[#8B5CF6]/10 to-transparent", iconBg: "bg-[#8B5CF6]/10", iconColor: "text-[#8B5CF6]" },
        { title: "Reached (Connected)", value: currentCampaign.farmers_reached, icon: Activity, gradient: "from-[#14B8A6]/10 to-transparent", iconBg: "bg-[#14B8A6]/10", iconColor: "text-[#14B8A6]" },
        { title: "Answered Calls", value: currentCampaign.calls_answered, icon: Users, gradient: "from-[#06B6D4]/10 to-transparent", iconBg: "bg-[#06B6D4]/10", iconColor: "text-[#06B6D4]" },
        { title: "Failed Calls", value: currentCampaign.calls_failed, icon: Users, gradient: "from-[#EF4444]/10 to-transparent", iconBg: "bg-[#EF4444]/10", iconColor: "text-[#EF4444]" },
        { title: "Responses", value: currentCampaign.responses_collected, icon: BarChart2, gradient: "from-[#F59E0B]/10 to-transparent", iconBg: "bg-[#F59E0B]/10", iconColor: "text-[#F59E0B]" },
        { title: "Avg. Duration", value: `${currentCampaign.average_duration}s`, icon: Activity, gradient: "from-[#22C55E]/10 to-transparent", iconBg: "bg-[#22C55E]/10", iconColor: "text-[#22C55E]" },
        { title: "Success Rate", value: `${currentCampaign.success_rate}%`, icon: TrendingUp, gradient: "from-[#84CC16]/10 to-transparent", iconBg: "bg-[#84CC16]/10", iconColor: "text-[#84CC16]" },
        { 
          title: "Campaign Status", 
          value: currentCampaign.campaign_status, 
          icon: RefreshCw, 
          gradient: currentCampaign.campaign_status === "Successful" ? "from-[#22C55E]/10 to-transparent" : currentCampaign.campaign_status === "Partial Success" ? "from-[#F59E0B]/10 to-transparent" : "from-[#EF4444]/10 to-transparent", 
          iconBg: currentCampaign.campaign_status === "Successful" ? "bg-[#22C55E]/10" : currentCampaign.campaign_status === "Partial Success" ? "bg-[#F59E0B]/10" : "bg-[#EF4444]/10", 
          iconColor: currentCampaign.campaign_status === "Successful" ? "text-[#22C55E]" : currentCampaign.campaign_status === "Partial Success" ? "text-[#F59E0B]" : "text-[#EF4444]" 
        }
      ];
    }
  } else {
    // Aggregated Overview (All Campaigns)
    const targeted = analytics.reduce((acc, c) => acc + c.farmers_targeted, 0);
    const responses = analytics.reduce((acc, c) => acc + c.responses_collected, 0);
    
    // Overall success rate: (total voice answered + total WhatsApp reached) / total targeted
    const voiceCampaigns = analytics.filter(c => c.campaign_type !== "WhatsApp Campaign");
    const whatsappCampaigns = analytics.filter(c => c.campaign_type === "WhatsApp Campaign");
    const totalVoiceAnswered = voiceCampaigns.reduce((acc, c) => acc + (c.calls_answered || 0), 0);
    const totalWaReached = whatsappCampaigns.reduce((acc, c) => acc + (c.farmers_reached || 0), 0);
    const totalSuccessOutcomes = totalVoiceAnswered + totalWaReached;
    const overallSuccess = targeted > 0 ? (totalSuccessOutcomes / targeted * 100) : 0.0;

    metricCards = [
      { title: "Total Campaigns", value: analytics.length, icon: Activity, gradient: "from-[#8B5CF6]/10 to-transparent", iconBg: "bg-[#8B5CF6]/10", iconColor: "text-[#8B5CF6]" },
      { title: "Farmers Targeted", value: targeted, icon: Users, gradient: "from-[#06B6D4]/10 to-transparent", iconBg: "bg-[#06B6D4]/10", iconColor: "text-[#06B6D4]" },
      { title: "Responses Collected", value: responses, icon: BarChart2, gradient: "from-[#F59E0B]/10 to-transparent", iconBg: "bg-[#F59E0B]/10", iconColor: "text-[#F59E0B]" },
      { title: "Overall Success", value: `${round(overallSuccess, 1)}%`, icon: TrendingUp, gradient: "from-[#22C55E]/10 to-transparent", iconBg: "bg-[#22C55E]/10", iconColor: "text-[#22C55E]" },
    ];
  }

  const selectClasses = "h-10 w-full rounded-xl border border-black/[0.08] bg-black/[0.02] px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#22C55E]/50 transition-all";

  return (
    <div className="space-y-8 animate-sprout">
      {/* Print stylesheet */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          nav, header, footer, button, select, .no-print { display: none !important; }
          .glass-card, .premium-card { background: white !important; border: 1px solid #e2e8f0 !important; box-shadow: none !important; color: black !important; }
          .text-white, [class*="text-[#F9FAFB]"] { color: black !important; }
          [class*="text-[#9CA3AF]"], [class*="text-[#D1D5DB]"] { color: #475569 !important; }
          #print-area { display: block !important; width: 100% !important; }
        }
      `}</style>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print relative overflow-hidden bg-gradient-to-r from-[#22C55E]/10 to-[#14B8A6]/10 p-6 rounded-3xl border border-black/[0.05] mb-4">
        {/* Abstract Growth/Analytics SVG background graphic */}
        <div className="absolute right-0 top-0 bottom-0 opacity-20 pointer-events-none flex items-center pr-6">
          <svg width="180" height="80" viewBox="0 0 180 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M 10 70 Q 40 40 80 50 T 150 10" stroke="#14B8A6" strokeWidth="3" strokeLinecap="round" />
            <path d="M 10 70 Q 40 60 80 30 T 150 20" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
            <circle cx="80" cy="50" r="4" fill="#22C55E" />
            <circle cx="150" cy="10" r="5" fill="#14B8A6" />
            {/* Sprouting leaves along the analytics line */}
            <path d="M 80 50 C 85 40 95 40 90 50 Z" fill="#84CC16" />
            <path d="M 40 55 C 43 48 50 48 47 55 Z" fill="#22C55E" />
          </svg>
        </div>
        <div className="relative z-10">
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A] mb-1">Analytics & Reports</h1>
          <p className="text-sm text-[#475569]">Deep dive into campaign performance and farmer insights.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 relative z-10">
          <select value={selectedCampaignId} onChange={(e) => setSelectedCampaignId(e.target.value)} className={selectClasses}>
            <option value="">All Campaigns (Aggregated)</option>
            {analytics.map((c) => (
              <option key={c.campaign_id} value={c.campaign_id}>{c.campaign_name}</option>
            ))}
          </select>
          <Button onClick={fetchAnalytics} variant="outline" className="border-black/[0.08] text-[#475569] hover:bg-black/[0.02] hover:text-[#0F172A]">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={handleExportExcel} variant="outline" className="border-black/[0.08] text-[#475569] hover:bg-black/[0.02] hover:text-[#0F172A]">
            <FileSpreadsheet className="mr-2 h-4 w-4 text-[#14B8A6]" /> Excel
          </Button>
          <Button onClick={handlePrintPDF} variant="outline" className="border-black/[0.08] text-[#475569] hover:bg-black/[0.02] hover:text-[#0F172A]">
            <FileText className="mr-2 h-4 w-4 text-red-500" /> PDF
          </Button>
        </div>
      </div>

      <div id="print-area" className="space-y-8">
        {/* Metric Cards Grid */}
        <div className={cn(
          "grid gap-4 grid-cols-1 sm:grid-cols-2",
          metricCards.length === 6 ? "lg:grid-cols-3 xl:grid-cols-6" :
          metricCards.length === 8 ? "lg:grid-cols-4 xl:grid-cols-4" : "lg:grid-cols-4"
        )}>
          {metricCards.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <Card key={i} className="premium-card border border-black/[0.05] overflow-hidden group">
                <div className={cn("absolute inset-0 bg-gradient-to-br opacity-10", stat.gradient)} />
                <CardHeader className="relative flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-xs font-medium text-[#475569] uppercase tracking-wider">{stat.title}</CardTitle>
                  <div className={cn("p-2 rounded-xl group-hover:scale-110 transition-transform duration-300", stat.iconBg, stat.iconColor)}>
                    <Icon className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent className="relative">
                  <div className="text-2xl font-bold text-[#0F172A]">
                    {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Charts Section */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Performance Trend */}
          <Card className="glass-card border-black/[0.05]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-[#0F172A]">Campaign Performance Trend</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              {chartsData.performance_trend.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#22C55E]/10 flex items-center justify-center">
                    <Inbox className="h-6 w-6 text-[#22C55E]/30" />
                  </div>
                  <p className="text-sm text-[#6B7280]">No response timeline data available</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartsData.performance_trend}>
                    <defs>
                      <linearGradient id="colorPosReport" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#14B8A6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#14B8A6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.04)" vertical={false} />
                    <XAxis dataKey="date" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="responses" name="Responses" stroke="#14B8A6" fillOpacity={1} fill="url(#colorPosReport)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Call Status Distribution */}
          <Card className="glass-card border-black/[0.05]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-[#0F172A]">Campaign Outcome Distribution</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center">
              {chartsData.status_distribution.length === 0 ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#22C55E]/10 flex items-center justify-center">
                    <Inbox className="h-6 w-6 text-[#22C55E]/30" />
                  </div>
                  <p className="text-sm text-[#6B7280]">No campaign outcome logs found</p>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col sm:flex-row items-center justify-around">
                  <div className="h-[220px] w-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={chartsData.status_distribution} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" strokeWidth={0}>
                          {chartsData.status_distribution.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 text-xs">
                    {chartsData.status_distribution.map((entry, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="font-semibold text-[#0F172A]">{entry.value}</span>
                        <span className="text-[#475569]">{entry.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Responses by Village */}
          <Card className="glass-card border-black/[0.05]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-[#0F172A]">Responses by Village</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              {chartsData.village_distribution.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#22C55E]/10 flex items-center justify-center">
                    <Inbox className="h-6 w-6 text-[#22C55E]/30" />
                  </div>
                  <p className="text-sm text-[#6B7280]">No village statistics found</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartsData.village_distribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.04)" vertical={false} />
                    <XAxis dataKey="name" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                    <RechartsTooltip contentStyle={tooltipStyle} />
                    <defs>
                      <linearGradient id="villageGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#14B8A6" />
                        <stop offset="100%" stopColor="#22C55E" />
                      </linearGradient>
                    </defs>
                    <Bar dataKey="value" name="Responses" fill="url(#villageGrad)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Responses by Crop */}
          <Card className="glass-card border-black/[0.05]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-[#0F172A]">Responses by Crop</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center">
              {chartsData.crop_distribution.length === 0 ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#22C55E]/10 flex items-center justify-center">
                    <Inbox className="h-6 w-6 text-[#22C55E]/30" />
                  </div>
                  <p className="text-sm text-[#6B7280]">No crop responses found</p>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col sm:flex-row items-center justify-around">
                  <div className="h-[220px] w-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={chartsData.crop_distribution} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" strokeWidth={0}>
                          {chartsData.crop_distribution.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 text-xs">
                    {chartsData.crop_distribution.map((entry, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="font-semibold text-[#0F172A]">{entry.value}</span>
                        <span className="text-[#475569]">{entry.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Detailed Analytics Table */}
        <Card className="glass-card border-black/[0.05]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-[#0F172A]">Detailed Campaign Analytics</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {loading ? (
              <p className="text-[#6B7280] text-center py-6 text-sm">Loading analytics data...</p>
            ) : analytics.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <div className="w-32 h-32 flex items-center justify-center opacity-85">
                  <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="25" y="45" width="12" height="30" rx="2" fill="#0F766E" opacity="0.4" />
                    <rect x="44" y="30" width="12" height="45" rx="2" fill="#14B8A6" opacity="0.6" />
                    <rect x="63" y="20" width="12" height="55" rx="2" fill="#22C55E" opacity="0.8" />
                    {/* Plant growing from the tallest bar */}
                    <path d="M 69 20 C 72 10 82 10 79 20 C 79 20 74 24 69 20 Z" fill="#84CC16" />
                    <path d="M 69 20 C 65 12 58 15 63 22" stroke="#22C55E" strokeWidth="1.5" fill="none" />
                  </svg>
                </div>
                <p className="text-sm text-[#6B7280]">No campaigns found to report on</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-black/[0.05]">
                    <TableHead className="text-[#475569] text-xs uppercase tracking-wider">Campaign Name</TableHead>
                    <TableHead className="text-[#475569] text-xs uppercase tracking-wider">Campaign Type</TableHead>
                    <TableHead className="text-[#475569] text-xs uppercase tracking-wider">Created Date</TableHead>
                    <TableHead className="text-[#475569] text-xs uppercase tracking-wider text-center">Targeted</TableHead>
                    <TableHead className="text-[#475569] text-xs uppercase tracking-wider text-center">Reached</TableHead>
                    <TableHead className="text-[#475569] text-xs uppercase tracking-wider text-center">Answered</TableHead>
                    <TableHead className="text-[#475569] text-xs uppercase tracking-wider text-center">Failed</TableHead>
                    <TableHead className="text-[#475569] text-xs uppercase tracking-wider text-center">Responses</TableHead>
                    <TableHead className="text-[#475569] text-xs uppercase tracking-wider text-right">Avg Duration</TableHead>
                    <TableHead className="text-[#475569] text-xs uppercase tracking-wider text-right">Success Rate</TableHead>
                    <TableHead className="text-[#475569] text-xs uppercase tracking-wider text-right">Campaign Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.map((c) => (
                    <TableRow 
                      key={c.campaign_id} 
                      onClick={() => setSelectedCampaignId(c.campaign_id.toString())}
                      className={cn(
                        "border-black/[0.05] hover:bg-black/[0.01] cursor-pointer transition-colors",
                        selectedCampaignId === c.campaign_id.toString() ? "bg-[#22C55E]/[0.06]" : ""
                      )}
                    >
                      <TableCell className="font-medium text-[#0F172A]">{c.campaign_name}</TableCell>
                      <TableCell className="text-[#475569] text-xs font-semibold">{c.campaign_type}</TableCell>
                      <TableCell className="text-[#475569]">
                        {c.created_at ? new Date(c.created_at).toLocaleString() : "Manual Start"}
                      </TableCell>
                      <TableCell className="text-[#475569] text-center">{c.farmers_targeted}</TableCell>
                      <TableCell className="text-[#475569] text-center">{c.farmers_reached}</TableCell>
                      <TableCell className="text-[#22C55E] text-center font-semibold">
                        {c.campaign_type === "Voice Campaign" ? (c.calls_answered ?? 0) : "-"}
                      </TableCell>
                      <TableCell className="text-red-500 text-center">{c.calls_failed}</TableCell>
                      <TableCell className="text-[#F59E0B] text-center font-semibold">{c.responses_collected}</TableCell>
                      <TableCell className="text-[#475569] text-right">
                        {c.campaign_type === "Voice Campaign" ? `${c.average_duration ?? 0}s` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className="bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/25 font-medium">
                          {c.success_rate}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className={cn(
                          "font-medium border",
                          c.campaign_status === "Successful" ? "bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/25" :
                          c.campaign_status === "Partial Success" ? "bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/25" :
                          "bg-red-500/15 text-red-500 border-red-500/25"
                        )}>
                          {c.campaign_status ?? "N/A"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
