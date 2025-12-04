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
  Column,
  FilterFn,
} from "@tanstack/react-table";
import { useQuery, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./App.css";
import { BsSortUp, BsSortDown } from "react-icons/bs";
import { json2csv } from "json-2-csv";
import { parseISO, format, isValid, isSameDay, isAfter, isBefore } from "date-fns";

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
  cycleFrom: string;
  cycleTo: string;
}

// Filter input types
type FilterInputType = "text" | "number" | "numberRange" | "date";

// Number range filter value type
type NumberRangeFilterValue = [number | "", number | ""];

// Extend column meta to include filter type
declare module "@tanstack/react-table" {
  interface ColumnMeta<TData, TValue> {
    filterType?: FilterInputType;
  }
}

// Custom filter function for numbers (exact match or starts with)
const numberFilter: (type: "exact" | "startsWith") => FilterFn<SalesRecord> =
  (type: "exact" | "startsWith") => (row, columnId, filterValue) => {
    if (filterValue === "" || filterValue === null || filterValue === undefined) return true;
    const value = row.getValue(columnId) as number;
    if (type === "exact") {
      return String(value) === String(filterValue);
    }
    if (type === "startsWith") {
      return String(value).startsWith(String(filterValue));
    }
    return true;
  };

// Custom filter function for number range (from - to)
const numberRangeFilter: FilterFn<SalesRecord> = (row, columnId, filterValue) => {
  const value = row.getValue(columnId) as number;
  const [min, max] = (filterValue as NumberRangeFilterValue) || ["", ""];

  // If no filter values, show all
  if (
    (min === "" || min === null || min === undefined) &&
    (max === "" || max === null || max === undefined)
  ) {
    return true;
  }

  // Check min bound
  if (min !== "" && min !== null && min !== undefined) {
    if (value < Number(min)) return false;
  }

  // Check max bound
  if (max !== "" && max !== null && max !== undefined) {
    if (value > Number(max)) return false;
  }

  return true;
};

// Custom filter function for dates using date-fns
const dateFilter: FilterFn<SalesRecord> = (row, columnId, filterValue) => {
  if (!filterValue) return true;

  const cellValue = row.getValue(columnId) as string;
  if (!cellValue) return false;

  const cellDate = parseISO(cellValue);
  const filterDate = parseISO(filterValue as string);

  if (!isValid(cellDate) || !isValid(filterDate)) return false;

  return isSameDay(cellDate, filterDate);
};

const dateRangeFilter: (type: "from" | "to") => FilterFn<SalesRecord> =
  (type: "from" | "to") => (row, columnId, filterValue) => {
    if (!filterValue) return true;
    if (type === "from") {
      const cellValue = row.getValue(columnId) as string;
      if (!cellValue) return false;
      const cellDate = parseISO(cellValue);
      const filterDate = parseISO(filterValue as string);
      return isValid(cellDate) && isValid(filterDate) && isAfter(cellDate, filterDate);
    }
    if (type === "to") {
      const cellValue = row.getValue(columnId) as string;
      if (!cellValue) return false;
      const cellDate = parseISO(cellValue);
      const filterDate = parseISO(filterValue as string);
      return isValid(cellDate) && isValid(filterDate) && isBefore(cellDate, filterDate);
    }
    return true;
  };

// Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 minutes
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

