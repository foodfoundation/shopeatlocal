//@ts-nocheck

import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
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
  startDate: string;
  endDate: string;
  cycleIds: string;
}

// Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: 1,
      staleTime: Infinity,
    },
  },
});

// Helper function to get beginning of current month
const getBeginningOfMonth = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
};

// Store the initial date to avoid recalculation
const INITIAL_START_DATE = getBeginningOfMonth();

// Fetch function - loads all data with limit 5000
const fetchData = async ({
  startDate,
  endDate,
  cycleIds,
}: FetchDataParams): Promise<SalesRecord[]> => {
  const params = new URLSearchParams({
    page: "1",
    limit: "5000", // Load all data
  });

  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  if (cycleIds) params.append("cycleIds", cycleIds);

  const response = await fetch(`/hub-reports/data?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Failed to fetch data");
  }

  const result: ApiResponse = await response.json();
  return result.data || [];
};

// Column Definitions with proper filter functions
const columnDefs: ColumnDef<SalesRecord>[] = [
  {
    accessorKey: "QtyDeliv",
    header: "Quantity",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: "includesString",
  },
  {
    accessorKey: "saleSource",
    header: "Source",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: "includesString",
  },
  {
    accessorKey: "location",
    header: "Location",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: "includesString",
  },
  {
    accessorKey: "SaleNom",
    header: "Nominal Sale",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: "includesString",
  },
  {
    accessorKey: "TaxSale",
    header: "Sale Tax",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: "includesString",
  },
  {
    accessorKey: "FeeCoop",
    header: "Market Fee",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: "includesString",
  },
  {
    accessorKey: "FeeCoopForgiv",
    header: "Market-Fee Forgiv",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: "includesString",
  },
  {
    accessorKey: "IDCyc",
    header: "Cycle",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: "includesString",
  },
  {
    accessorKey: "WhenStartCyc",
    header: "Cycle Start",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: "includesString",
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
    filterFn: "includesString",
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
    filterFn: "includesString",
  },
  {
    accessorKey: "IDProduct",
    header: "Product ID",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: "includesString",
  },
  {
    accessorKey: "NameProduct",
    header: "Product",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: "includesString",
  },
  {
    accessorKey: "NameCat",
    header: "Category",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: "includesString",
  },
  {
    accessorKey: "NameSubcat",
    header: "Subcategory",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: "includesString",
  },
  {
    accessorKey: "IDProducer",
    header: "Producer ID",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: "includesString",
  },
  {
    accessorKey: "Producer",
    header: "Producer",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: "includesString",
  },
  {
    accessorKey: "IDMemb",
    header: "Customer ID",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: "includesString",
  },
  {
    accessorKey: "CustomerName",
    header: "Customer",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: "includesString",
  },
  {
    accessorKey: "CustEmail",
    header: "Email",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: "includesString",
  },
  {
    accessorKey: "CustPhone",
    header: "Phone",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: "includesString",
  },
];

function DataTable() {
  // Filter states - with default start date
  const [startDate, setStartDate] = useState(INITIAL_START_DATE);
  const [endDate, setEndDate] = useState("");
  const [cycleIds, setCycleIds] = useState("");

  // Track if user has requested data
  const [shouldFetch, setShouldFetch] = useState(false);

  // Applied filters (what was last submitted)
  const [appliedFilters, setAppliedFilters] = useState({
    startDate: INITIAL_START_DATE,
    endDate: "",
    cycleIds: "",
  });

  // Table states
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Fetch data with Tanstack Query - only when enabled
  const {
    data: allData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      "salesData",
      appliedFilters.startDate,
      appliedFilters.endDate,
      appliedFilters.cycleIds,
    ],
    queryFn: () => fetchData(appliedFilters),
    enabled: shouldFetch,
  });

  const tableData = useMemo(() => allData || [], [allData]);

  // Table instance with client-side pagination
  const table = useReactTable({
    data: tableData,
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
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 50,
      },
    },
  });

  const handleApplyFilters = () => {
    setAppliedFilters({
      startDate,
      endDate,
      cycleIds,
    });
    setShouldFetch(true);
    table.setPageIndex(0);
    setColumnFilters([]);
  };

  const handleClearFilters = () => {
    setStartDate(INITIAL_START_DATE);
    setEndDate("");
    setCycleIds("");
    setAppliedFilters({
      startDate: INITIAL_START_DATE,
      endDate: "",
      cycleIds: "",
    });
    table.setPageIndex(0);
    setColumnFilters([]);
    setShouldFetch(false);
  };

  const createCsv = () => {
    try {
      // Export all filtered data (not just current page)
      const filteredData = table.getFilteredRowModel().rows.map(row => row.original);

      if (!filteredData || filteredData.length === 0) {
        alert("No data available to export.");
        return;
      }

      const csv = json2csv(filteredData);

      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.setAttribute("href", url);
      a.setAttribute("download", "producer-sales-report.csv");
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("CSV export error:", error);
      alert("We encountered an error generating your CSV. Please try again later.");
    }
  };

  const currentPage = table.getState().pagination.pageIndex + 1;
  const pageSize = table.getState().pagination.pageSize;
  const totalFilteredRows = table.getFilteredRowModel().rows.length;
  const totalPages = table.getPageCount();
  const startRow = totalFilteredRows > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endRow = Math.min(currentPage * pageSize, totalFilteredRows);

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
              {isLoading ? "Loading..." : "Apply Filters"}
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
            Showing {startRow} to {endRow} of {totalFilteredRows} records
            {totalFilteredRows < tableData.length && (
              <span> (filtered from {tableData.length} total)</span>
            )}
          </span>
        </div>
        <button
          type="button"
          className="btn btn-outline-primary"
          onClick={createCsv}
          disabled={isLoading || tableData.length === 0}
        >
          Export CSV ({totalFilteredRows} records)
        </button>
      </div>

      {/* Pagination Controls */}
      <div className="d-flex flex-row justify-content-between align-items-center p-2 bg-light">
        <div>
          <label className="me-2">Records per page:</label>
          <select
            className="form-select form-select-sm d-inline-block w-auto"
            value={pageSize}
            onChange={e => table.setPageSize(Number(e.target.value))}
            disabled={isLoading}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
          </select>
        </div>
        <div className="btn-group" role="group">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            First
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </button>
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled>
            Page {currentPage} of {totalPages || 1}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => table.setPageIndex(Math.max(0, totalPages - 1))}
            disabled={!table.getCanNextPage()}
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
          <p className="mt-3 text-muted">Loading data...</p>
        </div>
      )}

      {error && (
        <div className="alert alert-danger m-3" role="alert">
          Error loading data: {(error as Error).message}
        </div>
      )}

      {/* Initial State - No data loaded yet */}
      {!isLoading && !error && !shouldFetch && (
        <div className="text-center p-5 text-muted">
          <p className="fs-5">Click "Apply Filters" to load data</p>
          <p className="text-secondary">Default filter is set to beginning of current month</p>
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && shouldFetch && tableData.length > 0 && (
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

      {/* No data returned from API */}
      {!isLoading && !error && shouldFetch && tableData.length === 0 && (
        <div className="text-center p-5 text-muted">
          <p className="fs-5">No data found for the selected filters</p>
          <p className="text-secondary">Try adjusting your date range or cycle IDs</p>
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
