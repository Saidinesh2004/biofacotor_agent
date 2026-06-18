import { useState, useEffect } from "react";
import { Send, Calendar, FileText, CheckCircle2, AlertCircle, Search, UserPlus, X, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/api";

export default function WhatsApp() {
  const [message, setMessage] = useState("");
  const [selectedFarmers, setSelectedFarmers] = useState<number[]>([]);
  const [manualNumbers, setManualNumbers] = useState<string[]>([]);
  const [newNumber, setNewNumber] = useState("");
  const [farmersList, setFarmersList] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [stats, setStats] = useState({
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0
  });

  const fetchStats = async () => {
    try {
      const response = await api.get("/whatsapp/stats");
      setStats(response.data);
    } catch (err) {
      console.error("Failed to fetch WhatsApp stats", err);
    }
  };

  useEffect(() => {
    const fetchFarmers = async () => {
      try {
        const response = await api.get("/farmers");
        setFarmersList(response.data);
      } catch (err) {
        console.error("Failed to fetch farmers", err);
      } finally {
        setLoading(false);
      }
    };
    fetchFarmers();
    fetchStats();
  }, []);

  const toggleFarmer = (id: number) => {
    if (selectedFarmers.includes(id)) {
      setSelectedFarmers(selectedFarmers.filter(fId => fId !== id));
    } else {
      setSelectedFarmers([...selectedFarmers, id]);
    }
  };

  const addManualNumber = () => {
    if (newNumber.trim() && !manualNumbers.includes(newNumber.trim())) {
      setManualNumbers([...manualNumbers, newNumber.trim()]);
      setNewNumber("");
    }
  };

  const removeManualNumber = (num: string) => {
    setManualNumbers(manualNumbers.filter(n => n !== num));
  };

  const handleSend = async () => {
    if ((selectedFarmers.length === 0 && manualNumbers.length === 0) || !message) return;

    setSending(true);
    try {
      for (const farmerId of selectedFarmers) {
        const farmer = farmersList.find(f => f.id === farmerId);
        if (farmer) {
          await api.post("/whatsapp/send", {
            farmer_id: farmer.id,
            phone: farmer.phone,
            message: message,
          });
        }
      }

      for (const num of manualNumbers) {
        await api.post("/whatsapp/send", {
          phone: num,
          message: message,
        });
      }

      setMessage("");
      setSelectedFarmers([]);
      setManualNumbers([]);
      alert("Broadcast initiated successfully!");
      fetchStats();
    } catch (err: any) {
      console.error("Failed to send messages", err);
      const errorMsg = err.response?.data?.detail || "Failed to send some messages. Please check your connection or Twilio settings.";
      alert(errorMsg);
    } finally {
      setSending(false);
    }
  };

  const filteredFarmers = farmersList.filter(f =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.phone.includes(searchTerm) ||
    f.village.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleTemplateSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === "pest") {
      setMessage("Dear Farmer, there is a high risk of pest attack for [Crop] in your area. Please use recommended pesticides. - Biofactor AI");
    } else if (e.target.value === "weather") {
      setMessage("Weather Alert: Heavy rainfall expected in [Village] over the next 48 hours. Take necessary precautions for your crops. - Biofactor AI");
    } else if (e.target.value === "market") {
      setMessage("Market Update: Today's price for [Crop] at your nearest mandi is [Price]/quintal. - Biofactor AI");
    }
  };

  const statCards = [
    { label: "Total Sent", value: stats.sent, icon: Send, gradient: "from-[#22C55E]/10 to-transparent", iconBg: "bg-[#22C55E]/10", iconColor: "text-[#22C55E]" },
    { label: "Delivered", value: stats.delivered, icon: CheckCircle2, gradient: "from-[#22C55E]/10 to-transparent", iconBg: "bg-[#22C55E]/10", iconColor: "text-[#22C55E]" },
    { label: "Read", value: stats.read, icon: FileText, gradient: "from-[#06B6D4]/10 to-transparent", iconBg: "bg-[#06B6D4]/10", iconColor: "text-[#06B6D4]" },
    { label: "Failed", value: stats.failed, icon: AlertCircle, gradient: "from-red-500/10 to-transparent", iconBg: "bg-red-500/10", iconColor: "text-red-500" },
  ];

  return (
    <div className="space-y-8 animate-sprout">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0F172A] mb-1">WhatsApp Broadcast</h1>
        <p className="text-sm text-[#475569]">Send instant alerts and updates to farmers via WhatsApp.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className="premium-card border border-black/[0.05] overflow-hidden group">
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-50`} />
              <CardContent className="relative p-4 flex items-center space-x-4">
                <div className={`p-3 ${stat.iconBg} ${stat.iconColor} rounded-xl group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-[#475569] uppercase tracking-wider">{stat.label}</p>
                  <h3 className="text-2xl font-bold text-[#0F172A]">{stat.value.toLocaleString()}</h3>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recipients Panel */}
        <Card className="lg:col-span-1 glass-card border-black/[0.05] flex flex-col h-[650px] overflow-hidden">
          <CardHeader className="border-b border-black/[0.05] pb-4 space-y-4 flex-shrink-0">
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm font-semibold text-[#0F172A]">Recipients</CardTitle>
              <Badge variant="outline" className="bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20 text-[10px]">
                {selectedFarmers.length + manualNumbers.length} Total
              </Badge>
            </div>

            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280] group-focus-within:text-[#22C55E] transition-colors" />
              <Input
                placeholder="Search database..."
                className="pl-9 bg-black/[0.02] border-black/[0.06] text-xs text-[#0F172A]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-[0.15em] text-[#475569] font-semibold">Add Manually</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Phone number..."
                  className="bg-black/[0.02] border-black/[0.06] text-xs h-8 text-[#0F172A]"
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addManualNumber()}
                />
                <Button size="sm" variant="secondary" className="h-8 px-2 bg-black/[0.04] hover:bg-black/[0.08] text-[#475569] hover:text-[#0F172A]" onClick={addManualNumber}>
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
              {manualNumbers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {manualNumbers.map(num => (
                    <span key={num} className="flex items-center gap-1 px-2 py-0.5 bg-[#22C55E]/10 text-[#22C55E] rounded-full text-[10px] font-medium border border-[#22C55E]/20">
                      {num}
                      <X className="h-3 w-3 cursor-pointer hover:text-[#0F172A]" onClick={() => removeManualNumber(num)} />
                    </span>
                  ))}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="p-4 text-center text-[#6B7280] text-sm">Loading database...</div>
            ) : filteredFarmers.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-[#22C55E]/10 flex items-center justify-center">
                  <Sprout className="h-6 w-6 text-[#22C55E]/30" />
                </div>
                <p className="text-xs text-[#6B7280]">No farmers found</p>
              </div>
            ) : filteredFarmers.map(farmer => (
              <div 
                key={farmer.id} 
                className={`p-3.5 border-b border-black/[0.03] flex items-center justify-between cursor-pointer transition-all duration-200 ${
                  selectedFarmers.includes(farmer.id) 
                    ? 'bg-[#22C55E]/[0.08] border-l-[3px] border-l-[#22C55E]' 
                    : 'hover:bg-black/[0.01] border-l-[3px] border-l-transparent'
                }`}
                onClick={() => toggleFarmer(farmer.id)}
              >
                <div>
                  <h4 className="text-sm font-medium text-[#0F172A]">{farmer.name}</h4>
                  <p className="text-[10px] text-[#6B7280] flex items-center gap-1 mt-0.5">
                    {farmer.phone} <span className="opacity-30">•</span> {farmer.village}
                  </p>
                </div>
                <div className={`h-5 w-5 rounded-full border-2 transition-all duration-200 flex items-center justify-center ${
                  selectedFarmers.includes(farmer.id) 
                    ? 'bg-[#22C55E] border-[#22C55E] scale-110' 
                    : 'border-black/[0.15]'
                }`}>
                  {selectedFarmers.includes(farmer.id) && <CheckCircle2 className="h-3 w-3 text-white" />}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Compose Panel */}
        <Card className="lg:col-span-2 glass-card border-black/[0.05] flex flex-col h-[650px]">
          <CardHeader className="border-b border-black/[0.05] pb-4 flex-shrink-0">
            <CardTitle className="text-sm font-semibold text-[#0F172A]">Compose Message</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-6 space-y-5 overflow-y-auto custom-scrollbar">
            <div className="space-y-2">
              <Label htmlFor="template" className="text-xs font-medium text-[#475569]">Use Template (Optional)</Label>
              <select 
                id="template" 
                onChange={handleTemplateSelect}
                className="w-full h-10 rounded-xl border border-black/[0.08] bg-black/[0.02] px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#22C55E]/50 transition-all"
              >
                <option value="">Select a template...</option>
                <option value="pest">Pest Attack Warning</option>
                <option value="weather">Weather Alert</option>
                <option value="market">Market Price Update</option>
              </select>
            </div>

            <div className="space-y-2 flex-1 flex flex-col min-h-[300px]">
              <div className="flex justify-between items-center">
                <Label htmlFor="message" className="text-xs font-medium text-[#475569]">Message Content</Label>
                <span className="text-[10px] text-[#6B7280] font-mono">{message.length}/1024</span>
              </div>
              <Textarea 
                id="message" 
                placeholder="Type your message here..." 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="flex-1 bg-black/[0.02] border-black/[0.06] text-[#0F172A] resize-none focus-visible:ring-[#22C55E]/30 p-4 min-h-[250px]"
              />
              <div className="flex gap-2 flex-wrap">
                {['[Name]', '[Crop]', '[Village]', '[Price]'].map(tag => (
                  <button
                    key={tag}
                    onClick={() => setMessage(prev => prev + tag)}
                    className="text-[10px] px-2.5 py-1 bg-black/[0.02] border border-black/[0.06] rounded-lg hover:bg-black/[0.04] text-[#475569] hover:text-[#0F172A] transition-all"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-black/[0.05]">
              <Button variant="outline" className="border-black/[0.08] text-[#475569] hover:bg-black/[0.02] hover:text-[#0F172A]">
                <Calendar className="mr-2 h-4 w-4" />
                Schedule
              </Button>
              <Button 
                className="bg-gradient-to-r from-[#22C55E] to-[#14B8A6] hover:from-[#16A34A] hover:to-[#0D9488] text-white shadow-glow-green border-0 px-8"
                disabled={(selectedFarmers.length === 0 && manualNumbers.length === 0) || message.length === 0 || sending}
                onClick={handleSend}
              >
                {sending ? (
                  <>
                    <Send className="mr-2 h-4 w-4 animate-pulse" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Now
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
