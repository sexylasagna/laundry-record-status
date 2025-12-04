import { useNavigate } from 'react-router-dom';

export default function QuickNotesPage() {
  const navigate = useNavigate();

  return (
    <div className="admin-page">
      <div className="override-back-container">
        <button
          className="btn-back"
          onClick={() => navigate('/portal')}
          title="Back to Portal"
        >
          ← Back to Portal
        </button>
      </div>

      <div className="override-header">
        <h2>Quick notes</h2>
        <p className="override-description">
          View and manage quick notes for announcements, reminders, and daily instructions.
        </p>
      </div>

      <div className="override-controls">
        <div className="control-card control-card-notes">
          <div className="control-card-description">
            <p>
              The content below is loaded from the Kwiksilver Quick Notes space in Notion so you can
              update notes there and see them here automatically.
            </p>
          </div>
          <div className="control-card-actions">
            <div style={{ width: '100%' }}>
              <iframe
                src="https://nova-cover-2af.notion.site/ebd/2bf97f877daa801bbf87ce5a37e51515"
                width="100%"
                height={600}
                frameBorder={0}
                allowFullScreen
                title="Kwiksilver Quick Notes"
                style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'transparent' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


