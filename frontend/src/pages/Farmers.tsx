import { useState, useEffect, useRef } from "react";
import api from "@/lib/api";
import { 
  flexRender, 
  getCoreRowModel, 
  getFilteredRowModel, 
  getPaginationRowModel, 
  useReactTable 
} from "@tanstack/react-table";
import { Download, Plus, Search, Filter, MoreHorizontal, Eye, Edit, Trash, Phone } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export default function Farmers() {
  const [globalFilter, setGlobalFilter] = useState("");
  const [farmers, setFarmers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
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

  const columns = [
    {
      id: "select",
      header: ({ table }: any) => (
        <input
          type="checkbox"
          className="h-4 w-4 bg-slate-900 border-white/20 rounded accent-primary"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
        />
      ),
      cell: ({ row }: any) => (
        <input
          type="checkbox"
          className="h-4 w-4 bg-slate-900 border-white/20 rounded accent-primary"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
        />
      ),
    },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "phone", header: "Phone" },
    { accessorKey: "village", header: "Village" },
    { accessorKey: "crop", header: "Crop" },
    { accessorKey: "language", header: "Language" },
    { 
      accessorKey: "status", 
      header: "Status",
      cell: ({ row }: any) => {
        const status = row.getValue("status") || "Active";
        return (
          <Badge variant={status === "Active" ? "default" : "secondary"} className={status === "Active" ? "bg-green-500/20 text-green-400 hover:bg-green-500/30" : "bg-slate-700 text-slate-300"}>
            {status}
          </Badge>
        );
      }
    },
    {
      id: "actions",
      cell: ({ row }: any) => {
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-white">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-slate-900 border-white/10 text-slate-200">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem className="cursor-pointer hover:bg-white/5" onClick={() => handleCallFarmer(row.original)}>
                <Phone className="mr-2 h-4 w-4" /> Call Farmer
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer hover:bg-white/5"><Eye className="mr-2 h-4 w-4" /> View</DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer hover:bg-white/5"><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer text-red-400 hover:bg-red-400/10"><Trash className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
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
      fetchFarmers(); // Refresh the table
    } catch (err: any) {
      alert("Failed to upload Excel file: " + (err.response?.data?.detail || err.message));
    } finally {
      setUploading(false);
      // reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Farmers Management</h1>
          <p className="text-slate-400">View and manage farmer profiles and data.</p>
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
            className="border-white/10 text-slate-300 hover:bg-white/5 hover:text-white"
          >
            <Download className="mr-2 h-4 w-4" />
            {uploading ? "Uploading..." : "Upload Excel"}
          </Button>
          <Button className="bg-primary hover:bg-primary/90 text-white shadow-[0_0_15px_rgba(22,163,74,0.4)]">
            <Plus className="mr-2 h-4 w-4" />
            Add Farmer
          </Button>
        </div>
      </div>

      <div className="glass-card rounded-xl border border-white/5 overflow-hidden">
        <div className="p-4 flex flex-col sm:flex-row justify-between gap-4 border-b border-white/5 bg-slate-900/50">
          <div className="relative w-full sm:max-w-sm group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Search farmers..."
              value={globalFilter ?? ""}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setGlobalFilter(event.target.value)}
              className="pl-9 bg-slate-950/50 border-white/10 focus-visible:ring-primary/50 text-slate-200"
            />
          </div>
          <Button variant="outline" className="border-white/10 text-slate-300 hover:bg-white/5 hover:text-white">
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
        </div>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-900/80 hover:bg-slate-900/80">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-white/5 hover:bg-transparent">
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id} className="text-slate-400 font-medium whitespace-nowrap">
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
                  <TableCell colSpan={columns.length} className="h-24 text-center text-slate-500">
                    Loading farmers...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-red-500">
                    {error}
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="border-white/5 hover:bg-white/[0.02] transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="text-slate-300 py-4 whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-slate-500">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        <div className="flex items-center justify-between p-4 border-t border-white/5 bg-slate-900/50">
          <div className="text-sm text-slate-400">
            {Object.keys(table.getState().rowSelection).length} of{" "}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="border-white/10 text-slate-300 hover:bg-white/5"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="border-white/10 text-slate-300 hover:bg-white/5"
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
