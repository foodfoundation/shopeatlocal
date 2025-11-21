//@ts-nocheck

import { useState, useEffect } from "react";
import FilterableTable from "react-filterable-table";
import "./App.css";
import { BsSortUp, BsSortDown } from "react-icons/bs";
import { json2csv } from "json-2-csv";

// Field definitions
const fields = [
  {
    name: "QtyDeliv",
    displayName: "Quantity",
    inputFilterable: true,
    exactFilterable: true,
    sortable: true,
  },
  {
    name: "saleSource",
    displayName: "Source",
    inputFilterable: true,
    exactFilterable: true,
    sortable: true,
  },
  {
    name: "location",
    displayName: "Location",
    inputFilterable: true,
    exactFilterable: true,
    sortable: true,
  },
  {
    name: "SaleNom",
    displayName: "Nominal Sale",
    inputFilterable: true,
    exactFilterable: true,
    sortable: true,
  },
  {
    name: "TaxSale",
    displayName: "Sale Tax",
    inputFilterable: true,
    exactFilterable: true,
    sortable: true,
  },
  {
    name: "FeeCoop",
    displayName: "Market Fee",
    inputFilterable: true,
    exactFilterable: true,
    sortable: true,
  },
  {
    name: "FeeCoopForgiv",
    displayName: "Market-Fee Forgiv",
    inputFilterable: true,
    exactFilterable: true,
    sortable: true,
  },
  {
    name: "IDCyc",
    displayName: "Cycle",
    inputFilterable: true,
    exactFilterable: true,
    sortable: true,
  },
  {
    name: "WhenStartCyc",
    displayName: "Cycle Start",
    inputFilterable: true,
    exactFilterable: true,
    sortable: true,
    render: value => (value ? new Date(value).toLocaleDateString() : ""),
  },
  {
    name: "WhenEndCyc",
    displayName: "Cycle End",
    inputFilterable: true,
    exactFilterable: true,
    sortable: true,
    render: value => (value ? new Date(value).toLocaleDateString() : ""),
  },
  {
    name: "IDVty",
    displayName: "Variety",
    inputFilterable: true,
    exactFilterable: true,
    sortable: true,
  },
  {
    name: "IDProduct",
    displayName: "Product ID",
    inputFilterable: true,
    exactFilterable: true,
    sortable: true,
  },
  {
    name: "NameProduct",
    displayName: "Product",
    inputFilterable: true,
    exactFilterable: true,
    sortable: true,
  },
  {
    name: "NameCat",
    displayName: "Category",
    inputFilterable: true,
    exactFilterable: true,
    sortable: true,
  },
  {
    name: "NameSubcat",
    displayName: "Subcategory",
    inputFilterable: true,
    exactFilterable: true,
    sortable: true,
  },
  {
    name: "IDProducer",
    displayName: "Producer ID",
    inputFilterable: true,
    exactFilterable: true,
    sortable: true,
  },
  {
    name: "Producer",
    displayName: "Producer",
    inputFilterable: true,
    exactFilterable: true,
    sortable: true,
  },
  {
    name: "IDMemb",
    displayName: "Customer ID",
    inputFilterable: true,
    exactFilterable: true,
    sortable: true,
  },
  {
    name: "CustomerName",
    displayName: "Customer",
    inputFilterable: true,
    exactFilterable: true,
    sortable: true,
  },
  {
    name: "CustEmail",
    displayName: "Email",
    inputFilterable: true,
    exactFilterable: true,
    sortable: true,
  },
  {
    name: "CustPhone",
    displayName: "Phone",
    inputFilterable: true,
    exactFilterable: true,
    sortable: true,
  },
];

function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    totalRecords: 0,
    totalPages: 0,
  });

  // Filter states
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [cycleIds, setCycleIds] = useState("");

  const fetchData = async (page = 1, limit = 50) => {
    setLoading(true);
    setError(null);

    try {
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

      const result = await response.json();
      setData(result.data || []);
      setPagination(result.pagination);
    } catch (err) {
      setError(err.message);
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(pagination.page, pagination.limit);
  }, []);

  const handleApplyFilters = () => {
    fetchData(1, pagination.limit);
  };

  const handleClearFilters = () => {
    setStartDate("");
    setEndDate("");
    setCycleIds("");
    // Fetch data with cleared filters
    setTimeout(() => fetchData(1, pagination.limit), 0);
  };

  const handlePageChange = newPage => {
    fetchData(newPage, pagination.limit);
  };

  const handleLimitChange = newLimit => {
    fetchData(1, newLimit);
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
              disabled={loading}
            >
              Apply Filters
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={handleClearFilters}
              disabled={loading}
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
          disabled={loading || data.length === 0}
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
            value={pagination.limit}
            onChange={e => handleLimitChange(parseInt(e.target.value))}
            disabled={loading}
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
            disabled={loading || pagination.page === 1}
          >
            First
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={loading || pagination.page === 1}
          >
            Previous
          </button>
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled>
            Page {pagination.page} of {pagination.totalPages}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={loading || pagination.page >= pagination.totalPages}
          >
            Next
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => handlePageChange(pagination.totalPages)}
            disabled={loading || pagination.page >= pagination.totalPages}
          >
            Last
          </button>
        </div>
      </div>

      {/* Loading/Error States */}
      {loading && (
        <div className="text-center p-5">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-danger m-3" role="alert">
          Error loading data: {error}
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="reports">
          <FilterableTable
            namespace="Producer Reports"
            initialSort="IDCyc"
            data={data}
            fields={fields}
            noRecordsMessage="There is no data to display"
            noFilteredRecordsMessage="No rows match your filters!"
            iconSortedDesc={<BsSortUp />}
            iconSortedAsc={<BsSortDown />}
            pageSize={pagination.limit}
            pagersVisible={false}
          />
        </div>
      )}
    </div>
  );
}

export default App;
