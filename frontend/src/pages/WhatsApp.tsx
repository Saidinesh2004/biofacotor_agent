import { useState, useEffect } from "react";
import { Send, Calendar, MessageCircle, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import api from "@/lib/api";

export default function WhatsApp() {
  const [message, setMessage] = useState("");
  const [selectedFarmers, setSelectedFarmers] = useState<number[]>([]);
  const [farmersList, setFarmersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

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
  }, []);

  const toggleFarmer = (id: number) => {
    if (selectedFarmers.includes(id)) {
      setSelectedFarmers(selectedFarmers.filter(fId => fId !== id));
    } else {
      setSelectedFarmers([...selectedFarmers, id]);
    }
  };

  const handleSend = async () => {
    setSending(true);
    try {
      for (const farmerId of selectedFarmers) {
        const farmer = farmersList.find(f => f.id === farmerId);
        if (farmer) {
          await api.post("/whatsapp/send", {
            farmer_id: farmer.id,
            phone: farmer.phone,
            message: message,
            status: "Delivered"
          });
        }
      }
      setMessage("");
      setSelectedFarmers([]);
      alert("Messages sent successfully!");
    } catch (err) {
      console.error("Failed to send messages", err);
      alert("Failed to send messages.");
    } finally {
      setSending(false);
    }
  };

  const handleTemplateSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === "pest") {
      setMessage("Dear Farmer, there is a high risk of pest attack for [Crop] in your area. Please use recommended pesticides. - Biofactor AI");
    } else if (e.target.value === "weather") {
      setMessage("Weather Alert: Heavy rainfall expected in [Village] over the next 48 hours. Take necessary precautions for your crops. - Biofactor AI");
    } else if (e.target.value === "market") {
      setMessage("Market Update: Today's price for [Crop] at your nearest mandi is [Price]/quintal. - Biofactor AI");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">WhatsApp Broadcast</h1>
        <p className="text-slate-400">Send text messages and alerts directly to farmers' WhatsApp.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass-card border-none">
          <CardContent className="p-4 flex items-center space-x-4">
            <div className="p-3 bg-blue-500/20 text-blue-400 rounded-full">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Total Sent</p>
              <h3 className="text-2xl font-bold text-white">0</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-none">
          <CardContent className="p-4 flex items-center space-x-4">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-full">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Delivered</p>
              <h3 className="text-2xl font-bold text-white">0</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-none">
          <CardContent className="p-4 flex items-center space-x-4">
            <div className="p-3 bg-purple-500/20 text-purple-400 rounded-full">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Read</p>
              <h3 className="text-2xl font-bold text-white">0</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-none">
          <CardContent className="p-4 flex items-center space-x-4">
            <div className="p-3 bg-red-500/20 text-red-400 rounded-full">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Failed</p>
              <h3 className="text-2xl font-bold text-white">0</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 glass-card border-none flex flex-col h-[600px]">
          <CardHeader className="border-b border-white/5 pb-4">
            <CardTitle className="text-lg text-slate-200">Select Recipients</CardTitle>
            <p className="text-sm text-slate-400">{selectedFarmers.length} farmers selected</p>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="p-4 text-center text-slate-500">Loading farmers...</div>
            ) : farmersList.map(farmer => (
              <div 
                key={farmer.id} 
                className={`p-4 border-b border-white/5 flex items-center justify-between cursor-pointer transition-colors ${selectedFarmers.includes(farmer.id) ? 'bg-primary/10 border-l-4 border-l-primary' : 'hover:bg-white/5 border-l-4 border-l-transparent'}`}
                onClick={() => toggleFarmer(farmer.id)}
              >
                <div>
                  <h4 className="text-sm font-medium text-slate-200">{farmer.name}</h4>
                  <p className="text-xs text-slate-500">{farmer.phone} • {farmer.village}</p>
                </div>
                <div className={`h-5 w-5 rounded border ${selectedFarmers.includes(farmer.id) ? 'bg-primary border-primary flex items-center justify-center' : 'border-slate-600'}`}>
                  {selectedFarmers.includes(farmer.id) && <CheckCircle2 className="h-3 w-3 text-white" />}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 glass-card border-none flex flex-col h-[600px]">
          <CardHeader className="border-b border-white/5 pb-4">
            <CardTitle className="text-lg text-slate-200">Compose Message</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-6 space-y-6">
            <div className="space-y-3">
              <Label htmlFor="template" className="text-slate-300">Use Template (Optional)</Label>
              <select 
                id="template" 
                onChange={handleTemplateSelect}
                className="w-full h-10 rounded-md border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                <option value="">Select a template...</option>
                <option value="pest">Pest Attack Warning</option>
                <option value="weather">Weather Alert</option>
                <option value="market">Market Price Update</option>
              </select>
            </div>

            <div className="space-y-3 flex-1 flex flex-col h-[280px]">
              <div className="flex justify-between items-center">
                <Label htmlFor="message" className="text-slate-300">Message Content</Label>
                <span className="text-xs text-slate-500">{message.length}/1024 characters</span>
              </div>
              <Textarea 
                id="message" 
                placeholder="Type your message here..." 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="flex-1 bg-slate-950/50 border-white/10 text-slate-200 resize-none focus-visible:ring-primary/50 p-4"
              />
              <p className="text-xs text-slate-500">Variables available: [Name], [Crop], [Village], [Price]</p>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-white/5">
              <Button variant="outline" className="border-white/10 text-slate-300 hover:bg-white/5 hover:text-white">
                <Calendar className="mr-2 h-4 w-4" />
                Schedule
              </Button>
              <Button 
                className="bg-primary hover:bg-primary/90 text-white shadow-[0_0_15px_rgba(22,163,74,0.4)]" 
                disabled={selectedFarmers.length === 0 || message.length === 0 || sending}
                onClick={handleSend}
              >
                <Send className="mr-2 h-4 w-4" />
                {sending ? "Sending..." : "Send Now"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
