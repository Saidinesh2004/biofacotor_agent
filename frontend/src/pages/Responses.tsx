import { useState, useEffect } from "react";
import api from "@/lib/api";
import { MessageSquareText, PhoneCall, Download, Search, RefreshCw, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export default function Responses() {
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResponse, setSelectedResponse] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  const [search, setSearch] = useState("");
  const [filterCampaign, setFilterCampaign] = useState("");
  const [filterVillage, setFilterVillage] = useState("");
  const [filterCrop, setFilterCrop] = useState("");
  const [page, setPage] = useState(0);
  const limit = 20;

  const fetchCampaigns = async () => {
    try {
      const res = await api.get("/campaigns");
      setCampaigns(res.data);
    } catch (error) {
      console.error("Failed to load campaigns list", error);
    }
  };

  const fetchResponses = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append("skip", (page * limit).toString());
      params.append("limit", limit.toString());
      if (search) params.append("search", search);
      if (filterCampaign) params.append("campaign_id", filterCampaign);
      if (filterVillage) params.append("village", filterVillage);
      if (filterCrop) params.append("crop", filterCrop);

      const res = await api.get(`/responses?${params.toString()}`);
      setResponses(res.data);
    } catch (error) {
      console.error("Failed to load responses", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  useEffect(() => {
    fetchResponses();
  }, [page, search, filterCampaign, filterVillage, filterCrop]);

  useEffect(() => {
    if (!selectedResponse) return;

    let active = true;
    let pollInterval: any = null;

    const fetchDetail = async () => {
      try {
        const callType = selectedResponse.campaign_name === "Direct Call" ? "direct" : "campaign";
        const res = await api.get(`/responses/${selectedResponse.id}?call_type=${callType}`);
        
        if (!active) return;

        setSelectedResponse(res.data);

        setResponses((prev) =>
          prev.map((item) =>
            item.id === res.data.id && item.campaign_name === res.data.campaign_name
              ? res.data
              : item
          )
        );

        if (res.data.conversation_summary && pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      } catch (error) {
        console.error("Failed to fetch response detail", error);
      }
    };

    fetchDetail();

    if (!selectedResponse.conversation_summary) {
      let attempts = 0;
      pollInterval = setInterval(() => {
        attempts++;
        if (attempts > 15) {
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
          return;
        }
        fetchDetail();
      }, 3000);
    }

    return () => {
      active = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [selectedResponse?.id, selectedResponse?.campaign_name]);

  const handleExportCSV = () => {
    if (responses.length === 0) return;

    const headers = [
      "Campaign Name", "Farmer Name", "Phone Number", "Call Status",
      "Duration (s)", "Conversation Summary", "Transcript", "Date"
    ];

    const csvContent = [
      headers.join(","),
      ...responses.map((r) => {
        let transcriptText = "";
        if (Array.isArray(r.farmer_responses)) {
          transcriptText = r.farmer_responses
            .map((msg: any) => `${msg.role === "agent" ? "AI" : "Farmer"}: ${msg.content || msg.message || ""}`)
            .join(" | ");
        } else {
          transcriptText = r.farmer_responses || "";
        }

        return [
          `"${(r.campaign_name || "Direct Call").replace(/"/g, '""')}"`,
          `"${(r.farmer_name || "").replace(/"/g, '""')}"`,
          `"${r.phone_number || ""}"`,
          `"${r.call_status || ""}"`,
          `"${r.call_duration || 0}"`,
          `"${(r.conversation_summary || "").replace(/"/g, '""')}"`,
          `"${transcriptText.replace(/"/g, '""')}"`,
          `"${new Date(r.created_at).toLocaleString()}"`
        ].join(",");
      }),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "farmer_campaign_responses.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    const isCompleted = status === "completed" || status === "Completed";
    return (
      <Badge
        variant="outline"
        className={
          isCompleted
            ? "border-[#0F766E]/25 text-[#14B8A6] bg-[#0F766E]/10"
            : "border-amber-500/25 text-amber-400 bg-amber-500/10"
        }
      >
        {status}
      </Badge>
    );
  };

  const handleCallFarmer = async (farmerId: number, phone: string) => {
    try {
      await api.post("/voice-calls/", {
        farmer_id: farmerId,
        phone: phone,
      });
      alert(`Call initiated.`);
      fetchResponses();
    } catch (error) {
      alert("Failed to initiate call.");
    }
  };

  const selectClasses = "h-10 w-full rounded-xl border border-black/[0.08] bg-black/[0.02] px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#22C55E]/50 transition-all";

  return (
    <div className="space-y-8 animate-sprout">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A] mb-1">Farmer Responses</h1>
          <p className="text-sm text-[#475569]">Review AI-analyzed responses and transcripts from farmer calls.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchResponses} variant="outline" className="border-black/[0.08] text-[#475569] hover:bg-black/[0.02] hover:text-[#0F172A]">
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button onClick={handleExportCSV} variant="outline" className="border-black/[0.08] text-[#475569] hover:bg-black/[0.02] hover:text-[#0F172A]">
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      <div className="glass-card rounded-2xl border border-black/[0.05] overflow-hidden">
        {/* Filters */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 border-b border-black/[0.05] bg-black/[0.01]">
          <div className="relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280] group-focus-within:text-[#22C55E] transition-colors" />
            <Input
              placeholder="Search farmer name/phone..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-10 bg-black/[0.02] border-black/[0.06] focus-visible:ring-[#22C55E]/30 text-[#0F172A]"
            />
          </div>
          <select value={filterCampaign} onChange={(e) => { setFilterCampaign(e.target.value); setPage(0); }} className={selectClasses}>
            <option value="">All Campaigns</option>
            <option value="direct">Direct Calls Only</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.campaign_name}</option>
            ))}
          </select>
          <Input placeholder="Filter by Village" value={filterVillage} onChange={(e) => { setFilterVillage(e.target.value); setPage(0); }}
            className="bg-black/[0.02] border-black/[0.06] text-[#0F172A]" />
          <Input placeholder="Filter by Crop" value={filterCrop} onChange={(e) => { setFilterCrop(e.target.value); setPage(0); }}
            className="bg-black/[0.02] border-black/[0.06] text-[#0F172A]" />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-black/[0.01]">
              <TableRow className="border-black/[0.05] hover:bg-transparent">
                <TableHead className="text-[#475569] font-medium whitespace-nowrap text-xs uppercase tracking-wider">Campaign</TableHead>
                <TableHead className="text-[#475569] font-medium whitespace-nowrap text-xs uppercase tracking-wider">Farmer</TableHead>
                <TableHead className="text-[#475569] font-medium whitespace-nowrap text-xs uppercase tracking-wider">Phone</TableHead>
                <TableHead className="text-[#475569] font-medium whitespace-nowrap text-xs uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-[#475569] font-medium whitespace-nowrap text-xs uppercase tracking-wider">Date & Time</TableHead>
                <TableHead className="text-[#475569] font-medium whitespace-nowrap text-xs uppercase tracking-wider">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-[#6B7280]">Loading responses...</TableCell>
                </TableRow>
              ) : responses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-[#0F766E]/10 flex items-center justify-center">
                        <Inbox className="h-7 w-7 text-[#0F766E]/40" />
                      </div>
                      <p className="text-sm text-[#6B7280]">No responses found</p>
                      <p className="text-xs text-[#4B5563]">Responses will appear here after campaign calls complete.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                responses.map((row) => (
                  <TableRow key={row.id} className="border-black/[0.05] hover:bg-black/[0.01] transition-colors">
                    <TableCell className="text-[#0F172A] py-4 font-medium whitespace-nowrap">{row.campaign_name || "Direct Call"}</TableCell>
                    <TableCell className="text-[#0F172A] py-4 whitespace-nowrap">{row.farmer_name}</TableCell>
                    <TableCell className="text-[#475569] py-4 whitespace-nowrap">{row.phone_number}</TableCell>
                    <TableCell className="py-4 whitespace-nowrap">{getStatusBadge(row.call_status)}</TableCell>
                    <TableCell className="text-[#475569] py-4 whitespace-nowrap">{new Date(row.created_at).toLocaleString()}</TableCell>
                    <TableCell className="py-4 whitespace-nowrap">
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm"
                          className="border-black/[0.08] text-[#475569] hover:bg-black/[0.02] hover:text-[#0F172A] h-8 text-xs"
                          onClick={() => setSelectedResponse(row)}>
                          <MessageSquareText className="mr-1.5 h-3.5 w-3.5" /> View
                        </Button>
                        {row.farmer_id && (
                          <Button onClick={() => handleCallFarmer(row.farmer_id, row.phone_number)} size="sm"
                            className="h-8 bg-gradient-to-r from-[#22C55E] to-[#14B8A6] hover:from-[#16A34A] hover:to-[#0D9488] text-white text-xs border-0 shadow-glow-green">
                            <PhoneCall className="mr-1.5 h-3.5 w-3.5" /> Call Again
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-end space-x-2 p-4 border-t border-black/[0.05] bg-black/[0.01]">
          <Button variant="outline" size="sm" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
            className="border-black/[0.08] text-[#475569] hover:bg-black/[0.02] text-xs">Previous</Button>
          <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={responses.length < limit}
            className="border-black/[0.08] text-[#475569] hover:bg-black/[0.02] text-xs">Next</Button>
        </div>
      </div>

      {/* Response Detail Sheet */}
      <Sheet open={!!selectedResponse} onOpenChange={(open) => !open && setSelectedResponse(null)}>
        <SheetContent className="bg-white border-l border-black/[0.08] text-[#0F172A] w-full sm:max-w-md overflow-y-auto custom-scrollbar shadow-xl">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-[#0F172A] flex items-center gap-2">
              <MessageSquareText className="h-5 w-5 text-[#22C55E]" />
              Call Summary
            </SheetTitle>
            <SheetDescription className="text-[#475569]">
              Details for {selectedResponse?.farmer_name}
            </SheetDescription>
          </SheetHeader>

          {selectedResponse && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 p-4 bg-black/[0.01] rounded-xl border border-black/[0.05]">
                <div>
                  <p className="text-[10px] text-[#6B7280] mb-1 uppercase tracking-wider font-medium">Campaign</p>
                  <p className="text-sm font-semibold text-[#0F172A]">{selectedResponse.campaign_name || "Direct Call"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#6B7280] mb-1 uppercase tracking-wider font-medium">Phone</p>
                  <p className="text-sm font-semibold text-[#0F172A]">{selectedResponse.phone_number}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#6B7280] mb-1 uppercase tracking-wider font-medium">Status</p>
                  <p className="text-sm font-semibold text-[#0F172A]">{selectedResponse.call_status}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#6B7280] mb-1 uppercase tracking-wider font-medium">Duration</p>
                  <p className="text-sm font-semibold text-[#0F172A]">
                    {selectedResponse.call_duration ? `${selectedResponse.call_duration}s` : "Unknown"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] text-[#6B7280] mb-1 uppercase tracking-wider font-medium">Date</p>
                  <p className="text-sm font-semibold text-[#0F172A]">{new Date(selectedResponse.created_at).toLocaleString()}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-black/[0.05]">
                <h4 className="text-xs font-semibold text-[#0F172A] mb-2 uppercase tracking-wider">AI Summary</h4>
                <p className="text-sm text-[#475569] leading-relaxed bg-black/[0.01] p-3 rounded-xl border border-black/[0.05]">
                  {selectedResponse.conversation_summary || "No summary generated yet."}
                </p>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-semibold text-[#0F172A] border-b border-black/[0.05] pb-2 uppercase tracking-wider">Transcript</h4>

                <div className="space-y-3 text-sm">
                  {selectedResponse.farmer_responses ? (
                    Array.isArray(selectedResponse.farmer_responses) ? (
                      selectedResponse.farmer_responses.map((msg: any, idx: number) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border border-black/[0.05] ${
                            msg.role === "agent" ? "bg-[#22C55E]/[0.08] ml-4" : "bg-black/[0.01] mr-4"
                          }`}
                        >
                          <strong className="text-[10px] uppercase tracking-wider text-[#475569]">{msg.role === "agent" ? "AI" : "Farmer"}</strong>
                          <p className="text-[#334155] mt-1">{msg.content || msg.message || ""}</p>
                        </div>
                      ))
                    ) : (
                      <pre className="whitespace-pre-wrap font-sans bg-black/[0.01] p-3 rounded-xl border border-black/[0.05] text-[#334155]">
                        {selectedResponse.farmer_responses}
                      </pre>
                    )
                  ) : (
                    <p className="text-[#6B7280] italic text-sm">No transcript available.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
