import { Link } from 'react-router-dom';

function ArchivedPortalPage() {
  return (
    <div
      style={{
        maxWidth: 720,
        margin: '2rem auto',
        padding: '2rem',
        border: '1px solid #ccc',
        borderRadius: 10,
        background: '#f8fbff',
        color: '#1b2b3a',
      }}
    >
      <h1 style={{ marginTop: 0 }}>Lærerportal er arkivert</h1>
      <p style={{ lineHeight: 1.6 }}>
        Konkurransen er avsluttet. Registrering og administrasjon er låst, og resultatene vises nå fra en statisk
        arkivfil.
      </p>
      <p style={{ marginBottom: 0 }}>
        <Link to="/results">Gå til resultatsiden</Link>
      </p>
    </div>
  );
}

export default ArchivedPortalPage;
