import { useEffect, useMemo, useState } from 'react';
import SearchBar from '../components/SearchBar';
import StatusBadge from '../components/StatusBadge';
import { CustomerRecord, getStatusText } from '../types';
import { fetchCustomers } from '../services/sheetsService';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [typing, setTyping] = useState(false);
  const [data, setData] = useState<CustomerRecord[] | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    fetchCustomers().then(setData);
  }, []);

  const results = useMemo(() => {
    if (!data) return [] as CustomerRecord[];
    const q = query.trim().toLowerCase();
    if (!q) return [] as CustomerRecord[];
    return data.filter((r) =>
      [r.customerName, getStatusText(r.status), r.dateDropped, String(r.totalWeightKg)]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [data, query]);

  return (
    <div className="search-page">
      <div className="heading-with-tooltip">
        <h1>Check your laundry status</h1>
        <button
          className="tooltip-trigger"
          onClick={() => setShowTooltip(!showTooltip)}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          aria-label="Contact information"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          {showTooltip && (
            <div className="tooltip-content">
              <p>For inquiries contact 09062881958</p>
            </div>
          )}
        </button>
      </div>
      <SearchBar value={query} onChange={setQuery} onTyping={setTyping} />
      <div className="results">
        {typing && query && <div className="muted">Searching...</div>}
        {!typing && query && results.length === 0 && (
          <div className="muted">No results found</div>
        )}
        {!typing && results.map((r) => {
          // Extract just the date part (before the space if time exists)
          const dateOnly = r.dateDropped.split(' ')[0];
          return (
            <div className="result-row" key={r.id}>
              <div className="result-header">
                <div className="result-name">{r.customerName}</div>
                <StatusBadge status={r.status} />
              </div>
              <div className="result-meta">
                <span className="result-date">Dropped Date: {dateOnly}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


