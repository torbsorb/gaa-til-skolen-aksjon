import { Link } from 'react-router-dom';
import { useState } from 'react';
import API_BASE from './apiBase';

function LandingPage() {
  const [status, setStatus] = useState('');
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
    } catch {
      setStatus('Kun tilgjengelig fra localhost på vertsmaskin.');
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: '2rem auto', padding: '2rem', border: '1px solid #ccc', borderRadius: 10 }}>
      <h1 style={{ marginTop: 0 }}>Lærerportal</h1>
      <p style={{ marginTop: 0, color: '#444' }}>Verktøy for registrering og administrasjon:</p>

      <Link to="/secretTeacherPortal273892/edit-table" style={linkStyle}>Registreringstabell (hovedinput)</Link>
      <Link to="/results" style={linkStyle}>Resultater (visning)</Link>
      <Link to="/secretTeacherPortal273892/survey" style={linkStyle}>Daglig registrering (enkelt skjema)</Link>

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
