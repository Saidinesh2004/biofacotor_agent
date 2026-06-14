
import { 
  flexRender, 
  getCoreRowModel, 
  getPaginationRowModel, 
  useReactTable 
} from "@tanstack/react-table";
import { FileText, Phone, PhoneForwarded, PhoneMissed, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import api from "@/lib/api";
// Removed mockData import

const getStatusIcon = (status: string) => {
  switch(status) {
    case 'Completed': return <PhoneForwarded className="h-3 w-3 mr-1" />;
    case 'Failed': return <PhoneOff className="h-3 w-3 mr-1" />;
    case 'Busy': return <PhoneMissed className="h-3 w-3 mr-1" />;
    default: return <Phone className="h-3 w-3 mr-1" />;
  }
};

const columns = [
  { accessorKey: "phone", header: "Phone" },
  { 
    accessorKey: "status", 
    header: "Call Status",
    cell: ({ row }: any) => {
      const status = row.getValue("status") || "Unknown";
      let variant = "secondary";
      let className = "bg-slate-700 text-slate-300";
      
      if (status === "Completed") className = "bg-emerald-500/20 text-emerald-400";
      if (status === "Failed") className = "bg-red-500/20 text-red-400";
      if (status === "Busy") className = "bg-yellow-500/20 text-yellow-400";
      if (status === "No Answer") className = "bg-slate-500/20 text-slate-400";

      return (
        <Badge variant={variant as any} className={`${className} flex items-center w-fit`}>
          {getStatusIcon(status)}
          {status}
        </Badge>
      );
    }
  },
  { 
    accessorKey: "created_at", 
    header: "Date",
    cell: ({ row }: any) => new Date(row.getValue("created_at")).toLocaleString()
  },
  {
    id: "actions",
    header: "Action",
    cell: ({ row }: any) => {
      const status = row.getValue("status");
      return (
        <Button 
          variant="outline" 
          size="sm" 
          className="border-white/10 text-slate-300 hover:bg-white/5 hover:text-white h-8"
          disabled={status !== "Completed"}
        >
          <FileText className="mr-2 h-3.5 w-3.5" />
          Transcript
        </Button>
      )
    },
  },
];

export default function VoiceCalls() {
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchCalls = async () => {
    try {
      setLoading(true);
      const response = await api.get("/voice-calls");
      setCalls(response.data);
    } catch (err: any) {
      setError("Failed to load voice calls.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, []);

  const table = useReactTable({
    data: calls,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Voice Calls History</h1>
        <p className="text-slate-400">Track and review automated voice calls made to farmers.</p>
      </div>

      <div className="glass-card rounded-xl border border-white/5 overflow-hidden">
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
                    Loading calls...
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
                    No records found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        <div className="flex items-center justify-end space-x-2 p-4 border-t border-white/5 bg-slate-900/50">
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
  );
}
