import { useState, useEffect } from "react";
import api from "@/lib/api";
import { 
  flexRender, 
  getCoreRowModel, 
  getPaginationRowModel,
  getFilteredRowModel,
  useReactTable 
} from "@tanstack/react-table";
import { MessageSquareText, PhoneCall, Download, Search, Filter } from "lucide-react";
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
  const [globalFilter, setGlobalFilter] = useState("");
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResponse, setSelectedResponse] = useState<any>(null);

  const fetchResponses = async () => {
    try {
      setLoading(true);
      const res = await api.get("/responses");
      setResponses(res.data);
    } catch (error) {
      console.error("Failed to load responses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResponses();
  }, []);

  const handleExportCSV = () => {
    if (responses.length === 0) return;
    
    const headers = ["Farmer", "Phone", "Status", "Duration", "Summary", "Date"];
    const csvContent = [
      headers.join(","),
      ...responses.map(r => [
        `"${r.farmer_name}"`,
        `"${r.phone_number}"`,
        `"${r.call_status}"`,
        `"${r.call_duration || ''}"`,
        `"${(r.conversation_summary || '').replace(/"/g, '""')}"`,
        `"${new Date(r.created_at).toLocaleString()}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "farmer_responses.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns = [
    { accessorKey: "farmer_name", header: "Farmer" },
    { accessorKey: "phone_number", header: "Phone" },
    { 
      accessorKey: "call_status", 
      header: "Status",
      cell: ({ row }: any) => {
        const status = row.getValue("call_status");
        return (
          <Badge variant="outline" className={status === "completed" ? "border-emerald-500/30 text-emerald-400" : "border-yellow-500/30 text-yellow-400"}>
            {status}
          </Badge>
        );
      }
    },
    { 
      accessorKey: "created_at", 
      header: "Date",
      cell: ({ row }: any) => {
        const dateStr = row.getValue("created_at");
        return <span className="text-sm text-slate-300">{new Date(dateStr).toLocaleString()}</span>
      }
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }: any) => {
        return (
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="border-white/10 text-slate-300 hover:bg-white/5 hover:text-white h-8"
              onClick={() => setSelectedResponse(row.original)}
            >
              <MessageSquareText className="mr-2 h-3.5 w-3.5" />
              View
            </Button>
            {row.original.call_status === 'completed' && (
              <Button size="sm" className="h-8 bg-primary hover:bg-primary/90 text-white">
                <PhoneCall className="mr-2 h-3.5 w-3.5" />
                Call Again
              </Button>
            )}
          </div>
        )
      },
    },
  ];

  const table = useReactTable({
    data: responses,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Farmer Responses</h1>
          <p className="text-slate-400">Review AI-analyzed responses and transcripts from farmer calls.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleExportCSV} variant="outline" className="border-white/10 text-slate-300 hover:bg-white/5 hover:text-white">
            <Download className="mr-2 h-4 w-4" />
            Export to Excel/CSV
          </Button>
        </div>
      </div>

      <div className="glass-card rounded-xl border border-white/5 overflow-hidden">
        <div className="p-4 flex flex-col sm:flex-row justify-between gap-4 border-b border-white/5 bg-slate-900/50">
          <div className="relative w-full sm:max-w-sm group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Search responses..."
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
                    Loading responses...
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
                    No responses found.
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

      <Sheet open={!!selectedResponse} onOpenChange={(open) => !open && setSelectedResponse(null)}>
        <SheetContent className="bg-slate-900 border-l border-white/10 text-slate-200 w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-white flex items-center gap-2">
              <MessageSquareText className="h-5 w-5 text-primary" />
              Call Summary
            </SheetTitle>
            <SheetDescription className="text-slate-400">
              Details for {selectedResponse?.farmer_name}
            </SheetDescription>
          </SheetHeader>
          
          {selectedResponse && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-950/50 rounded-lg border border-white/5">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Phone Number</p>
                  <p className="text-sm font-medium text-slate-200">{selectedResponse.phone_number}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Status</p>
                  <p className="text-sm font-medium text-slate-200">{selectedResponse.call_status}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Call Duration</p>
                  <p className="text-sm font-medium text-slate-200">{selectedResponse.call_duration || 'Unknown'}s</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Date</p>
                  <p className="text-sm font-medium text-slate-200">{new Date(selectedResponse.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <h4 className="text-sm font-semibold text-slate-300 mb-2">AI Summary</h4>
                <p className="text-sm text-slate-400 leading-relaxed bg-slate-950/50 p-3 rounded-lg border border-white/5">
                  {selectedResponse.conversation_summary || 'No summary generated yet.'}
                </p>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-300 border-b border-white/10 pb-2">Transcript</h4>
                
                <div className="space-y-4 text-sm text-slate-300">
                  {selectedResponse.farmer_responses ? (
                    Array.isArray(selectedResponse.farmer_responses) ? (
                      selectedResponse.farmer_responses.map((msg: any, idx: number) => (
                        <div key={idx} className={`p-3 rounded-xl border border-white/5 ${msg.role === 'agent' ? 'bg-primary/10 ml-4' : 'bg-slate-800/50 mr-4'}`}>
                          <strong>{msg.role === 'agent' ? 'AI' : 'Farmer'}: </strong>
                          {msg.content}
                        </div>
                      ))
                    ) : (
                      <pre className="whitespace-pre-wrap">{JSON.stringify(selectedResponse.farmer_responses, null, 2)}</pre>
                    )
                  ) : (
                    <p className="text-slate-500 italic">No transcript available.</p>
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
