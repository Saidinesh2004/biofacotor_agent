import { useState } from "react";
import { Plus, Play, Pause, Square, Calendar, Users, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { campaignsList } from "@/lib/mockData";

export default function Campaigns() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Running': return 'bg-primary/20 text-primary border-primary/30';
      case 'Scheduled': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Completed': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'Paused': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Campaigns</h1>
          <p className="text-slate-400">Manage voice and text broadcasting campaigns.</p>
        </div>
        
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-white shadow-[0_0_15px_rgba(22,163,74,0.4)]">
              <Plus className="mr-2 h-4 w-4" />
              New Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] bg-slate-900 border-white/10 text-white glass-card">
            <DialogHeader>
              <DialogTitle className="text-xl">Create New Campaign</DialogTitle>
              <DialogDescription className="text-slate-400">
                Set up a new broadcast campaign to reach your farmers.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right text-slate-300">
                  Name
                </Label>
                <Input id="name" placeholder="e.g. Pest Warning" className="col-span-3 bg-slate-950/50 border-white/10" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right text-slate-300">
                  Type
                </Label>
                <select id="type" className="col-span-3 h-10 w-full rounded-md border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/50">
                  <option>Voice Call</option>
                  <option>WhatsApp</option>
                  <option>SMS</option>
                </select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="date" className="text-right text-slate-300">
                  Schedule
                </Label>
                <Input id="date" type="datetime-local" className="col-span-3 bg-slate-950/50 border-white/10 [color-scheme:dark]" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsModalOpen(false)} className="border-white/10 text-slate-300 hover:bg-white/5 hover:text-white">
                Cancel
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-white" onClick={() => setIsModalOpen(false)}>
                Create Campaign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {campaignsList.map((campaign) => (
          <Card key={campaign.id} className="glass-card border-none hover-glow group transition-all duration-300">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start mb-2">
                <Badge variant="outline" className={getStatusColor(campaign.status)}>
                  {campaign.status}
                </Badge>
              </div>
              <CardTitle className="text-lg font-bold text-white line-clamp-1" title={campaign.name}>
                {campaign.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3 space-y-4">
              <div className="space-y-2 text-sm text-slate-400">
                <div className="flex items-center">
                  <Calendar className="mr-2 h-4 w-4 text-slate-500" />
                  <span>{campaign.scheduledTime}</span>
                </div>
                <div className="flex items-center">
                  <Users className="mr-2 h-4 w-4 text-slate-500" />
                  <span>{campaign.farmersCount.toLocaleString()} Farmers</span>
                </div>
              </div>
              
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-slate-300">
                  <span>Progress</span>
                  <span>{campaign.progress}%</span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-1000 ease-in-out"
                    style={{ width: `${campaign.progress}%` }}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-3 border-t border-white/5 flex justify-between gap-2">
              {campaign.status === 'Running' ? (
                <>
                  <Button size="sm" variant="outline" className="flex-1 bg-yellow-500/10 text-yellow-500 border-yellow-500/20 hover:bg-yellow-500/20 hover:text-yellow-400">
                    <Pause className="mr-1 h-3.5 w-3.5" /> Pause
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20 hover:text-red-400">
                    <Square className="mr-1 h-3.5 w-3.5" /> Stop
                  </Button>
                </>
              ) : campaign.status === 'Paused' ? (
                <Button size="sm" variant="outline" className="flex-1 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 hover:text-primary">
                  <Play className="mr-1 h-3.5 w-3.5" /> Resume
                </Button>
              ) : campaign.status === 'Scheduled' ? (
                <Button size="sm" className="w-full bg-primary hover:bg-primary/90 text-white">
                  <Play className="mr-1 h-3.5 w-3.5" /> Start Now
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="w-full border-white/10 text-slate-300 hover:bg-white/5 hover:text-white">
                  <Activity className="mr-1 h-3.5 w-3.5" /> View Report
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
