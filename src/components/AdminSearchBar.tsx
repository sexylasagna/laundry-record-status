import { useState } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function AdminSearchBar({ value, onChange }: Props) {
  const [internal, setInternal] = useState(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInternal(v);
    onChange(v);
  };

  const handleClear = () => {
    setInternal('');
    onChange('');
  };

  return (
    <div className="admin-search-wrapper">
      <div className="admin-search">
        <input
          type="text"
          placeholder="Search customer name..."
          value={internal}
          onChange={handleChange}
        />
        {internal && (
          <button
            type="button"
            onClick={handleClear}
            className="admin-search-clear"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

