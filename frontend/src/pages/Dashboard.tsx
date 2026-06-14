import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, PhoneCall, PhoneForwarded, PhoneMissed, MessageSquare, RefreshCw, Megaphone, Wifi, WifiOff, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { campaignProgressData, callsByStatusData } from "@/lib/mockData";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export default function Dashboard() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [stats, setStats] = useState({
    total_farmers: 0,
    calls_initiated: 0,
    calls_completed: 0,
    calls_failed: 0,
    total_responses: 0,
    today_calls: 0,
    today_responses: 0
  });

  const fetchStats = async () => {
    try {
      const res = await api.get("/dashboard/stats");
      setStats(res.data);
      setIsConnected(true);
    } catch (error) {
      console.error("Failed to fetch dashboard stats", error);
      setIsConnected(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const statCards = [
    { title: "Total Farmers", value: stats.total_farmers, icon: Users, color: "text-blue-400" },
    { title: "Calls Completed", value: stats.calls_completed, icon: PhoneForwarded, color: "text-emerald-500" },
    { title: "Calls Failed", value: stats.calls_failed, icon: PhoneMissed, color: "text-red-400" },
    { title: "Total Responses", value: stats.total_responses, icon: MessageSquare, color: "text-green-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
            {isConnected === null ? (
              <Badge variant="outline" className="bg-slate-800/50 text-slate-400 border-slate-700 font-normal">
                <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Checking Backend
              </Badge>
            ) : isConnected ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-normal">
                <Wifi className="w-3 h-3 mr-1.5" /> Backend Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 font-normal">
                <WifiOff className="w-3 h-3 mr-1.5" /> Backend Offline
              </Badge>
            )}
          </div>
          <p className="text-slate-400">Overview of your Biofactor Farmer Voice AI platform.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className="glass-card border-none hover-glow">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-slate-300">{stat.title}</CardTitle>
                <div className={`p-2 rounded-full bg-slate-800/50 ${stat.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{stat.value.toLocaleString()}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="glass-card border-none lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-slate-200">Today's Activity</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
             {/* Using simple placeholder bar chart for today's stats since campaign mock data is still there but we want to show real data */}
             <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'Today Calls', count: stats.today_calls },
                { name: 'Today Responses', count: stats.today_responses }
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
                <Bar dataKey="count" fill="#16A34A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card border-none">
          <CardHeader>
            <CardTitle className="text-slate-200">Calls by Status</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Completed', value: stats.calls_completed, fill: '#16A34A' },
                    { name: 'Failed/Other', value: stats.calls_failed, fill: '#ef4444' }
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {callsByStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
