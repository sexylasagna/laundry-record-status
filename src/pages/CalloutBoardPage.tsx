import { useNavigate } from 'react-router-dom';

export default function CalloutBoardPage() {
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
        <h2>Callout Board</h2>
        <p className="override-description">
          View important announcements, updates, and notices on the callout board.
        </p>
      </div>

      <div className="override-controls">
        <div className="control-card control-card-notes">
          <div className="control-card-description">
            <p>
              The content below is loaded from the Kwiksilver Callout Board space in Notion so you can
              update announcements there and see them here automatically.
            </p>
          </div>
          <div className="control-card-actions">
            <div style={{ width: '100%' }}>
              <iframe
                src="https://nova-cover-2af.notion.site/ebd/2c397f877daa80a7ae39e6bf19df6bdb"
                width="100%"
                height={600}
                frameBorder={0}
                allowFullScreen
                title="Kwiksilver Callout Board"
                style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'transparent' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