// Fetch a single page of data
const fetchPage = async (
  page: number,
  limit: number,
  startDate: string,
  endDate: string,
  cycleFrom: string,
  cycleTo: string,
): Promise<ApiResponse> => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  if (cycleFrom) params.append("cycleFrom", cycleFrom);
  if (cycleTo) params.append("cycleTo", cycleTo);

  const response = await fetch(`/hub-reports/data?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Failed to fetch data");
  }

  return response.json();
};

// Fetch all data using pagination
const fetchData = async ({
  startDate,
  endDate,
  cycleFrom,
  cycleTo,
}: FetchDataParams): Promise<SalesRecord[]> => {
  const PAGE_SIZE = 2000; // Records per page

  // First, fetch page 1 to get total pages and total records
  const firstPage = await fetchPage(1, PAGE_SIZE, startDate, endDate, cycleFrom, cycleTo);
  const { totalPages, totalRecords } = firstPage.pagination;

  // Check if data exceeds maximum allowed records
  const MAX_RECORDS = 50000;
  if (totalRecords > MAX_RECORDS) {
    throw new Error(
      `Too many records (${totalRecords.toLocaleString()}). Maximum allowed is ${MAX_RECORDS.toLocaleString()}. Please refine your filters to narrow down the results.`,
    );
  }

  const allData: SalesRecord[] = [...(firstPage.data || [])];

  // If there are more pages, fetch them in parallel
  if (totalPages > 1) {
    const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);

    for (const page of remainingPages) {
      const result = await fetchPage(page, PAGE_SIZE, startDate, endDate, cycleFrom, cycleTo);
      if (result.data) {
        allData.push(...result.data);
      }
    }
  }

  return allData;
};

// Column Definitions with filter types
const columnDefs: ColumnDef<SalesRecord>[] = [
  {
    accessorKey: "QtyDeliv",
    header: "Quantity",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: numberRangeFilter,
    meta: { filterType: "numberRange" },
  },
  {
    accessorKey: "saleSource",
    header: "Source",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: "includesString",
    meta: { filterType: "text" },
  },
  {
    accessorKey: "location",
    header: "Location",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: "includesString",
    meta: { filterType: "text" },
  },
  {
    accessorKey: "SaleNom",
    header: "Nominal Sale",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: numberRangeFilter,
    meta: { filterType: "numberRange" },
  },
  {
    accessorKey: "TaxSale",
    header: "Sale Tax",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: numberRangeFilter,
    meta: { filterType: "numberRange" },
  },
  {
    accessorKey: "FeeCoop",
    header: "Market Fee",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: numberRangeFilter,
    meta: { filterType: "numberRange" },
  },
  {
    accessorKey: "FeeCoopForgiv",
    header: "Market-Fee Forgiv",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: numberRangeFilter,
    meta: { filterType: "numberRange" },
  },
  {
    accessorKey: "IDCyc",
    header: "Cycle",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: numberRangeFilter,
    meta: { filterType: "numberRange" },
  },
  {
    accessorKey: "WhenStartCyc",
    header: "Cycle Start",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: dateRangeFilter("from"),
    meta: { filterType: "date" },
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
    filterFn: dateRangeFilter("to"),
    meta: { filterType: "date" },
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
    filterFn: numberFilter("exact"),
    meta: { filterType: "number" },
  },
  {
    accessorKey: "IDProduct",
    header: "Product ID",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: numberFilter("exact"),
    meta: { filterType: "number" },
  },
  {
    accessorKey: "NameProduct",
    header: "Product",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: "includesString",
    meta: { filterType: "text" },
  },
  {
    accessorKey: "NameCat",
    header: "Category",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: "includesString",
    meta: { filterType: "text" },
  },
  {
    accessorKey: "NameSubcat",
    header: "Subcategory",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: "includesString",
    meta: { filterType: "text" },
  },
  {
    accessorKey: "IDProducer",
    header: "Producer ID",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: numberFilter("exact"),
    meta: { filterType: "number" },
  },
  {
    accessorKey: "Producer",
    header: "Producer",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: "includesString",
    meta: { filterType: "text" },
  },
  {
    accessorKey: "IDMemb",
    header: "Customer ID",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: numberFilter("exact"),
    meta: { filterType: "number" },
  },
  {
    accessorKey: "CustomerName",
    header: "Customer",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: "includesString",
    meta: { filterType: "text" },
  },
  {
    accessorKey: "CustEmail",
    header: "Email",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: "includesString",
    meta: { filterType: "text" },
  },
  {
    accessorKey: "CustPhone",
    header: "Phone",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: "includesString",
    meta: { filterType: "text" },
  },
];

// Number Range Filter Input Component
function NumberRangeFilterInput({ column }: { column: Column<SalesRecord, unknown> }) {
  const filterValue = (column.getFilterValue() as NumberRangeFilterValue) || ["", ""];

  return (
    <div className="d-flex flex-column gap-2">
      <input
        type="number"
        className="form-control form-control-sm"
        placeholder="From"
        value={filterValue[0]}
        onChange={e => {
          const val = e.target.value === "" ? "" : Number(e.target.value);
          column.setFilterValue([val, filterValue[1]]);
        }}
        style={{ minWidth: "70px" }}
      />
      <input
        type="number"
        className="form-control form-control-sm"
        placeholder="To"
        value={filterValue[1]}
        onChange={e => {
          const val = e.target.value === "" ? "" : Number(e.target.value);
          column.setFilterValue([filterValue[0], val]);
        }}
        style={{ minWidth: "70px" }}
      />
    </div>
  );
}

// Filter Input Component
function ColumnFilterInput({ column }: { column: Column<SalesRecord, unknown> }) {
  const filterType = column.columnDef.meta?.filterType || "text";
  const filterValue = column.getFilterValue();

  if (filterType === "numberRange") {
    return <NumberRangeFilterInput column={column} />;
  }

  if (filterType === "number") {
    return (
      <input
        type="number"
        className="form-control form-control-sm"
        value={(filterValue ?? "") as string}
        onChange={e => column.setFilterValue(e.target.value)}
        placeholder="Filter..."
        style={{ minWidth: "80px" }}
      />
    );
  }

  if (filterType === "date") {
    return (
      <input
        type="date"
        className="form-control form-control-sm"
        value={(filterValue ?? "") as string}
        onChange={e => column.setFilterValue(e.target.value)}
        style={{ minWidth: "140px" }}
      />
    );
  }

  // Default: text input
  return (
    <input
      type="text"
      className="form-control form-control-sm"
      value={(filterValue ?? "") as string}
      onChange={e => column.setFilterValue(e.target.value)}
      placeholder="Filter..."
      style={{ minWidth: "90px" }}
    />
  );
}

function DataTable() {
  // Filter states for API call - with default start date
  const [startDate, setStartDate] = useState(INITIAL_START_DATE);
  const [endDate, setEndDate] = useState("");
  const [cycleFrom, setCycleFrom] = useState("");
  const [cycleTo, setCycleTo] = useState("");

  // Track if user has requested data
  const [shouldFetch, setShouldFetch] = useState(false);

  // Applied filters (what was last submitted)
  const [appliedFilters, setAppliedFilters] = useState({
    startDate: INITIAL_START_DATE,
    endDate: "",
    cycleFrom: "",
    cycleTo: "",
  });

  // Table states for client-side sorting and filtering
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Fetch data with TanStack Query - only when enabled
  const {
    data: allData,
    isLoading,
    error,
  } = useQuery({
    queryKey: [
      "salesData",
      appliedFilters.startDate,
      appliedFilters.endDate,
      appliedFilters.cycleFrom,
      appliedFilters.cycleTo,
    ],
    queryFn: () => fetchData(appliedFilters),
    enabled: shouldFetch,
  });

  // Memoize table data
  const tableData = useMemo(() => allData || [], [allData]);

  // TanStack Table instance - NO pagination, client-side filtering and sorting
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
    getFilteredRowModel: getFilteredRowModel(), // Client-side filtering
  });

  // Apply server-side filters (date range, cycle range) and fetch data
  const handleApplyFilters = () => {
    // Validate date range
    if (startDate && endDate && isAfter(parseISO(startDate), parseISO(endDate))) {
      alert("Start date must be before or equal to end date");
      return;
    }
    // Validate cycle range
    if (cycleFrom && cycleTo && parseInt(cycleFrom) > parseInt(cycleTo)) {
      alert("Cycle from must be less than or equal to cycle to");
      return;
    }
    setAppliedFilters({
      startDate,
      endDate,
      cycleFrom,
      cycleTo,
    });
    setShouldFetch(true);
    setColumnFilters([]); // Clear client-side column filters
  };

  // Clear all filters
  const handleClearFilters = () => {
    setStartDate(INITIAL_START_DATE);
    setEndDate("");
    setCycleFrom("");
    setCycleTo("");
    setAppliedFilters({
      startDate: INITIAL_START_DATE,
      endDate: "",
      cycleFrom: "",
      cycleTo: "",
    });
    setColumnFilters([]);
    setShouldFetch(false);
  };

  // Clear only client-side column filters
  const handleClearColumnFilters = () => {
    setColumnFilters([]);
  };

  // Export all filtered data to CSV
  const createCsv = () => {
    try {
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

  const totalRows = tableData.length;
  const filteredRows = table.getFilteredRowModel().rows.length;
  const hasColumnFilters = columnFilters.length > 0;

  return (
    <div className="App">
      {/* Server-side Filter Section (Date Range & Cycle Range) */}
      <div className="px-3 py-3 bg-light border-bottom">
        <div className="row g-2 align-items-end">
          <div className="col-md-2">
            <label className="form-label fw-semibold mb-1">Start Date</label>
            <input
              type="date"
              className="form-control"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div className="col-md-2">
            <label className="form-label fw-semibold mb-1">End Date</label>
            <input
              type="date"
              className="form-control"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
          <div className="col-md-2">
            <label className="form-label fw-semibold mb-1">Cycle From</label>
            <input
              type="number"
              className="form-control"
              placeholder="e.g., 300"
              value={cycleFrom}
              onChange={e => setCycleFrom(e.target.value)}
            />
          </div>
          <div className="col-md-2">
            <label className="form-label fw-semibold mb-1">Cycle To</label>
            <input
              type="number"
              className="form-control"
              placeholder="e.g., 350"
              value={cycleTo}
              onChange={e => setCycleTo(e.target.value)}
            />
          </div>
          <div className="col-md-4 mt-3 mt-md-0">
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-primary flex-grow-1"
                onClick={handleApplyFilters}
                disabled={isLoading}
              >
                {isLoading ? "Loading..." : "Load data"}
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
      </div>

      {/* Actions Bar */}
      <div className="d-flex flex-row justify-content-between align-items-center px-3 py-2 bg-white border-bottom">
        <div className="d-flex align-items-center gap-3">
          <span className="text-muted">
            Showing <strong className="text-dark">{filteredRows.toLocaleString()}</strong> of{" "}
            <strong className="text-dark">{totalRows.toLocaleString()}</strong> records
          </span>
          {hasColumnFilters && (
            <span className="badge bg-info text-dark" style={{ fontSize: "0.75rem" }}>
              Column filters active
            </span>
          )}
        </div>
        <div className="d-flex gap-2">
          {hasColumnFilters && (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={handleClearColumnFilters}
            >
              Clear Column Filters
            </button>
          )}
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={createCsv}
            disabled={isLoading || filteredRows === 0}
          >
            Export CSV ({filteredRows.toLocaleString()} records)
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-5 my-5">
          <div
            className="spinner-border text-primary mb-3"
            role="status"
            style={{ width: "3rem", height: "3rem" }}
          >
            <span className="visually-hidden" />
          </div>
          <p className="text-muted fs-5 fw-medium" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="mx-4 my-4">
          <div className="alert alert-danger shadow-sm" role="alert">
            <h5 className="alert-heading">Error loading data</h5>
            <p className="mb-0">{(error as Error).message}</p>
          </div>
        </div>
      )}

      {/* Initial State - No data loaded yet */}
      {!isLoading && !error && !shouldFetch && (
        <div className="text-center py-5 my-5">
          <div className="mb-4">
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </div>
          <h4 className="mb-3">Ready to load data</h4>
          <p className="text-muted mb-1">Click "Load data" to load data</p>
          <p className="text-secondary small">
            Default filter is set to beginning of current month
          </p>
        </div>
      )}

      {/* Data Table */}
      {!isLoading && !error && shouldFetch && tableData.length > 0 && (
        <div className="reports">
          <div
            className="table-responsive"
            style={{ maxHeight: "calc(100vh - 260px)", overflow: "auto" }}
          >
            <table className="table table-striped table-hover table-sm mb-0">
              <thead className="table-light sticky-top" style={{ top: 0, zIndex: 10 }}>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th
                        key={header.id}
                        style={{
                          minWidth: "120px",
                          verticalAlign: "top",
                          padding: "12px 8px",
                          backgroundColor: "#f8f9fa",
                        }}
                      >
                        {/* Column Header with Sorting */}
                        <div
                          className={
                            header.column.getCanSort()
                              ? "cursor-pointer user-select-none fw-semibold"
                              : "fw-semibold"
                          }
                          onClick={header.column.getToggleSortingHandler()}
                          style={{ whiteSpace: "nowrap", marginBottom: "8px" }}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === "asc" && (
                            <BsSortDown className="ms-2 text-primary" />
                          )}
                          {header.column.getIsSorted() === "desc" && (
                            <BsSortUp className="ms-2 text-primary" />
                          )}
                        </div>
                        {/* Client-side Column Filter Input */}
                        {header.column.getCanFilter() && (
                          <ColumnFilterInput column={header.column} />
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columnDefs.length} className="text-center text-muted py-5">
                      <div className="py-3">
                        <p className="mb-1 fw-medium">No rows match your column filters</p>
                        <p className="mb-0 small text-secondary">
                          Try adjusting your filter criteria
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map(row => (
                    <tr key={row.id}>
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} style={{ padding: "10px 8px" }}>
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
        <div className="text-center py-5 my-5">
          <div className="mb-4">
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
          </div>
          <h4 className="mb-3">No data found</h4>
          <p className="text-muted mb-1">No data found for the selected filters</p>
          <p className="text-secondary small">Try adjusting your date range or cycle IDs</p>
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
