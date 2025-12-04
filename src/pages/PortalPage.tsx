import { useNavigate } from 'react-router-dom';

export default function PortalPage() {
  const navigate = useNavigate();

  return (
    <div className="admin-page">
      <div className="override-back-container">
        <button
          className="btn-back"
          onClick={() => navigate('/admin')}
          title="Back to Admin"
        >
          ← Back
        </button>
      </div>

      <div className="override-header">
        <h2>Kwiksilver Portal</h2>
        <p className="override-description">
          Announcement, training, and helpful links will be posted here.
        </p>
        <p className="override-subdescription">
          Use this space to share updates with staff and keep important resources in one place.
        </p>
      </div>

      <div className="override-controls">
        <div className="control-card">
          <div className="control-card-header">
            <h4 className="control-card-title">Quick notes</h4>
          </div>
          <div className="control-card-description">
            <p>
              Review quick notes for daily reminders, trainings, instructions, or important
              information for the team.
            </p>
          </div>
          <div className="control-card-actions">
            <button
              className="btn-control-primary"
              onClick={() => navigate('/portal/quick-notes')}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <span>Quick notes</span>
            </button>
          </div>
        </div>

        <div className="control-card">
          <div className="control-card-header">
            <h4 className="control-card-title">Kwiksilver Temporary Payslip</h4>
          </div>
          <div className="control-card-description">
            <p>
              Temporary payslip information and links can be shared here for staff reference while
              the full payslip portal is being set up.
            </p>
          </div>
          <div className="control-card-actions">
            <button
              className="btn-control-secondary"
              onClick={() => navigate('/portal/temporary-payslip')}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 4h16v14H4z" />
                <path d="M4 9h16" />
                <path d="M8 13h4" />
              </svg>
              <span>Open temporary payslip</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


