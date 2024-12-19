import FilterableTable from "react-filterable-table";
import "./App.css";
import { BsSortUp, BsSortDown } from "react-icons/bs";
import { json2csv } from "json-2-csv";

function App() {
  const createCsv = () => {
    try {
      const csv = json2csv(window.ProducerData.data);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.setAttribute("href", url);
      a.setAttribute("download", "producer-sales-report.csv");
      a.click();
    } catch (error) {
      alert("We encountered an error generating your CSV. Please try again later.");
      console.error("generating_csv_error:", error);
    }
  };

  return (
    <div className="App">
      <div className="d-flex flex-row justify-content-between p-2">
        <button type="button" className="btn btn-outline-primary" onClick={createCsv}>
          Export CSV
        </button>
      </div>
      <div className="reports">
        <FilterableTable
          namespace="Producer Reports"
          initialSort="Cyc.IDCyc"
          data={window.ProducerData.data}
          fields={window.ProducerData.fields}
          noRecordsMessage="There is no data to display"
          noFilteredRecordsMessage="No rows match your filters!"
          iconSortedDesc={<BsSortUp />}
          iconSortedAsc={<BsSortDown />}
          pageSizes={[20, 50, 100, 1000]}
        />
      </div>
    </div>
  );
}

export default App;
