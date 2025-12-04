import { useNavigate } from 'react-router-dom';

export default function TemporaryPayslipPage() {
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
        <h2>Kwiksilver Temporary Payslip</h2>
        <p className="override-description">
          This page will be used to share temporary payslip information and links for employees.
        </p>
        <p className="override-subdescription">
          You can later add embeds, documents, or links to the official payslip system here.
        </p>
      </div>

      <div className="override-controls">
        <div className="control-card">
          <div className="control-card-description">
            <p>
              The content below is loaded from the Kwiksilver Temporary Payslip space in Notion so
              you can update details there and see them here automatically.
            </p>
          </div>
          <div className="control-card-actions">
            <div style={{ width: '100%' }}>
              <iframe
                src="https://nova-cover-2af.notion.site/ebd/2bf97f877daa806b8e9ee30a8788fe87"
                width="100%"
                height={600}
                frameBorder={0}
                allowFullScreen
                title="Kwiksilver Temporary Payslip"
                style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'transparent' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


