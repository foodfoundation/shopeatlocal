//@ts-nocheck

import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  SortingState,
  ColumnFiltersState,
  ColumnDef,
} from "@tanstack/react-table";
import { useQuery, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./App.css";
import { BsSortUp, BsSortDown } from "react-icons/bs";
import { json2csv } from "json-2-csv";

// Types
interface SalesRecord {
  QtyDeliv: number;
  saleSource: string;
  location: string;
  SaleNom: number;
  TaxSale: number;
  FeeCoop: number;
  FeeCoopForgiv: number;
  IDCyc: number;
  WhenStartCyc: string;
  WhenEndCyc: string;
  IDVty: number;
  IDProduct: number;
  NameProduct: string;
  NameCat: string;
  NameSubcat: string;
  IDProducer: number;
  Producer: string;
  IDMemb: number;
  CustomerName: string;
  CustEmail: string;
  CustPhone: string;
}

interface ApiResponse {
  data: SalesRecord[];
  pagination: {
    page: number;
    limit: number;
    totalRecords: number;
    totalPages: number;
  };
}

interface FetchDataParams {
  page: number;
  limit: number;
  startDate: string;
  endDate: string;
  cycleIds: string;
}

// Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Fetch function
const fetchData = async ({
  page,
  limit,
  startDate,
  endDate,
  cycleIds,
}: FetchDataParams): Promise<ApiResponse> => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  if (cycleIds) params.append("cycleIds", cycleIds);

  const response = await fetch(`/hub-reports/data?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Failed to fetch data");
  }

  return response.json();
};

// Column Definitions
const columnDefs: ColumnDef<SalesRecord>[] = [
  {
    accessorKey: "QtyDeliv",
    header: "Quantity",
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "saleSource",
    header: "Source",
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "location",
    header: "Location",
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "SaleNom",
    header: "Nominal Sale",
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "TaxSale",
    header: "Sale Tax",
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "FeeCoop",
    header: "Market Fee",
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "FeeCoopForgiv",
    header: "Market-Fee Forgiv",
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "IDCyc",
    header: "Cycle",
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "WhenStartCyc",
    header: "Cycle Start",
    enableSorting: true,
    enableColumnFilter: true,
    cell: ({ getValue }) => {
      const value = getValue() as string;
      return value ? new Date(value).toLocaleDateString() : "";
    },
  },
  {
    accessorKey: "WhenEndCyc",
    header: "Cycle End",
    enableSorting: true,
    enableColumnFilter: true,
    cell: ({ getValue }) => {
      const value = getValue() as string;
      return value ? new Date(value).toLocaleDateString() : "";
    },
  },
  {
    accessorKey: "IDVty",
    header: "Variety",
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "IDProduct",
    header: "Product ID",
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "NameProduct",
    header: "Product",
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "NameCat",
    header: "Category",
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "NameSubcat",
    header: "Subcategory",
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "IDProducer",
    header: "Producer ID",
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "Producer",
    header: "Producer",
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "IDMemb",
    header: "Customer ID",
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "CustomerName",
    header: "Customer",
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "CustEmail",
    header: "Email",
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "CustPhone",
    header: "Phone",
    enableSorting: true,
    enableColumnFilter: true,
  },
];

function DataTable() {
  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  // Filter states
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [cycleIds, setCycleIds] = useState("");

  // Table states
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Fetch data with Tanstack Query
  const {
    data: apiResponse,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["salesData", page, limit, startDate, endDate, cycleIds],
    queryFn: () => fetchData({ page, limit, startDate, endDate, cycleIds }),
  });

  const data = useMemo(() => apiResponse?.data || [], [apiResponse]);
  const pagination = useMemo(
    () =>
      apiResponse?.pagination || {
        page: 1,
        limit: 50,
        totalRecords: 0,
        totalPages: 0,
      },
    [apiResponse],
  );

  // Table instance
  const table = useReactTable({
    data,
    columns: columnDefs,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    manualPagination: true,
    pageCount: pagination.totalPages,
  });

  const handleApplyFilters = () => {
    setPage(1);
    refetch();
  };

  const handleClearFilters = () => {
    setStartDate("");
    setEndDate("");
    setCycleIds("");
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  const createCsv = () => {
    try {
      if (!data || data.length === 0) {
        alert("No data available to export.");
        return;
      }

      const csv = json2csv(data);

      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.setAttribute("href", url);
      a.setAttribute("download", "producer-sales-report.csv");
      a.click();
    } catch (error) {
      console.error("CSV export error:", error);
      alert("We encountered an error generating your CSV. Please try again later.");
    }
  };

  return (
    <div className="App">
      {/* Filter Section */}
      <div className="p-3 bg-light border-bottom">
        <div className="row g-3 align-items-end">
          <div className="col-md-3">
            <label className="form-label fw-bold">Start Date</label>
            <input
              type="date"
              className="form-control"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label fw-bold">End Date</label>
            <input
              type="date"
              className="form-control"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label fw-bold">Cycle IDs</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g., 300,301,302"
              value={cycleIds}
              onChange={e => setCycleIds(e.target.value)}
            />
          </div>
          <div className="col-md-3">
            <button
              type="button"
              className="btn btn-primary me-2"
              onClick={handleApplyFilters}
              disabled={isLoading}
            >
              Apply Filters
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={handleClearFilters}
              disabled={isLoading}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="d-flex flex-row justify-content-between align-items-center p-2 border-bottom">
        <div>
          <span className="text-muted">
            Showing {data.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.totalRecords)} of{" "}
            {pagination.totalRecords} records
          </span>
        </div>
        <button
          type="button"
          className="btn btn-outline-primary"
          onClick={createCsv}
          disabled={isLoading || data.length === 0}
        >
          Export CSV
        </button>
      </div>

      {/* Pagination Controls */}
      <div className="d-flex flex-row justify-content-between align-items-center p-2 bg-light">
        <div>
          <label className="me-2">Records per page:</label>
          <select
            className="form-select form-select-sm d-inline-block w-auto"
            value={limit}
            onChange={e => handleLimitChange(parseInt(e.target.value))}
            disabled={isLoading}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
        <div className="btn-group" role="group">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => handlePageChange(1)}
            disabled={isLoading || page === 1}
          >
            First
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => handlePageChange(page - 1)}
            disabled={isLoading || page === 1}
          >
            Previous
          </button>
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled>
            Page {page} of {pagination.totalPages}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => handlePageChange(page + 1)}
            disabled={isLoading || page >= pagination.totalPages}
          >
            Next
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => handlePageChange(pagination.totalPages)}
            disabled={isLoading || page >= pagination.totalPages}
          >
            Last
          </button>
        </div>
      </div>

      {/* Loading/Error States */}
      {isLoading && (
        <div className="text-center p-5">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-danger m-3" role="alert">
          Error loading data: {(error as Error).message}
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && (
        <div className="reports">
          <div className="table-responsive">
            <table className="table table-striped table-hover">
              <thead className="table-light sticky-top">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th key={header.id} style={{ minWidth: "120px" }}>
                        <div
                          className={
                            header.column.getCanSort() ? "cursor-pointer user-select-none" : ""
                          }
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === "asc" ? (
                            <span className="ms-1">
                              <BsSortDown />
                            </span>
                          ) : header.column.getIsSorted() === "desc" ? (
                            <span className="ms-1">
                              <BsSortUp />
                            </span>
                          ) : null}
                        </div>
                        {header.column.getCanFilter() && (
                          <div className="mt-1">
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              value={(header.column.getFilterValue() ?? "") as string}
                              onChange={e => header.column.setFilterValue(e.target.value)}
                              placeholder="Filter..."
                            />
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columnDefs.length} className="text-center text-muted py-4">
                      No rows match your filters!
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map(row => (
                    <tr key={row.id}>
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DataTable />
    </QueryClientProvider>
  );
}

export default App;
