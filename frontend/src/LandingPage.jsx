import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import API_BASE from './apiBase';

function LandingPage() {
  const [status, setStatus] = useState('');
  const [deploymentStatus, setDeploymentStatus] = useState(null);
  const [deploymentStatusError, setDeploymentStatusError] = useState('');
  const [loadingDeploymentStatus, setLoadingDeploymentStatus] = useState(false);
  const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  const linkStyle = {
    display: 'block',
    padding: '1rem 1.25rem',
    borderRadius: 10,
    border: '1px solid #d0d0d0',
    background: '#f8fbff',
    textDecoration: 'none',
    color: '#123',
    fontWeight: 600,
    marginBottom: 12,
  };

  const handleMarkClean = async () => {
    setStatus('Markerer som ren...');
    try {
      const res = await fetch(`${API_BASE}/admin/mark-clean`, { method: 'POST' });
      if (!res.ok) throw new Error('Kun tilgjengelig på vertsmaskin');
      setStatus('Databasen er markert som ren.');
      await fetchDeploymentStatus();
    } catch {
      setStatus('Kun tilgjengelig fra localhost på vertsmaskin.');
    }
  };

  const fetchDeploymentStatus = async () => {
    setLoadingDeploymentStatus(true);
    setDeploymentStatusError('');
    try {
      const res = await fetch(`${API_BASE}/admin/deployment-status`);
      if (!res.ok) throw new Error('Kunne ikke hente deployment-status');
      const data = await res.json();
      setDeploymentStatus(data);
    } catch {
      setDeploymentStatusError('Klarte ikke hente deployment-status fra backend.');
    } finally {
      setLoadingDeploymentStatus(false);
    }
  };

  useEffect(() => {
    fetchDeploymentStatus();
  }, []);

  return (
    <div style={{ maxWidth: 720, margin: '2rem auto', padding: '2rem', border: '1px solid #ccc', borderRadius: 10 }}>
      <h1 style={{ marginTop: 0 }}>Lærerportal</h1>
      <p style={{ marginTop: 0, color: '#444' }}>Verktøy for registrering og administrasjon:</p>

      <Link to="/secretTeacherPortal273892/edit-table" style={linkStyle}>Registreringstabell (hovedinput)</Link>
      <Link to="/secretTeacherPortal273892/class-logos" style={linkStyle}>Klassebilder (last opp / oppdater)</Link>
      <Link to="/results" style={linkStyle}>Resultater (visning)</Link>
      <Link to="/secretTeacherPortal273892/survey" style={linkStyle}>Daglig registrering (enkelt skjema)</Link>

      <div style={{ marginTop: 18, padding: '1rem 1.25rem', border: '1px solid #d0d0d0', borderRadius: 10, background: '#f8fbff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h3 style={{ margin: 0, color: '#123' }}>Deployment-status</h3>
          <button onClick={fetchDeploymentStatus} disabled={loadingDeploymentStatus}>
            {loadingDeploymentStatus ? 'Henter...' : 'Oppdater'}
          </button>
        </div>

        {deploymentStatusError && <div style={{ marginTop: 8, color: '#a13a3a' }}>{deploymentStatusError}</div>}

        {!deploymentStatusError && deploymentStatus && (
          <div style={{ marginTop: 10, color: '#223', lineHeight: 1.6 }}>
            <div>Modus: <strong>{deploymentStatus.app_mode}</strong></div>
            <div>Simulering aktiv: <strong>{deploymentStatus.simulation_enabled ? 'Ja' : 'Nei'}</strong></div>
            <div>
              Kampanje-DB ren:{' '}
              <strong style={{ color: deploymentStatus.campaign_db_clean ? '#1b7a2a' : '#a13a3a' }}>
                {deploymentStatus.campaign_db_clean ? 'Ja' : 'Nei'}
              </strong>
            </div>
            <div>survey_results rader: <strong>{deploymentStatus.survey_results_rows}</strong></div>
            <div>cell_edit_audit rader: <strong>{deploymentStatus.cell_edit_audit_rows}</strong></div>
          </div>
        )}
      </div>

      {isLocalHost && (
        <div style={{ marginTop: 18 }}>
          <button onClick={handleMarkClean}>Marker database clean (localhost)</button>
          {status && <div style={{ marginTop: 8, color: '#444' }}>{status}</div>}
        </div>
      )}
    </div>
  );
}

export default LandingPage;
