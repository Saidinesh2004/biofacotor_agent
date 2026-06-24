import { useState, useEffect, useRef } from "react";
import { 
  Plus, Play, Calendar, Users, Activity, Search, RefreshCw, 
  Trash2, Rocket, Upload, Download, CheckCircle2, AlertCircle,
  Clock, XCircle, Megaphone, MoreHorizontal, Phone, Check, Filter,
  Sparkles, Loader2
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import api from "@/lib/api";

const Sparkline = ({ data, color }: { data: number[]; color: string }) => {
  const chartData = data.map((val, i) => ({ value: val, index: i }));
  return (
    <div className="w-[100px] h-[35px] flex-shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke={color} 
            strokeWidth={1.5} 
            fill={`url(#grad-${color})`} 
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

const cn = (...classes: string[]) => classes.filter(Boolean).join(" ");

const getCampaignIllustration = (name: string, desc: string) => {
  const combined = `${name} ${desc || ""}`.toLowerCase();
  if (combined.includes("cotton")) {
    return (
      <div className="w-20 h-20 rounded-full bg-[#ECFDF5] flex items-center justify-center overflow-hidden border border-emerald-100/40 flex-shrink-0">
        <img src="/farming_sprout_icon.png" alt="Cotton" className="w-14 h-14 object-contain" />
      </div>
    );
  }
  if (combined.includes("paddy") || combined.includes("fertilizer") || combined.includes("rice") || combined.includes("crop")) {
    return (
      <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center overflow-hidden border border-amber-100/40 flex-shrink-0">
        <img src="/farming_wheat_icon.png" alt="Paddy" className="w-14 h-14 object-contain" />
      </div>
    );
  }
  if (combined.includes("rain") || combined.includes("weather") || combined.includes("monsoon") || combined.includes("advisory") || combined.includes("season")) {
    return (
      <div className="w-20 h-20 rounded-full bg-sky-50 flex items-center justify-center overflow-hidden border border-sky-100/40 flex-shrink-0">
        <svg className="w-11 h-11 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21v-1.5m3 1.5v-1.5m3 1.5v-1.5m3 1.5v-1.5" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center overflow-hidden border border-emerald-100/40 flex-shrink-0">
      <img src="/welcome_farmer.png" alt="Farmer" className="w-full h-full object-cover" />
    </div>
  );
};

const formatCampaignDate = (dateStr: string) => {
  if (!dateStr) return "Manual Start";
  const date = new Date(dateStr);
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
};

export default function Campaigns() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [type, setType] = useState("Voice Campaign");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [status, setStatus] = useState("Scheduled");

  // Farmers lists & selection states
  const [farmers, setFarmers] = useState<any[]>([]);
  const [selectedFarmerIds, setSelectedFarmerIds] = useState<number[]>([]);
  const [filterName, setFilterName] = useState("");
  const [filterPhone, setFilterPhone] = useState("");
  const [filterVillage, setFilterVillage] = useState("");
  const [filterCrop, setFilterCrop] = useState("");

  // Excel Upload States
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [excelStep, setExcelStep] = useState<"idle" | "mapping" | "preview" | "success">("idle");
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState({
    name: "",
    phone: "",
    village: "",
    crop: "",
    language: "",
  });
  const [validatedRecords, setValidatedRecords] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState({ added: 0, skipped: 0, failed: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls") || file.name.endsWith(".csv"))) {
      handleFileSelect(file);
    } else {
      alert("Invalid file type. Please drop an Excel or CSV file.");
    }
  };

  // Process selected file
  const handleFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        
        if (json.length === 0) {
          alert("The uploaded file is empty.");
          return;
        }
        
        const headers = Object.keys(json[0]);
        setExcelHeaders(headers);
        setParsedData(json);
        
        // Auto-map based on common variations
        const mapping = { name: "", phone: "", village: "", crop: "", language: "" };
        headers.forEach(h => {
          const lower = h.toLowerCase().trim();
          if (lower.includes("phone") || lower.includes("mobile") || lower.includes("contact") || lower.includes("number")) {
            mapping.phone = h;
          } else if (lower.includes("name") || lower.includes("full name") || lower.includes("farmer")) {
            mapping.name = h;
          } else if (lower.includes("village") || lower.includes("address") || lower.includes("location") || lower.includes("area")) {
            mapping.village = h;
          } else if (lower.includes("crop")) {
            mapping.crop = h;
          } else if (lower.includes("language") || lower.includes("lang")) {
            mapping.language = h;
          }
        });
        setColumnMapping(mapping);
        setExcelStep("mapping");
      } catch (err: any) {
        alert("Failed to read Excel file: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const validateIndianPhone = (rawPhone: string): { isValid: boolean; formatted: string; error?: string } => {
    const cleaned = rawPhone.toString().replace(/\D/g, "");
    
    if (!cleaned) {
      return { isValid: false, formatted: "", error: "Phone number is empty" };
    }
    
    let formatted = cleaned;
    if (cleaned.length === 12 && cleaned.startsWith("91")) {
      formatted = cleaned.substring(2);
    } else if (cleaned.length === 11 && cleaned.startsWith("0")) {
      formatted = cleaned.substring(1);
    }
    
    if (formatted.length !== 10) {
      return { isValid: false, formatted: formatted, error: "Must be exactly 10 digits" };
    }
    
    if (!/^[6-9]\d{9}$/.test(formatted)) {
      return { isValid: false, formatted: formatted, error: "Invalid Indian mobile number format" };
    }
    
    return { isValid: true, formatted: `+91${formatted}` };
  };

  const handleApplyMapping = () => {
    if (!columnMapping.name || !columnMapping.phone || !columnMapping.village) {
      alert("Please map Name, Phone, and Village columns.");
      return;
    }
    
    const existingPhones = new Set(farmers.map(f => f.phone.replace(/\D/g, "")));
    const seenExcelPhones = new Set<string>();
    
    const validated: any[] = parsedData.map((row, idx) => {
      const nameVal = String(row[columnMapping.name] || "").trim();
      const phoneVal = String(row[columnMapping.phone] || "").trim();
      const villageVal = String(row[columnMapping.village] || "").trim();
      const cropVal = columnMapping.crop ? String(row[columnMapping.crop] || "").trim() : "Unknown";
      const langVal = columnMapping.language ? String(row[columnMapping.language] || "").trim() : "English";
      
      const errors: string[] = [];
      if (!nameVal) errors.push("Name is required");
      if (!villageVal) errors.push("Village is required");
      
      const phoneCheck = validateIndianPhone(phoneVal);
      let formattedPhone = phoneCheck.formatted;
      if (!phoneCheck.isValid) {
        errors.push(phoneCheck.error || "Invalid phone number");
      }
      
      let isDup = false;
      if (phoneCheck.isValid) {
        const phoneDigits = formattedPhone.replace(/\D/g, "");
        if (existingPhones.has(phoneDigits)) {
          isDup = true;
        }
        if (seenExcelPhones.has(phoneDigits)) {
          isDup = true;
        } else {
          seenExcelPhones.add(phoneDigits);
        }
      }
      
      return {
        rowNumber: idx + 2, // header is row 1
        name: nameVal,
        phone: formattedPhone || phoneVal,
        village: villageVal,
        crop: cropVal || "Unknown",
        language: langVal || "English",
        isValid: errors.length === 0,
        errors,
        isDuplicate: isDup
      };
    });
    
    setValidatedRecords(validated);
    setExcelStep("preview");
  };

  const generateStandardizedCSV = (records: any[]): string => {
    const headers = ["name", "phone", "village", "crop", "language"];
    const rows = records.map(r => [
      r.name.replace(/"/g, '""'),
      r.phone,
      r.village.replace(/"/g, '""'),
      r.crop.replace(/"/g, '""'),
      r.language.replace(/"/g, '""')
    ]);
    
    return [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${val}"`).join(","))
    ].join("\n");
  };

  const handleDownloadErrorReport = () => {
    const invalidRecords = validatedRecords.filter(r => !r.isValid || r.isDuplicate);
    if (invalidRecords.length === 0) return;
    
    const headers = ["Row Number", "Name", "Phone", "Village", "Crop", "Language", "Reason"];
    const rows = invalidRecords.map(r => {
      let reason = "";
      if (r.isDuplicate) {
        reason = "Duplicate mobile number";
      } else {
        reason = r.errors.join("; ");
      }
      return [
        r.rowNumber,
        r.name.replace(/"/g, '""'),
        r.phone,
        r.village.replace(/"/g, '""'),
        r.crop.replace(/"/g, '""'),
        r.language.replace(/"/g, '""'),
        reason.replace(/"/g, '""')
      ];
    });
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${val}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "farmers_import_errors.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportFarmers = async () => {
    const validAndNonDup = validatedRecords.filter(r => r.isValid && !r.isDuplicate);
    if (validAndNonDup.length === 0) return;
    
    try {
      setImporting(true);
      const csvContent = generateStandardizedCSV(validAndNonDup);
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const file = new File([blob], "standardized_farmers.csv", { type: "text/csv" });
      
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await api.post("/farmers/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      // Fetch updated database list of farmers
      const updatedFarmers = await fetchFarmersSelection();
      
      // Auto-select imported farmers
      const newlyImportedPhones = new Set(validAndNonDup.map(r => r.phone));
      const newlyAddedIds = (updatedFarmers || [])
        .filter((f: any) => newlyImportedPhones.has(f.phone))
        .map((f: any) => f.id);
        
      setSelectedFarmerIds(prev => {
        const merged = new Set([...prev, ...newlyAddedIds]);
        return Array.from(merged);
      });
      
      setImportSummary({
        added: res.data.added || validAndNonDup.length,
        skipped: res.data.skipped || 0,
        failed: validatedRecords.filter(r => !r.isValid).length
      });
      
      setExcelStep("success");
    } catch (err: any) {
      alert("Failed to import farmers: " + (err.response?.data?.detail || err.message));
    } finally {
      setImporting(false);
    }
  };

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const res = await api.get("/campaigns");
      setCampaigns(res.data);
    } catch (error) {
      console.error("Failed to fetch campaigns", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFarmersSelection = async () => {
    try {
      const params = new URLSearchParams();
      if (filterName) params.append("name", filterName);
      if (filterPhone) params.append("phone", filterPhone);
      if (filterVillage) params.append("village", filterVillage);
      if (filterCrop) params.append("crop", filterCrop);

      const res = await api.get(`/campaigns/farmers-selection?${params.toString()}`);
      setFarmers(res.data);
      return res.data;
    } catch (error) {
      console.error("Failed to fetch farmers selection", error);
      return [];
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      fetchFarmersSelection();
    }
  }, [isModalOpen, filterName, filterPhone, filterVillage, filterCrop]);

  useEffect(() => {
    if (!isModalOpen) {
      setExcelStep("idle");
      setParsedData([]);
      setExcelHeaders([]);
      setValidatedRecords([]);
      setColumnMapping({
        name: "",
        phone: "",
        village: "",
        crop: "",
        language: "",
      });
    }
  }, [isModalOpen]);

  const handleFarmerToggle = (farmerId: number) => {
    setSelectedFarmerIds((prev) =>
      prev.includes(farmerId) ? prev.filter((id) => id !== farmerId) : [...prev, farmerId]
    );
  };

  const handleSelectAllToggle = () => {
    if (selectedFarmerIds.length === farmers.length) {
      setSelectedFarmerIds([]);
    } else {
      setSelectedFarmerIds(farmers.map((f) => f.id));
    }
  };

  const handleAIAssist = async () => {
    if (!description.trim()) return;
    try {
      setIsAiLoading(true);
      const res = await api.post("/campaigns/analyze-description", {
        raw_text: description
      });
      const data = res.data;
      
      if (data.polished_message) {
        setDescription(data.polished_message);
      }
      if (data.suggested_name) {
        setName(data.suggested_name);
      }
      
      if (data.suggested_date) {
        setScheduledDate(data.suggested_date);
        setStatus("Scheduled");
      }
      
      if (data.detected_crop) {
        const cropVal = data.detected_crop.trim();
        setFilterCrop(cropVal);
        
        const params = new URLSearchParams();
        if (filterName) params.append("name", filterName);
        if (filterPhone) params.append("phone", filterPhone);
        if (filterVillage) params.append("village", filterVillage);
        params.append("crop", cropVal);

        const resFarmers = await api.get(`/campaigns/farmers-selection?${params.toString()}`);
        if (resFarmers.data && resFarmers.data.length > 0) {
          const newSelectedIds = resFarmers.data.map((f: any) => f.id);
          setSelectedFarmerIds(newSelectedIds);
        }
      }
    } catch (err: any) {
      console.error("AI Assist failed:", err);
      const errMsg = err.response?.data?.detail || err.message || "Failed to process description with AI.";
      alert(errMsg);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleConfirmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      alert("Campaign Name is required");
      return;
    }
    if (selectedFarmerIds.length === 0) {
      alert("Please select at least one farmer for the campaign");
      return;
    }
    setIsConfirmOpen(true);
  };

  const handleCreateCampaign = async () => {
    let scheduled_at = null;
    if (scheduledDate && scheduledTime) {
      scheduled_at = `${scheduledDate}T${scheduledTime}:00`;
    }

    try {
      await api.post("/campaigns/", {
        campaign_name: name,
        description,
        campaign_type: type,
        scheduled_at,
        status,
        farmer_ids: selectedFarmerIds,
      });

      setIsConfirmOpen(false);
      setIsModalOpen(false);
      setName("");
      setDescription("");
      setType("Voice Campaign");
      setScheduledDate("");
      setScheduledTime("");
      setStatus("Scheduled");
      setSelectedFarmerIds([]);

      fetchCampaigns();
    } catch (error) {
      alert("Failed to create campaign.");
      console.error(error);
    }
  };

  const handleStartCampaign = async (campaignId: number) => {
    try {
      await api.post(`/campaigns/${campaignId}/start`);
      alert("Campaign started in background.");
      fetchCampaigns();
    } catch (error) {
      alert("Failed to start campaign.");
      console.error(error);
    }
  };

  const handleDeleteCampaign = async (campaignId: number) => {
    if (window.confirm("Are you sure you want to delete this campaign? This will remove all associated call logs.")) {
      try {
        await api.delete(`/campaigns/${campaignId}`);
        fetchCampaigns();
      } catch (error) {
        alert("Failed to delete campaign.");
        console.error(error);
      }
    }
  };

  const selectClasses = "h-10 w-full rounded-xl border border-black/[0.08] bg-black/[0.02] px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#22C55E]/50 focus:border-[#22C55E]/50 transition-all duration-200";

  const filteredCampaigns = campaigns.filter((c: any) => 
    c.campaign_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Dynamic campaign stats calculation
  const totalCampaigns = campaigns.length;
  const completedCampaigns = campaigns.filter(c => c.status === "Completed").length;
  const runningCampaigns = campaigns.filter(c => c.status === "Running").length;
  const failedCampaigns = campaigns.filter(c => c.status === "Failed").length;

  const completedPct = totalCampaigns > 0 ? ((completedCampaigns / totalCampaigns) * 100).toFixed(1) : "0.0";
  const failedPct = totalCampaigns > 0 ? ((failedCampaigns / totalCampaigns) * 100).toFixed(1) : "0.0";

  const statsCards = [
    { 
      title: "Total Campaigns", 
      value: totalCampaigns, 
      desc: "All time campaigns", 
      color: "#22C55E", 
      icon: Megaphone,
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-600",
      chartData: [8, 10, 9, 11, 10, 12] 
    },
    { 
      title: "Completed Campaigns", 
      value: completedCampaigns, 
      desc: `${completedPct}% of total`, 
      color: "#22C55E", 
      icon: CheckCircle2,
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-600",
      chartData: [5, 6, 6, 7, 7, 8]
    },
    { 
      title: "Running Campaigns", 
      value: runningCampaigns, 
      desc: "In progress", 
      color: "#EAB308", 
      icon: Clock,
      iconBg: "bg-yellow-500/10",
      iconColor: "text-yellow-600",
      chartData: [1, 2, 1, 2, 2, 2]
    },
    { 
      title: "Failed Campaigns", 
      value: failedCampaigns, 
      desc: `${failedPct}% of total`, 
      color: "#EF4444", 
      icon: XCircle,
      iconBg: "bg-red-500/10",
      iconColor: "text-red-600",
      chartData: [2, 2, 3, 2, 2, 2]
    }
  ];

  return (
    <div className="space-y-8 animate-sprout">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-[24px] border border-black/[0.05] bg-gradient-to-r from-white to-[#F1F5F9] shadow-sm p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        {/* Background illustration */}
        <div className="absolute right-0 top-0 bottom-0 w-[55%] hidden md:block select-none pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/70 to-transparent z-10" />
          <img src="/campaigns_banner_land.png" alt="Campaigns Banner" className="w-full h-full object-cover object-top" />
        </div>
        {/* Left section: Title & Subtitle */}
        <div className="relative z-20 max-w-xl">
          <h1 className="text-3xl font-extrabold text-[#0F172A] tracking-tight">Campaigns</h1>
          <div className="w-16 h-1 bg-[#22C55E] mt-2 mb-3 rounded-full" />
          <p className="text-sm text-[#475569]">Manage and launch voice campaigns to reach your farmers.</p>
        </div>
        {/* Right actions */}
        <div className="relative z-20 flex items-center gap-3 w-full md:w-auto font-medium">
          <Button
            onClick={fetchCampaigns}
            variant="outline"
            className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-xl px-4 py-2 flex items-center gap-2 font-medium shadow-sm transition-all"
          >
            <RefreshCw className="h-4 w-4 text-slate-500" />
            Refresh
          </Button>
          <Button
            onClick={() => setIsModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-4 py-2 flex items-center gap-2 font-medium border-0 shadow-sm transition-all"
          >
            <Plus className="h-4.5 w-4.5" />
            New Campaign
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="relative overflow-hidden rounded-[24px] border border-black/[0.05] bg-white shadow-sm p-6 transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.title}</span>
                <div className={cn("p-2.5 rounded-2xl flex items-center justify-center", stat.iconBg)}>
                  <Icon className={cn("h-5 w-5", stat.iconColor)} />
                </div>
              </div>
              <div className="flex items-end justify-between mt-4">
                <div>
                  <div className="text-3xl font-black text-[#0F172A] tracking-tight">{stat.value.toLocaleString()}</div>
                  <span className="text-[11px] font-semibold text-slate-400 mt-1 block">
                    {stat.desc}
                  </span>
                </div>
                <Sparkline data={stat.chartData} color={stat.color} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-3xl border border-black/[0.05] p-5 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 self-start sm:self-auto">Your Campaigns</h2>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-stretch sm:items-center">
          <div className="relative w-full sm:w-72 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-[#6B7280] group-focus-within:text-[#22C55E] transition-colors" />
            <Input
              placeholder="Search campaigns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-black/[0.01] border-slate-200 focus-visible:ring-[#22C55E]/20 text-[#0F172A] rounded-xl h-10"
            />
          </div>
          <Button variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-xl h-10 px-4 flex items-center justify-center gap-2">
            <Filter className="h-4.5 w-4.5 text-slate-500" />
            Filters
          </Button>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl bg-white border-black/[0.08] text-[#0F172A] rounded-3xl shadow-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Create New Campaign</DialogTitle>
            <DialogDescription className="text-[#475569]">
              Set up a new broadcast campaign to reach your farmers.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            {/* Left Column: Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#0F172A] border-b border-black/[0.05] pb-2 uppercase tracking-wider">Campaign Details</h3>
              
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-[#475569] text-xs font-medium">Campaign Name (Required)</Label>
                <Input
                  id="name"
                  placeholder="e.g. Monsoon Pest Alert"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-black/[0.02] border-black/[0.08] text-[#0F172A] focus:border-[#22C55E]/50"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="description" className="text-[#475569] text-xs font-medium">Description</Label>
                  {type === "WhatsApp Campaign" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleAIAssist}
                      disabled={isAiLoading || !description.trim()}
                      className="h-6 text-[11px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50/50 flex items-center gap-1.5 px-2 rounded-lg border border-emerald-100/50 shadow-sm transition-all"
                    >
                      {isAiLoading ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin text-emerald-600" />
                          <span>Autofilling...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3 text-emerald-500 fill-emerald-50" />
                          <span>Autofill with AI</span>
                        </>
                      )}
                    </Button>
                  )}
                </div>
                <Textarea
                  id="description"
                  placeholder={type === "WhatsApp Campaign" ? "Type a prompt (e.g. alert cotton farmers about rain on next Monday) then click Autofill with AI..." : "Details of the broadcast message..."}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-black/[0.02] border-black/[0.08] text-[#0F172A] h-20 focus:border-[#22C55E]/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="type" className="text-[#475569] text-xs font-medium">Campaign Type</Label>
                  <select id="type" value={type} onChange={(e) => setType(e.target.value)} className={selectClasses}>
                    <option value="Voice Campaign">Voice Campaign</option>
                    <option value="WhatsApp Campaign">WhatsApp Campaign</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="status" className="text-[#475569] text-xs font-medium">Status</Label>
                  <select id="status" value={status} onChange={(e) => setStatus(e.target.value)} className={selectClasses}>
                    <option value="Draft">Draft</option>
                    <option value="Scheduled">Scheduled</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="date" className="text-[#475569] text-xs font-medium">Scheduled Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="bg-black/[0.02] border-black/[0.08] text-[#0F172A] focus:border-[#22C55E]/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="time" className="text-[#475569] text-xs font-medium">Scheduled Time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="bg-black/[0.02] border-black/[0.08] text-[#0F172A] focus:border-[#22C55E]/50"
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Farmer Selection & Excel Wizard */}
            <div 
              className="space-y-4 flex flex-col h-[400px] md:h-[450px] relative"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {isDragging && (
                <div className="absolute inset-0 bg-white/95 backdrop-blur-sm border-2 border-dashed border-[#22C55E] rounded-2xl z-50 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                  <div className="p-4 bg-[#22C55E]/10 rounded-full text-[#22C55E] mb-3 animate-bounce">
                    <Upload className="h-8 w-8" />
                  </div>
                  <p className="text-sm font-semibold text-[#0F172A]">Drop your Excel or CSV file here</p>
                  <p className="text-xs text-[#475569] mt-1">Accepts .xlsx, .xls, and .csv formats</p>
                </div>
              )}

              {excelStep === "idle" && (
                <>
                  <div className="flex justify-between items-center border-b border-black/[0.05] pb-2">
                    <h3 className="text-sm font-semibold text-[#0F172A] uppercase tracking-wider">Farmer Selection</h3>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-7 text-xs text-[#22C55E] hover:text-[#16A34A] hover:bg-[#22C55E]/[0.06] flex items-center gap-1.5 px-2.5 rounded-lg border border-[#22C55E]/20"
                    >
                      <Upload className="h-3 w-3" />
                      Import Excel/CSV
                    </Button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                    />
                  </div>
                  
                  <div className="space-y-2 bg-black/[0.01] p-3 rounded-xl border border-black/[0.05]">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#6B7280]" />
                        <input type="text" placeholder="Search Name..." value={filterName} onChange={(e) => setFilterName(e.target.value)}
                          className="w-full bg-black/[0.02] border border-black/[0.06] rounded-lg py-1.5 pl-7 pr-2 text-xs text-[#0F172A] placeholder:text-[#6B7280] focus:outline-none focus:border-[#22C55E]/50 transition-all" />
                      </div>
                      <input type="text" placeholder="Search Phone..." value={filterPhone} onChange={(e) => setFilterPhone(e.target.value)}
                        className="w-full bg-black/[0.02] border border-black/[0.06] rounded-lg py-1.5 px-2 text-xs text-[#0F172A] placeholder:text-[#6B7280] focus:outline-none focus:border-[#22C55E]/50 transition-all" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" placeholder="Village" value={filterVillage} onChange={(e) => setFilterVillage(e.target.value)}
                        className="w-full bg-black/[0.02] border border-black/[0.06] rounded-lg py-1.5 px-2 text-xs text-[#0F172A] placeholder:text-[#6B7280] focus:outline-none focus:border-[#22C55E]/50 transition-all" />
                      <input type="text" placeholder="Crop" value={filterCrop} onChange={(e) => setFilterCrop(e.target.value)}
                        className="w-full bg-black/[0.02] border border-black/[0.06] rounded-lg py-1.5 px-2 text-xs text-[#0F172A] placeholder:text-[#6B7280] focus:outline-none focus:border-[#22C55E]/50 transition-all" />
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto border border-black/[0.05] rounded-xl bg-black/[0.01] p-2 space-y-0.5 custom-scrollbar">
                    <div className="flex items-center justify-between p-2 border-b border-black/[0.05] text-xs font-semibold text-[#475569] bg-black/[0.01] sticky top-0 rounded-lg">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={farmers.length > 0 && selectedFarmerIds.length === farmers.length} onChange={handleSelectAllToggle}
                          className="rounded border-black/[0.1] bg-black/[0.02] text-[#22C55E] focus:ring-[#22C55E] h-4 w-4 cursor-pointer accent-[#22C55E]" />
                        <span>Select All</span>
                      </div>
                      <span>{farmers.length} Available</span>
                    </div>

                    {farmers.length === 0 ? (
                      <p className="text-[#6B7280] text-xs text-center py-6">No farmers match search criteria.</p>
                    ) : (
                      farmers.map((farmer) => (
                        <div key={farmer.id} onClick={() => handleFarmerToggle(farmer.id)}
                          className={`flex items-center justify-between p-2 rounded-lg hover:bg-black/[0.02] transition-colors cursor-pointer text-xs ${selectedFarmerIds.includes(farmer.id) ? "bg-[#22C55E]/[0.06]" : ""}`}>
                          <div className="flex items-center gap-2">
                            <input type="checkbox" checked={selectedFarmerIds.includes(farmer.id)} onChange={() => {}}
                              className="rounded border-black/[0.1] bg-black/[0.02] text-[#22C55E] focus:ring-[#22C55E] h-4 w-4 cursor-pointer accent-[#22C55E]" />
                            <span className="font-medium text-[#0F172A]">{farmer.name}</span>
                            <span className="text-[#6B7280]">({farmer.phone})</span>
                          </div>
                          <div className="text-right text-[#475569]">
                            <span>{farmer.village}</span> • <span className="text-[#14B8A6]">{farmer.crop}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-3 bg-black/[0.01] rounded-xl border border-black/[0.05] flex justify-between items-center text-xs">
                    <div>
                      <span className="text-[#6B7280]">Selected: </span>
                      <span className="font-semibold text-[#0F172A]">{selectedFarmerIds.length}</span>
                    </div>
                    <div>
                      <span className="text-[#6B7280]">Est. Calls: </span>
                      <span className="font-semibold text-[#14B8A6]">{selectedFarmerIds.length}</span>
                    </div>
                  </div>
                </>
              )}

              {excelStep === "mapping" && (
                <div className="space-y-4 flex flex-col h-full justify-between">
                  <div className="space-y-4 flex flex-col flex-1 min-h-0">
                    <div className="flex justify-between items-center border-b border-black/[0.05] pb-2">
                      <h3 className="text-sm font-semibold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                        <Upload className="h-4 w-4 text-[#22C55E]" />
                        Map Columns
                      </h3>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setExcelStep("idle")}
                        className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/[0.06] rounded-lg px-2"
                      >
                        Cancel
                      </Button>
                    </div>

                    <p className="text-xs text-[#475569]">
                      We detected these headers in your file. Please map them to the corresponding farmer fields.
                    </p>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-[#475569]">
                          Farmer Name <span className="text-red-500">*</span>
                        </Label>
                        <select
                          value={columnMapping.name}
                          onChange={(e) => setColumnMapping(prev => ({ ...prev, name: e.target.value }))}
                          className={selectClasses}
                        >
                          <option value="">-- Select Column --</option>
                          {excelHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-[#475569]">
                          Mobile Number <span className="text-red-500">*</span>
                        </Label>
                        <select
                          value={columnMapping.phone}
                          onChange={(e) => setColumnMapping(prev => ({ ...prev, phone: e.target.value }))}
                          className={selectClasses}
                        >
                          <option value="">-- Select Column --</option>
                          {excelHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-[#475569]">
                          Village <span className="text-red-500">*</span>
                        </Label>
                        <select
                          value={columnMapping.village}
                          onChange={(e) => setColumnMapping(prev => ({ ...prev, village: e.target.value }))}
                          className={selectClasses}
                        >
                          <option value="">-- Select Column --</option>
                          {excelHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-[#475569]">
                          Crop Type <span className="text-slate-400">(Optional)</span>
                        </Label>
                        <select
                          value={columnMapping.crop}
                          onChange={(e) => setColumnMapping(prev => ({ ...prev, crop: e.target.value }))}
                          className={selectClasses}
                        >
                          <option value="">-- Don't import / Use "Unknown" --</option>
                          {excelHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-[#475569]">
                          Language <span className="text-slate-400">(Optional)</span>
                        </Label>
                        <select
                          value={columnMapping.language}
                          onChange={(e) => setColumnMapping(prev => ({ ...prev, language: e.target.value }))}
                          className={selectClasses}
                        >
                          <option value="">-- Don't import / Use "English" --</option>
                          {excelHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-black/[0.05] flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setExcelStep("idle")}
                      className="flex-1 border-black/[0.08] text-[#475569] hover:bg-black/[0.02]"
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      onClick={handleApplyMapping}
                      disabled={!columnMapping.name || !columnMapping.phone || !columnMapping.village}
                      className="flex-1 bg-gradient-to-r from-[#22C55E] to-[#14B8A6] hover:from-[#16A34A] hover:to-[#0D9488] text-white border-0"
                    >
                      Preview & Validate
                    </Button>
                  </div>
                </div>
              )}

              {excelStep === "preview" && (
                <div className="space-y-3 flex flex-col h-full justify-between">
                  <div className="space-y-3 flex flex-col flex-1 min-h-0">
                    <div className="flex justify-between items-center border-b border-black/[0.05] pb-2">
                      <h3 className="text-sm font-semibold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-[#22C55E]" />
                        Preview & Validate
                      </h3>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setExcelStep("idle")}
                        className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/[0.06] rounded-lg px-2"
                      >
                        Cancel
                      </Button>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5">
                      <div className="bg-black/[0.02] border border-black/[0.04] p-1.5 rounded-lg text-center">
                        <p className="text-[10px] text-[#6B7280] font-medium leading-none mb-1">Total</p>
                        <p className="text-sm font-bold text-[#0F172A]">{validatedRecords.length}</p>
                      </div>
                      <div className="bg-[#22C55E]/10 border border-[#22C55E]/20 p-1.5 rounded-lg text-center">
                        <p className="text-[10px] text-[#22C55E] font-medium leading-none mb-1">Valid</p>
                        <p className="text-sm font-bold text-[#22C55E]">{validatedRecords.filter(r => r.isValid && !r.isDuplicate).length}</p>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/20 p-1.5 rounded-lg text-center">
                        <p className="text-[10px] text-amber-600 font-medium leading-none mb-1">Dups</p>
                        <p className="text-sm font-bold text-amber-600">{validatedRecords.filter(r => r.isDuplicate).length}</p>
                      </div>
                      <div className="bg-red-500/10 border border-red-500/20 p-1.5 rounded-lg text-center">
                        <p className="text-[10px] text-red-500 font-medium leading-none mb-1">Invalid</p>
                        <p className="text-sm font-bold text-red-500">{validatedRecords.filter(r => !r.isValid).length}</p>
                      </div>
                    </div>

                    <div className="flex-1 min-h-0 overflow-auto border border-black/[0.05] rounded-xl bg-black/[0.01] p-1.5 custom-scrollbar text-[11px]">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-black/[0.05] text-[#475569] font-semibold sticky top-0 bg-white z-10">
                            <th className="p-1 pb-2">Row</th>
                            <th className="p-1 pb-2">Name</th>
                            <th className="p-1 pb-2">Phone</th>
                            <th className="p-1 pb-2">Village</th>
                            <th className="p-1 pb-2">Crop</th>
                            <th className="p-1 pb-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {validatedRecords.map((r, idx) => {
                            let rowClass = "border-b border-black/[0.02] hover:bg-black/[0.01]";
                            let statusBadge = <span className="text-[#22C55E] font-medium">Valid</span>;
                            
                            if (r.isDuplicate) {
                              rowClass = "border-b border-black/[0.02] bg-amber-500/[0.03] border-l-2 border-l-amber-500 hover:bg-amber-500/[0.05]";
                              statusBadge = (
                                <span className="text-amber-600 font-medium flex items-center gap-0.5" title="Duplicate mobile number">
                                  <AlertCircle className="h-3 w-3" /> Dup
                                </span>
                              );
                            } else if (!r.isValid) {
                              rowClass = "border-b border-black/[0.02] bg-red-500/[0.03] border-l-2 border-l-red-500 hover:bg-red-500/[0.05]";
                              const errText = r.errors.join(", ");
                              statusBadge = (
                                <span className="text-red-500 font-medium flex items-center gap-0.5" title={errText}>
                                  <AlertCircle className="h-3 w-3" /> Error
                                </span>
                              );
                            }

                            return (
                              <tr key={idx} className={rowClass}>
                                <td className="p-1 text-[#6B7280]">{r.rowNumber}</td>
                                <td className="p-1 font-medium text-[#0F172A] truncate max-w-[80px]" title={r.name}>{r.name || <em className="text-slate-400">Empty</em>}</td>
                                <td className="p-1 text-[#475569]">{r.phone || <em className="text-slate-400">Empty</em>}</td>
                                <td className="p-1 text-[#475569] truncate max-w-[60px]" title={r.village}>{r.village || <em className="text-slate-400">Empty</em>}</td>
                                <td className="p-1 text-[#14B8A6]">{r.crop}</td>
                                <td className="p-1">{statusBadge}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-black/[0.05] space-y-2">
                    {(validatedRecords.filter(r => r.isDuplicate).length > 0 || validatedRecords.filter(r => !r.isValid).length > 0) && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleDownloadErrorReport}
                        className="w-full text-xs text-red-500 border-red-500/20 bg-red-500/[0.02] hover:bg-red-500/[0.06] hover:text-red-600 flex items-center justify-center gap-1.5 h-8 rounded-lg"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download Error Report ({validatedRecords.filter(r => !r.isValid || r.isDuplicate).length} rows)
                      </Button>
                    )}

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setExcelStep("mapping")}
                        className="flex-1 border-black/[0.08] text-[#475569] hover:bg-black/[0.02] h-9 rounded-lg"
                      >
                        Back
                      </Button>
                      <Button
                        type="button"
                        onClick={handleImportFarmers}
                        disabled={validatedRecords.filter(r => r.isValid && !r.isDuplicate).length === 0 || importing}
                        className="flex-1 bg-gradient-to-r from-[#22C55E] to-[#14B8A6] hover:from-[#16A34A] hover:to-[#0D9488] text-white border-0 h-9 rounded-lg flex items-center justify-center gap-1.5"
                      >
                        {importing ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Import {validatedRecords.filter(r => r.isValid && !r.isDuplicate).length} Farmers
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {excelStep === "success" && (
                <div className="space-y-4 flex flex-col items-center justify-center text-center h-full p-6">
                  <div className="w-16 h-16 bg-[#22C55E]/10 rounded-full flex items-center justify-center text-[#22C55E] mb-2">
                    <CheckCircle2 className="h-10 w-10 animate-bounce" />
                  </div>
                  <h3 className="text-base font-bold text-[#0F172A]">Import Completed!</h3>
                  
                  <div className="bg-black/[0.01] border border-black/[0.05] rounded-xl p-4 w-full space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-[#6B7280]">Successfully Added</span>
                      <span className="font-bold text-[#22C55E]">{importSummary.added} farmers</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#6B7280]">Skipped (Duplicates)</span>
                      <span className="font-semibold text-[#475569]">{importSummary.skipped}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#6B7280]">Failed (Invalid)</span>
                      <span className="font-semibold text-red-500">{importSummary.failed}</span>
                    </div>
                  </div>

                  <p className="text-xs text-[#475569] italic">
                    Imported farmers have been automatically selected for this campaign.
                  </p>

                  <Button
                    type="button"
                    onClick={() => setExcelStep("idle")}
                    className="w-full bg-[#0F172A] hover:bg-[#1E293B] text-white h-9 rounded-lg mt-2"
                  >
                    Back to Farmer Selection
                  </Button>
                </div>
              )}
            </div>

            <DialogFooter className="col-span-1 md:col-span-2 border-t border-black/[0.05] pt-4">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}
                className="border-black/[0.08] text-[#475569] hover:bg-black/[0.02] hover:text-[#0F172A]">Cancel</Button>
              <Button type="submit" className="bg-gradient-to-r from-[#22C55E] to-[#14B8A6] hover:from-[#16A34A] hover:to-[#0D9488] text-white border-0">
                Create Campaign
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Campaign Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading ? (
          <p className="text-[#6B7280] col-span-full text-center py-12">Loading campaigns...</p>
        ) : campaigns.length === 0 ? (
          /* Empty State */
          <div className="col-span-full flex flex-col items-center justify-center py-16">
            <div className="w-32 h-32 flex items-center justify-center mb-5 opacity-80">
              <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Central digital node broadcasting */}
                <circle cx="60" cy="60" r="16" fill="url(#nodeGrad)" className="animate-pulse" />
                <path d="M 60 35 L 60 10 M 60 85 L 60 110 M 35 60 L 10 60 M 85 60 L 110 60" stroke="#14B8A6" strokeWidth="1.5" strokeDasharray="3 3" />
                
                {/* Outgoing wireless waves */}
                <circle cx="60" cy="60" r="30" stroke="#22C55E" strokeWidth="1.5" strokeDasharray="5 5" opacity="0.6" />
                <circle cx="60" cy="60" r="45" stroke="#84CC16" strokeWidth="1" strokeDasharray="6 8" opacity="0.3" />

                {/* Farming nodes on the ends */}
                {/* Node 1: Left (sprout) */}
                <circle cx="10" cy="60" r="8" fill="#0F172A" stroke="#22C55E" strokeWidth="1.5" />
                <path d="M 8 62 Q 10 58 12 62" stroke="#22C55E" strokeWidth="1.5" fill="none" />
                
                {/* Node 2: Top (phone) */}
                <circle cx="60" cy="10" r="8" fill="#0F172A" stroke="#14B8A6" strokeWidth="1.5" />
                <rect x="58" y="7" width="4" height="6" rx="0.5" fill="#14B8A6" />
                
                {/* Node 3: Right (leaf) */}
                <circle cx="110" cy="60" r="8" fill="#0F172A" stroke="#84CC16" strokeWidth="1.5" />
                <path d="M 108 58 C 108 58 112 56 112 60 C 112 60 110 62 108 60 Z" fill="#84CC16" />

                <defs>
                  <linearGradient id="nodeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#14B8A6" />
                    <stop offset="100%" stopColor="#22C55E" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[#D1D5DB] mb-2">No campaigns yet</h3>
            <p className="text-sm text-[#6B7280] mb-6 text-center max-w-sm">Create your first campaign to start reaching farmers with voice broadcasts.</p>
            <Button onClick={() => setIsModalOpen(true)}
              className="bg-gradient-to-r from-[#0F766E] to-[#0D9488] hover:from-[#0D9488] hover:to-[#14B8A6] text-white">
              <Plus className="mr-2 h-4 w-4" /> Create Campaign
            </Button>
          </div>
        ) : (
          filteredCampaigns.map((campaign) => (
            <Card key={campaign.id} className="relative overflow-hidden rounded-[24px] border border-black/[0.05] bg-white shadow-sm p-6 flex flex-col justify-between group hover:border-[#22C55E]/40 transition-all duration-300">
              <div>
                {/* Header: Status badge & Dynamic illustration */}
                <div className="flex justify-between items-start mb-4">
                  <span className={cn(
                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border",
                    campaign.status === "Completed" ? "bg-emerald-50 text-emerald-700 border-emerald-100/55" :
                    campaign.status === "Running" ? "bg-yellow-50 text-yellow-700 border-yellow-100/55 animate-pulse" :
                    campaign.status === "Failed" ? "bg-red-50 text-red-700 border-red-100/55" :
                    campaign.status === "Scheduled" ? "bg-blue-50 text-blue-700 border-blue-100/55" :
                    "bg-slate-50 text-slate-700 border-slate-100"
                  )}>
                    {campaign.status}
                  </span>
                  {getCampaignIllustration(campaign.campaign_name, campaign.description)}
                </div>

                {/* Title and Description */}
                <h3 className="text-base font-extrabold text-[#0F172A] mb-1 line-clamp-1" title={campaign.campaign_name}>
                  {campaign.campaign_name}
                </h3>
                <p className="text-xs text-[#475569] leading-relaxed line-clamp-2 min-h-[32px] mb-4" title={campaign.description}>
                  {campaign.description || "No description provided."}
                </p>

                {/* Details list */}
                <div className="space-y-2.5 text-xs text-[#475569] mb-4">
                  <div className="flex items-center text-slate-500 font-medium">
                    <Calendar className="mr-2.5 h-4 w-4 text-slate-400" />
                    <span>{formatCampaignDate(campaign.scheduled_at)}</span>
                  </div>
                  <div className="flex items-center text-slate-500 font-medium">
                    <Users className="mr-2.5 h-4 w-4 text-slate-400" />
                    <span>{campaign.farmers_count.toLocaleString()} Farmers</span>
                  </div>
                  <div className="flex items-center text-slate-500 font-medium">
                    <Phone className="mr-2.5 h-4 w-4 text-slate-400" />
                    <span>{campaign.campaign_type || "Voice Call"}</span>
                  </div>
                </div>

                {/* Completed / Failed Alerts */}
                {campaign.status === "Completed" && (
                  <div className="bg-[#ECFDF5] border border-[#DCFCE7] text-[#166534] text-xs font-semibold py-2 px-3 rounded-xl flex items-center gap-1.5 mb-4 animate-fade-in select-none">
                    <Check className="h-4 w-4 text-[#15803D]" />
                    Campaign completed successfully
                  </div>
                )}
                {campaign.status === "Failed" && (
                  <div className="bg-red-50 border border-red-100 text-red-700 text-xs font-semibold py-2 px-3 rounded-xl flex items-center gap-1.5 mb-4 animate-fade-in select-none">
                    <XCircle className="h-4 w-4 text-red-600" />
                    Campaign execution failed
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="flex items-center gap-2 mt-2 w-full">
                {campaign.status === "Scheduled" ? (
                  <Button 
                    onClick={() => handleStartCampaign(campaign.id)} 
                    size="sm"
                    className="flex-1 bg-gradient-to-r from-[#22C55E] to-[#14B8A6] hover:from-[#16A34A] hover:to-[#0D9488] text-white text-xs font-bold rounded-xl h-10 border-0 shadow-sm transition-all"
                  >
                    <Play className="mr-1.5 h-4 w-4" /> Start Now
                  </Button>
                ) : campaign.status === "Running" ? (
                  <div className="flex-1 justify-center bg-yellow-50 text-yellow-700 border border-yellow-100/50 py-2.5 rounded-xl text-xs font-bold animate-pulse text-center select-none flex items-center gap-1.5 h-10">
                    <Rocket className="h-4 w-4" /> Running...
                  </div>
                ) : (
                  <Button 
                    onClick={() => { window.location.href = `/reports`; }} 
                    size="sm" 
                    variant="outline"
                    className="flex-1 bg-[#F8FAFC] border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl px-4 py-2 text-xs font-bold shadow-sm h-10 flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Activity className="h-4 w-4 text-slate-500" /> View Report
                  </Button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl h-10 w-10 p-0 flex items-center justify-center flex-shrink-0 transition-all animate-fade-in"
                    >
                      <MoreHorizontal className="h-4.5 w-4.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-white border-black/[0.08] text-[#0F172A] rounded-xl shadow-lg">
                    <DropdownMenuLabel className="text-[#475569]">Actions</DropdownMenuLabel>
                    {campaign.status === "Scheduled" && (
                      <DropdownMenuItem className="cursor-pointer hover:bg-black/[0.04] rounded-lg" onClick={() => handleStartCampaign(campaign.id)}>
                        <Play className="mr-2 h-4 w-4" /> Start Campaign
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem 
                      className="cursor-pointer text-red-500 hover:bg-red-500/10 rounded-lg" 
                      onClick={() => handleDeleteCampaign(campaign.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete Campaign
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="max-w-md bg-white border-black/[0.08] text-[#0F172A] rounded-3xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-[#22C55E]">
              Confirm Campaign Launch
            </DialogTitle>
            <DialogDescription className="text-[#475569]">
              Please review the campaign summary before launching.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="p-4 bg-black/[0.01] border border-black/[0.05] rounded-2xl space-y-3.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#6B7280]">Campaign Name</span>
                <span className="font-semibold text-[#0F172A]">{name}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#6B7280]">Campaign Type</span>
                <Badge variant="outline" className="border-[#22C55E]/20 text-[#22C55E] bg-[#22C55E]/10 text-xs">
                  {type}
                </Badge>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#6B7280]">Selected Farmers</span>
                <span className="font-semibold text-[#22C55E]">{selectedFarmerIds.length} farmers</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#6B7280]">Scheduled Time</span>
                <span className="font-semibold text-[#0F172A]">
                  {scheduledDate && scheduledTime ? `${scheduledDate} @ ${scheduledTime}` : "Immediate Start"}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#6B7280]">Status</span>
                <Badge variant="outline" className="border-black/[0.06] text-[#475569] bg-black/[0.02] text-xs">
                  {status}
                </Badge>
              </div>
            </div>
            
            <p className="text-[11px] text-[#475569] leading-relaxed text-center italic">
              {type === "WhatsApp Campaign" 
                ? "This will send WhatsApp messages directly to the selected recipients." 
                : "This will place voice calls and connect recipients to the ElevenLabs voice agent."}
            </p>
          </div>

          <DialogFooter className="border-t border-black/[0.05] pt-4">
            <Button type="button" variant="outline" onClick={() => setIsConfirmOpen(false)}
              className="border-black/[0.08] text-[#475569] hover:bg-black/[0.02]">Cancel</Button>
            <Button type="button" onClick={handleCreateCampaign}
              className="bg-gradient-to-r from-[#22C55E] to-[#14B8A6] hover:from-[#16A34A] hover:to-[#0D9488] text-white border-0">
              Confirm & Launch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
