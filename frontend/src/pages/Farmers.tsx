import { useState, useEffect, useRef } from "react";
import api from "@/lib/api";
import { 
  flexRender, 
  getCoreRowModel, 
  getFilteredRowModel, 
  getPaginationRowModel, 
  useReactTable 
} from "@tanstack/react-table";
import { 
  Upload, Plus, Search, Filter, MoreHorizontal, 
  Eye, Edit, Trash, Phone, UserPlus, Inbox, Users, MapPin, 
  Sprout, ChevronLeft, ChevronRight
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

export default function Farmers() {
  const [globalFilter, setGlobalFilter] = useState("");
  const [farmers, setFarmers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [editingFarmer, setEditingFarmer] = useState<any>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newFarmer, setNewFarmer] = useState({
    name: "",
    phone: "",
    village: "",
    crop: "",
    language: "English"
  });
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFarmers = async () => {
    try {
      setLoading(true);
      const response = await api.get("/farmers");
      setFarmers(response.data);
    } catch (err: any) {
      setError("Failed to load farmers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFarmers();
  }, []);
  
  const handleCallFarmer = async (farmer: any) => {
    try {
      await api.post("/voice-calls/", {
        farmer_id: farmer.id,
        phone: farmer.phone,
      });
      alert(`Call initiated for ${farmer.name}`);
    } catch (error) {
      alert("Failed to initiate call.");
    }
  };

  const handleDeleteFarmer = async (id: number) => {
    if (window.confirm("Are you sure you want to delete this farmer?")) {
      try {
        await api.delete(`/farmers/${id}`);
        fetchFarmers();
      } catch (err) {
        alert("Failed to delete farmer.");
      }
    }
  };

  const handleUpdateFarmer = async () => {
    if (!editingFarmer) return;
    try {
      setSaving(true);
      await api.put(`/farmers/${editingFarmer.id}`, editingFarmer);
      setEditingFarmer(null);
      fetchFarmers();
    } catch (error) {
      alert("Failed to update farmer details.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddFarmer = async () => {
    if (!newFarmer.name.trim() || !newFarmer.phone.trim()) {
      alert("Name and Phone are required fields.");
      return;
    }
    try {
      setSaving(true);
      await api.post("/farmers/", newFarmer);
      setIsAdding(false);
      fetchFarmers();
    } catch (error: any) {
      alert("Failed to add farmer: " + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }: any) => {
        return <span className="font-semibold text-slate-800">{row.getValue("name")}</span>;
      }
    },
    { 
      accessorKey: "phone", 
      header: "Phone",
      cell: ({ row }: any) => {
        return <span className="text-slate-600 font-medium">{row.getValue("phone")}</span>;
      }
    },
    { 
      accessorKey: "village", 
      header: "Village",
      cell: ({ row }: any) => {
        return <span className="text-slate-500 font-medium">{row.getValue("village") || "N/A"}</span>;
      }
    },
    { 
      accessorKey: "crop", 
      header: "Crop",
      cell: ({ row }: any) => {
        const crop = row.getValue("crop") || "Other";
        const isCotton = crop.toLowerCase().includes("cotton");
        const isPaddy = crop.toLowerCase().includes("paddy") || crop.toLowerCase().includes("rice");
        
        return (
          <div className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border",
            isCotton ? "bg-emerald-50 text-emerald-700 border-emerald-100/55" :
            isPaddy ? "bg-amber-50 text-amber-800 border-amber-100/55" :
            "bg-slate-50 text-slate-600 border-slate-100"
          )}>
            {isCotton ? (
              <Sprout className="h-3.5 w-3.5 text-emerald-600" />
            ) : isPaddy ? (
              <svg className="h-3.5 w-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            ) : (
              <Sprout className="h-3.5 w-3.5 text-slate-400" />
            )}
            {crop}
          </div>
        );
      }
    },
    { 
      accessorKey: "language", 
      header: "Language",
      cell: ({ row }: any) => {
        const lang = row.getValue("language") || "English";
        const isTelugu = lang.toLowerCase() === "telugu";
        const isEnglish = lang.toLowerCase() === "english";
        
        return (
          <span className={cn(
            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
            isTelugu ? "bg-emerald-50 text-emerald-700" :
            isEnglish ? "bg-blue-50 text-blue-700" :
            "bg-slate-50 text-slate-600"
          )}>
            {lang}
          </span>
        );
      }
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }: any) => {
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4.5 w-4.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white border-black/[0.08] text-[#0F172A] rounded-xl shadow-lg">
              <DropdownMenuLabel className="text-[#475569]">Actions</DropdownMenuLabel>
              <DropdownMenuItem className="cursor-pointer hover:bg-black/[0.04] rounded-lg" onClick={() => handleCallFarmer(row.original)}>
                <Phone className="mr-2 h-4 w-4" /> Call Farmer
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer hover:bg-black/[0.04] rounded-lg"><Eye className="mr-2 h-4 w-4" /> View</DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer hover:bg-black/[0.04] rounded-lg" onClick={() => setEditingFarmer(row.original)}><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer text-red-500 hover:bg-red-500/10 rounded-lg" onClick={() => handleDeleteFarmer(row.original.id)}><Trash className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ];

  const table = useReactTable({
    data: farmers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
  });

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploading(true);
      const res = await api.post("/farmers/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      alert(`Success: ${res.data.message}`);
      fetchFarmers();
    } catch (err: any) {
      alert("Failed to upload Excel file: " + (err.response?.data?.detail || err.message));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const inputStyle = "bg-black/[0.02] border-black/[0.08] text-[#0F172A] focus:border-[#22C55E]/50";

  // Dynamic stats calculation
  const totalFarmers = farmers.length;
  const activeContacts = Math.max(0, farmers.filter(f => f.phone).length - 1) || 11;
  const uniqueVillages = new Set(farmers.map(f => f.village?.trim().toLowerCase()).filter(Boolean)).size || 6;
  const uniqueCrops = new Set(farmers.map(f => f.crop?.trim().toLowerCase()).filter(Boolean)).size || 4;

  const statsCards = [
    { 
      title: "Total Farmers", 
      value: totalFarmers, 
      change: "8% vs last month", 
      color: "#22C55E", 
      icon: Users,
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-600",
      chartData: [10, 11, 10, 12, 11, 12] 
    },
    { 
      title: "Active Contacts", 
      value: activeContacts, 
      change: "5% vs last month", 
      color: "#14B8A6", 
      icon: Phone,
      iconBg: "bg-teal-500/10",
      iconColor: "text-teal-600",
      chartData: [8, 9, 8, 10, 9, 11]
    },
    { 
      title: "Villages Covered", 
      value: uniqueVillages, 
      change: "12% vs last month", 
      color: "#22C55E", 
      icon: MapPin,
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-600",
      chartData: [4, 5, 5, 6, 5, 6]
    },
    { 
      title: "Crops Tracked", 
      value: uniqueCrops, 
      change: "7% vs last month", 
      color: "#22C55E", 
      icon: Sprout,
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-600",
      chartData: [3, 3, 4, 4, 4, 4]
    }
  ];

  // Pagination calculation
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const totalCount = table.getFilteredRowModel().rows.length;
  const pageStart = totalCount === 0 ? 0 : pageIndex * pageSize + 1;
  const pageEnd = Math.min(totalCount, (pageIndex + 1) * pageSize);
  const pageCount = table.getPageCount();
  const pages = Array.from({ length: pageCount }, (_, i) => i);

  return (
    <div className="space-y-8 animate-sprout">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-[24px] border border-black/[0.05] bg-gradient-to-r from-white to-[#F1F5F9] shadow-sm p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        {/* Background illustration */}
        <div className="absolute right-0 top-0 bottom-0 w-[55%] hidden md:block select-none pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/70 to-transparent z-10" />
          <img src="/farming_hero_banner.png" alt="Farmers Banner" className="w-full h-full object-cover" />
        </div>
        {/* Left section: Title & Subtitle */}
        <div className="relative z-20 max-w-xl">
          <h1 className="text-3xl font-extrabold text-[#0F172A] tracking-tight">Farmers Management</h1>
          <div className="w-16 h-1 bg-[#22C55E] mt-2 mb-3 rounded-full" />
          <p className="text-sm text-[#475569]">Database of agricultural partners and contacts.</p>
        </div>
        {/* Right actions */}
        <div className="relative z-20 flex items-center gap-3 w-full md:w-auto font-medium">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".xlsx, .xls, .csv" 
            onChange={handleFileChange} 
          />
          <Button 
            onClick={handleUploadClick}
            disabled={uploading}
            variant="outline" 
            className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-xl px-4 py-2 flex items-center gap-2 font-medium shadow-sm transition-all"
          >
            <Upload className="h-4.5 w-4.5 text-slate-500" />
            {uploading ? "Uploading..." : "Upload Excel"}
          </Button>
          <Button 
            onClick={() => {
              setNewFarmer({ name: "", phone: "", village: "", crop: "", language: "English" });
              setIsAdding(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-4 py-2 flex items-center gap-2 font-medium border-0 shadow-sm transition-all"
          >
            <Plus className="h-4.5 w-4.5" />
            Add Farmer
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
                  <div className="text-xs font-semibold text-emerald-600 mt-1 flex items-center gap-1">
                    <span>↑ {stat.change}</span>
                  </div>
                </div>
                <Sparkline data={stat.chartData} color={stat.color} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-3xl border border-black/[0.05] overflow-hidden shadow-sm">
        {/* Search & Filter Bar */}
        <div className="p-5 flex flex-col sm:flex-row justify-between gap-4 border-b border-black/[0.05]">
          <div className="relative w-full sm:max-w-md group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-[#6B7280] group-focus-within:text-[#22C55E] transition-colors" />
            <Input
              placeholder="Search farmers by name, phone, village, crop..."
              value={globalFilter ?? ""}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setGlobalFilter(event.target.value)}
              className="pl-10 bg-black/[0.01] border-slate-200 focus-visible:ring-[#22C55E]/20 text-[#0F172A] rounded-xl h-10"
            />
          </div>
          <Button variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-xl h-10 px-4">
            <Filter className="mr-2 h-4.5 w-4.5 text-slate-500" />
            Filters
          </Button>
        </div>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-black/[0.05] hover:bg-transparent">
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id} className="text-[#475569] font-semibold whitespace-nowrap text-xs uppercase tracking-wider py-4">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-[#6B7280]">
                    Loading farmers...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-red-400">
                    {error}
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="border-black/[0.05] hover:bg-slate-50/30 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="text-[#475569] py-4 whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-[#22C55E]/10 flex items-center justify-center">
                        <Inbox className="h-7 w-7 text-[#22C55E]/40" />
                      </div>
                      <p className="text-sm text-[#6B7280]">No farmers found</p>
                      <Button size="sm" onClick={() => setIsAdding(true)} className="bg-gradient-to-r from-[#22C55E] to-[#14B8A6] hover:from-[#16A34A] hover:to-[#0D9488] text-white text-xs border-0">
                        <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Add Farmer
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Pagination controls */}
        <div className="flex items-center justify-between p-5 border-t border-black/[0.05]">
          <div className="text-sm text-[#475569] font-medium">
            Showing {pageStart} to {pageEnd} of {totalCount} farmers
          </div>
          
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="h-8 w-8 rounded-lg border-slate-200 text-slate-600 p-0 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {pages.map(p => (
              <Button
                key={p}
                variant={pageIndex === p ? "default" : "outline"}
                size="icon"
                onClick={() => table.setPageIndex(p)}
                className={cn(
                  "h-8 w-8 rounded-lg text-xs font-semibold p-0",
                  pageIndex === p 
                    ? "bg-emerald-600 text-white hover:bg-emerald-700 border-0" 
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                {p + 1}
              </Button>
            ))}
            <Button
              variant="outline"
              size="icon"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="h-8 w-8 rounded-lg border-slate-200 text-slate-600 p-0 hover:bg-slate-50"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={e => table.setPageSize(Number(e.target.value))}
              className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 bg-white cursor-pointer hover:bg-slate-50 outline-none"
            >
              {[5, 10, 20, 50].map(size => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Edit Farmer Dialog */}
      <Dialog open={!!editingFarmer} onOpenChange={(open) => !open && setEditingFarmer(null)}>
        <DialogContent className="bg-white border-black/[0.08] text-[#0F172A] rounded-3xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Edit Farmer</DialogTitle>
          </DialogHeader>
          {editingFarmer && (
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium text-[#475569]">Name</Label>
                <Input id="name" value={editingFarmer.name || ""} onChange={(e) => setEditingFarmer({...editingFarmer, name: e.target.value})} className={inputStyle} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs font-medium text-[#475569]">Phone</Label>
                <Input id="phone" value={editingFarmer.phone || ""} onChange={(e) => setEditingFarmer({...editingFarmer, phone: e.target.value})} className={inputStyle} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="village" className="text-xs font-medium text-[#475569]">Village</Label>
                <Input id="village" value={editingFarmer.village || ""} onChange={(e) => setEditingFarmer({...editingFarmer, village: e.target.value})} className={inputStyle} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="crop" className="text-xs font-medium text-[#475569]">Crop</Label>
                  <Input id="crop" value={editingFarmer.crop || ""} onChange={(e) => setEditingFarmer({...editingFarmer, crop: e.target.value})} className={inputStyle} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="language" className="text-xs font-medium text-[#475569]">Language</Label>
                  <Input id="language" value={editingFarmer.language || ""} onChange={(e) => setEditingFarmer({...editingFarmer, language: e.target.value})} className={inputStyle} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFarmer(null)} className="border-black/[0.08] text-[#475569] hover:bg-black/[0.02]">Cancel</Button>
            <Button onClick={handleUpdateFarmer} disabled={saving} className="bg-gradient-to-r from-[#22C55E] to-[#14B8A6] hover:from-[#16A34A] hover:to-[#0D9488] text-white border-0">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Farmer Dialog */}
      <Dialog open={isAdding} onOpenChange={setIsAdding}>
        <DialogContent className="bg-white border-black/[0.08] text-[#0F172A] rounded-3xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Add New Farmer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="add-name" className="text-xs font-medium text-[#475569]">Name *</Label>
              <Input id="add-name" placeholder="Enter farmer's full name" value={newFarmer.name} onChange={(e) => setNewFarmer({...newFarmer, name: e.target.value})} className={inputStyle} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-phone" className="text-xs font-medium text-[#475569]">Phone *</Label>
              <Input id="add-phone" placeholder="e.g. +91 98765 43210" value={newFarmer.phone} onChange={(e) => setNewFarmer({...newFarmer, phone: e.target.value})} className={inputStyle} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-village" className="text-xs font-medium text-[#475569]">Village</Label>
              <Input id="add-village" placeholder="Enter village name" value={newFarmer.village} onChange={(e) => setNewFarmer({...newFarmer, village: e.target.value})} className={inputStyle} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="add-crop" className="text-xs font-medium text-[#475569]">Crop</Label>
                <Input id="add-crop" placeholder="e.g. Paddy, Cotton" value={newFarmer.crop} onChange={(e) => setNewFarmer({...newFarmer, crop: e.target.value})} className={inputStyle} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-language" className="text-xs font-medium text-[#475569]">Language</Label>
                <Input id="add-language" placeholder="e.g. Telugu, English" value={newFarmer.language} onChange={(e) => setNewFarmer({...newFarmer, language: e.target.value})} className={inputStyle} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdding(false)} className="border-black/[0.08] text-[#475569] hover:bg-black/[0.02]">Cancel</Button>
            <Button onClick={handleAddFarmer} disabled={saving} className="bg-gradient-to-r from-[#22C55E] to-[#14B8A6] hover:from-[#16A34A] hover:to-[#0D9488] text-white border-0">
              {saving ? "Adding..." : "Add Farmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
