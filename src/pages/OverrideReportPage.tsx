import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCustomers } from '../services/sheetsService';
import { CustomerRecord } from '../types';

interface SummaryCounts {
  doneToday: number;
  claimedToday: number;
}

function toLocalYmd(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeDateString(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const directDate = new Date(trimmed);
  if (!Number.isNaN(directDate.getTime())) {
    return toLocalYmd(directDate);
  }

  const [firstPart] = trimmed.split(' ');
  if (firstPart) {
    const fallback = new Date(firstPart);
    if (!Number.isNaN(fallback.getTime())) {
      return toLocalYmd(fallback);
    }
  }

  return null;
}

function formatTime(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const [datePart, timePart, meridiem] = value.split(' ');
  if (timePart) {
    return meridiem ? `${timePart} ${meridiem}` : timePart;
  }
  return '—';
}

export default function OverrideReportPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchCustomers();
        if (active) {
          setRecords(data);
          setError(null);
        }
      } catch (err) {
        console.error('Error loading report data:', err);
        if (active) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      active = false;
    };
  }, []);

  const todayYmd = useMemo(() => toLocalYmd(new Date()), []);

  const summary = useMemo<SummaryCounts>(() => {
    let doneToday = 0;
    let claimedToday = 0;

    records.forEach((record) => {
      const doneDate = normalizeDateString(record.dateDone);
      const claimedDate = normalizeDateString(record.datePaid);

      if (doneDate === todayYmd) {
        doneToday += 1;
      }
      if (claimedDate === todayYmd) {
        claimedToday += 1;
      }
    });

    return { doneToday, claimedToday };
  }, [records, todayYmd]);

  const doneTodayRecords = useMemo(
    () =>
      records.filter(
        (record) => normalizeDateString(record.dateDone) === todayYmd
      ),
    [records, todayYmd]
  );

  const claimedTodayRecords = useMemo(
    () =>
      records.filter(
        (record) => normalizeDateString(record.datePaid) === todayYmd
      ),
    [records, todayYmd]
  );

  const formattedToday = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, []);

  return (
    <div className="report-page">
      <div className="report-header">
        <button
          type="button"
          className="btn-back"
          onClick={() => navigate('/override')}
        >
          ← Back to Override Controls
        </button>
        <h2>Daily Report</h2>
        <p className="report-subtitle">
          Summary for {formattedToday}. Counts reflect records stored in
          Firestore.
        </p>
      </div>

      {loading ? (
        <div className="report-loading">
          <div className="spinner-large" />
          <span>Loading summary...</span>
        </div>
      ) : error ? (
        <div className="report-error">
          <p>Unable to load report data.</p>
          <p className="report-error-details">{error}</p>
          <button
            type="button"
            className="btn-control-primary"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="report-metrics">
            <div className="report-metric-card">
              <h3>Marked Done Today</h3>
              <div className="report-metric-value">{summary.doneToday}</div>
              <p className="report-metric-caption">
                Total customers moved to Done status today.
              </p>
            </div>
            <div className="report-metric-card">
              <h3>Claimed &amp; Paid Today</h3>
              <div className="report-metric-value">{summary.claimedToday}</div>
              <p className="report-metric-caption">
                Total customers marked Claimed &amp; Paid today.
              </p>
            </div>
          </div>

          <div className="report-sections">
            <div className="report-section">
              <div className="report-section-header">
                <h4>Done Today</h4>
                <span>{doneTodayRecords.length} record(s)</span>
              </div>
              {doneTodayRecords.length === 0 ? (
                <p className="report-empty">No customers were marked done today.</p>
              ) : (
                <ul className="report-list">
                  {doneTodayRecords.map((record) => (
                    <li key={`done-${record.id}`}>
                      <div className="report-list-name">
                        {record.customerName || 'Unnamed Customer'}
                      </div>
                      <div className="report-list-time">Done at {formatTime(record.dateDoneTime || record.dateDone)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="report-section">
              <div className="report-section-header">
                <h4>Claimed &amp; Paid Today</h4>
                <span>{claimedTodayRecords.length} record(s)</span>
              </div>
              {claimedTodayRecords.length === 0 ? (
                <p className="report-empty">
                  No customers were marked claimed &amp; paid today.
                </p>
              ) : (
                <ul className="report-list">
                  {claimedTodayRecords.map((record) => (
                    <li key={`claimed-${record.id}`}>
                      <div className="report-list-name">
                        {record.customerName || 'Unnamed Customer'}
                      </div>
                      <div className="report-list-time">Claimed at {formatTime(record.datePaidTime || record.datePaid)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}


