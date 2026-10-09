import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5000/api";

const statuses = [
  "Reported",
  "Assigned",
  "In progress",
  "Resolved",
];

const emptyForm = {
  title: "",
  location: "",
  description: "",
};

// Shared helper for communicating with the backend.
async function apiRequest(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_URL}${path}`, options);
  } catch {
    throw new Error(
      "Cannot reach the backend. Check that it is running on port 5000."
    );
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "The request failed.");
  }

  return data;
}

// Each card keeps its own technician input and saving state.
function ReportCard({ report, onSaved, onError }) {
  const [technician, setTechnician] = useState(report.technician);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTechnician(report.technician);
  }, [report.technician]);

  async function saveChange(changes) {
    setSaving(true);

    try {
      const updated = await apiRequest(`/reports/${report._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });

      onSaved(updated);
    } catch (error) {
      onError(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="report-card">
      <div className="card-heading">
        <h3>{report.title}</h3>
        <span className="badge">{report.status}</span>
      </div>

      <p className="location">{report.location}</p>
      <p>{report.description}</p>

      <div className="report-controls">
        <div>
          <label htmlFor={`technician-${report._id}`}>
            Technician
          </label>

          <input
            id={`technician-${report._id}`}
            value={technician}
            onChange={(event) => setTechnician(event.target.value)}
            placeholder="Unassigned"
            maxLength={100}
            disabled={saving}
          />

          <button
            type="button"
            disabled={
              saving ||
              technician.trim() === report.technician
            }
            onClick={() =>
              saveChange({ technician: technician.trim() })
            }
          >
            Save technician
          </button>
        </div>

        <div>
          <label htmlFor={`status-${report._id}`}>Status</label>

          <select
            id={`status-${report._id}`}
            value={report.status}
            disabled={saving}
            onChange={(event) =>
              saveChange({ status: event.target.value })
            }
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>

      {saving && <p role="status">Saving changes...</p>}

      <details>
        <summary>Repair history</summary>
        <ul>
          {report.history.map((entry, index) => (
            <li key={`${report._id}-${index}`}>{entry}</li>
          ))}
        </ul>
      </details>
    </article>
  );
}

export default function App() {
  const [reports, setReports] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Load saved reports when this page opens.
  useEffect(() => {
    let active = true;

    async function loadReports() {
      try {
        const data = await apiRequest("/reports");

        if (active) {
          setReports(data);
        }
      } catch (requestError) {
        if (active) {
          setLoadError(requestError.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadReports();

    return () => {
      active = false;
    };
  }, []);

  function handleInput(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function submitReport(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const cleaned = {
      title: form.title.trim(),
      location: form.location.trim(),
      description: form.description.trim(),
    };

    if (Object.values(cleaned).some((value) => !value)) {
      setError("Please complete every field.");
      return;
    }

    setSubmitting(true);

    try {
      const savedReport = await apiRequest("/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleaned),
      });

      setReports((previous) => [savedReport, ...previous]);
      setForm(emptyForm);
      setMessage("Report saved to MongoDB successfully.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSaved(updatedReport) {
    setReports((previous) =>
      previous.map((report) =>
        report._id === updatedReport._id
          ? updatedReport
          : report
      )
    );

    setError("");
    setMessage("Changes saved to MongoDB.");
  }

  function handleUpdateError(errorMessage) {
    setMessage("");
    setError(errorMessage);
  }

  const visibleReports = reports.filter((report) => {
    const text =
      `${report.title} ${report.location} ${report.description}`
        .toLowerCase();

    return (
      text.includes(search.toLowerCase()) &&
      (filter === "All" || report.status === filter)
    );
  });

  const resolvedCount = reports.filter(
    (report) => report.status === "Resolved"
  ).length;

  const unavailable = loading || Boolean(loadError);

  return (
    <div className="app">
      <header className="header">
        <a className="brand" href="#dashboard">FixTrack</a>
        <span>Repair & maintenance tracker</span>
      </header>

      <main id="dashboard" className="container">
        <section className="intro">
          <p className="eyebrow">MAINTENANCE DASHBOARD</p>
          <h1>Report it. Track it. Get it fixed.</h1>

          <p>
            Keep equipment problems, repair progress, and history
            in one place.
          </p>

          <div className="notice">
            Local learning version. Use fictional data.
            Reports are saved through the API to MongoDB.
          </div>
        </section>

        {loadError && (
          <div className="error-box" role="alert">
            Could not load reports: {loadError}
            {" "}Refresh the page after fixing the connection.
          </div>
        )}

        {error && (
          <div className="error-box" role="alert">{error}</div>
        )}

        <p role="status" className="message">{message}</p>

        <section className="stats" aria-label="Report summary">
          <div className="stat">
            <span>Total reports</span>
            <strong>{unavailable ? "—" : reports.length}</strong>
          </div>

          <div className="stat">
            <span>Open reports</span>
            <strong>
              {unavailable ? "—" : reports.length - resolvedCount}
            </strong>
          </div>

          <div className="stat">
            <span>Resolved</span>
            <strong>{unavailable ? "—" : resolvedCount}</strong>
          </div>
        </section>

        <div className="layout">
          <section className="panel">
            <h2>Report a problem</h2>
            <p className="muted">
              Describe the equipment and where it is located.
            </p>

            <form onSubmit={submitReport}>
              <label htmlFor="title">Problem title</label>
              <input
                id="title"
                name="title"
                value={form.title}
                onChange={handleInput}
                placeholder="Example: Printer is not working"
                maxLength={100}
                disabled={submitting}
                required
              />

              <label htmlFor="location">Location</label>
              <input
                id="location"
                name="location"
                value={form.location}
                onChange={handleInput}
                placeholder="Example: Office, room 02"
                maxLength={150}
                disabled={submitting}
                required
              />

              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={handleInput}
                placeholder="Explain what happened..."
                rows={5}
                maxLength={2000}
                disabled={submitting}
                required
              />

              <button
                type="submit"
                disabled={submitting || unavailable}
              >
                {submitting ? "Saving..." : "Submit report"}
              </button>
            </form>
          </section>

          <section className="reports-section">
            <h2>Repair reports</h2>

            <div className="toolbar">
              <input
                aria-label="Search reports"
                placeholder="Search reports or locations..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />

              <select
                aria-label="Filter by status"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              >
                <option value="All">All statuses</option>

                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="report-list">
              {loading && <p role="status">Loading reports...</p>}

              {!unavailable && visibleReports.length === 0 && (
                <div className="panel">
                  {reports.length === 0
                    ? "No reports yet. Submit your first report."
                    : "No reports match your search."}
                </div>
              )}

              {visibleReports.map((report) => (
                <ReportCard
                  key={report._id}
                  report={report}
                  onSaved={handleSaved}
                  onError={handleUpdateError}
                />
              ))}
            </div>
          </section>
        </div>
      </main>

      <footer>
        FixTrack — a maintenance tracking portfolio project
      </footer>
    </div>
  );
}