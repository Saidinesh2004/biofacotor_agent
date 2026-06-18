import { useState, useEffect, useRef } from "react";
import api from "@/lib/api";
import { 
  flexRender, 
  getCoreRowModel, 
  getFilteredRowModel, 
  getPaginationRowModel, 
  useReactTable 
} from "@tanstack/react-table";
import { Download, Plus, Search, Filter, MoreHorizontal, Eye, Edit, Trash, Phone, UserPlus, Inbox } from "lucide-react";
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
    { accessorKey: "name", header: "Name" },
    { accessorKey: "phone", header: "Phone" },
    { accessorKey: "village", header: "Village" },
    { accessorKey: "crop", header: "Crop" },
    { accessorKey: "language", header: "Language" },
    {
      id: "actions",
      cell: ({ row }: any) => {
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 text-[#475569] hover:text-[#0F172A] hover:bg-black/[0.04] rounded-xl">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
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

  return (
    <div className="space-y-8 animate-sprout">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A] mb-1">Farmers Management</h1>
          <p className="text-sm text-[#475569]">Database of agricultural partners and contacts.</p>
        </div>
        <div className="flex items-center gap-2">
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
            className="border-black/[0.08] text-[#475569] hover:bg-black/[0.02] hover:text-[#0F172A]"
          >
            <Download className="mr-2 h-4 w-4" />
            {uploading ? "Uploading..." : "Upload Excel"}
          </Button>
          <Button 
            onClick={() => {
              setNewFarmer({ name: "", phone: "", village: "", crop: "", language: "English" });
              setIsAdding(true);
            }}
            className="bg-gradient-to-r from-[#22C55E] to-[#14B8A6] hover:from-[#16A34A] hover:to-[#0D9488] text-white shadow-glow-green border-0"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Farmer
          </Button>
        </div>
      </div>

      <div className="glass-card rounded-2xl border border-black/[0.05] overflow-hidden">
        <div className="p-4 flex flex-col sm:flex-row justify-between gap-4 border-b border-black/[0.05] bg-black/[0.01]">
          <div className="relative w-full sm:max-w-sm group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280] group-focus-within:text-[#22C55E] transition-colors" />
            <Input
              placeholder="Search farmers..."
              value={globalFilter ?? ""}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setGlobalFilter(event.target.value)}
              className="pl-10 bg-black/[0.02] border-black/[0.06] focus-visible:ring-[#22C55E]/30 text-[#0F172A]"
            />
          </div>
          <Button variant="outline" className="border-black/[0.08] text-[#475569] hover:bg-black/[0.02] hover:text-[#0F172A]">
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
        </div>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-black/[0.01]">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-black/[0.05] hover:bg-transparent">
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id} className="text-[#475569] font-medium whitespace-nowrap text-xs uppercase tracking-wider">
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
                    className="border-black/[0.05] hover:bg-black/[0.01] transition-colors"
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
        
        <div className="flex items-center justify-between p-4 border-t border-black/[0.05] bg-black/[0.01]">
          <div className="text-xs text-[#475569]">
            {table.getFilteredRowModel().rows.length} total row(s)
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}
              className="border-black/[0.08] text-[#475569] hover:bg-black/[0.02] text-xs">
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}
              className="border-black/[0.08] text-[#475569] hover:bg-black/[0.02] text-xs">
              Next
            </Button>
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
