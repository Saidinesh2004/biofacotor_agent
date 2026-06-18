
import { 
  flexRender, 
  getCoreRowModel, 
  getPaginationRowModel, 
  useReactTable 
} from "@tanstack/react-table";
import { FileText, Phone, PhoneForwarded, PhoneMissed, PhoneOff, Inbox } from "lucide-react";
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
      let className = "bg-black/[0.06] text-[#475569]";
      
      if (status === "Completed") className = "bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20";
      if (status === "Failed") className = "bg-red-500/10 text-red-500 border-red-500/20";
      if (status === "Busy") className = "bg-amber-500/10 text-amber-500 border-amber-500/20";
      if (status === "No Answer") className = "bg-black/[0.06] text-[#475569] border-black/[0.08]";

      return (
        <Badge variant="outline" className={`${className} flex items-center w-fit`}>
          {getStatusIcon(status)}
          {status}
        </Badge>
      );
    }
  },
  { 
    accessorKey: "created_at", 
    header: "Date",
    cell: ({ row }: any) => (
      <span className="text-[#475569]">{new Date(row.getValue("created_at")).toLocaleString()}</span>
    )
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
          className="border-black/[0.08] text-[#475569] hover:bg-black/[0.02] hover:text-[#0F172A] h-8 text-xs"
          disabled={status !== "Completed"}
        >
          <FileText className="mr-1.5 h-3.5 w-3.5" />
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
    <div className="space-y-8 animate-sprout">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0F172A] mb-1">Voice Calls History</h1>
        <p className="text-sm text-[#475569]">Track and review automated voice calls made to farmers.</p>
      </div>

      <div className="glass-card rounded-2xl border border-black/[0.05] overflow-hidden">
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
                    Loading calls...
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
                      <p className="text-sm text-[#6B7280]">No call records found</p>
                      <p className="text-xs text-[#4B5563]">Voice calls will appear here once campaigns are started.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        <div className="flex items-center justify-end space-x-2 p-4 border-t border-black/[0.05] bg-black/[0.01]">
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
  );
}
