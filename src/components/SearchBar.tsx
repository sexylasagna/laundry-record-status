import { useEffect, useMemo, useState } from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onTyping?: (typing: boolean) => void;
}

export default function SearchBar({ value, onChange, onTyping }: Props) {
  const [internal, setInternal] = useState(value);
  const [typing, setTyping] = useState(false);

  useEffect(() => setInternal(value), [value]);

  useEffect(() => {
    if (!onTyping) return;
    onTyping(typing);
  }, [typing, onTyping]);

  useEffect(() => {
    setTyping(true);
    const t = setTimeout(() => {
      onChange(internal);
      setTyping(false);
    }, 500);
    return () => clearTimeout(t);
  }, [internal]);

  const showSpinner = useMemo(() => typing && internal.length > 0, [typing, internal]);

  const handleClear = () => {
    setInternal('');
    onChange('');
  };

  return (
    <div className="searchbar-wrapper">
      <div className={`searchbar ${showSpinner ? 'loading' : ''}`}>
        <input
          type="text"
          placeholder="Search your name..."
          value={internal}
          onChange={(e) => setInternal(e.target.value)}
        />
        {showSpinner && <div className="spinner" aria-label="loading" />}
        {internal && !showSpinner && (
          <button
            type="button"
            onClick={handleClear}
            className="searchbar-clear"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}


