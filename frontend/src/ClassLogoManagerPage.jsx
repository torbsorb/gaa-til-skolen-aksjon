import { useEffect, useRef, useState } from 'react';

import API_BASE from './apiBase';
import { getClassLogo, loadRemoteClassLogos, subscribeToClassLogoUpdates } from './classLogos';

function ClassLogoManagerPage() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [uploadingClass, setUploadingClass] = useState('');
  const [, setLogoVersion] = useState(0);
  const inputRefs = useRef({});

  useEffect(() => {
    let isMounted = true;

    const fetchClasses = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/classes`);
        if (!res.ok) throw new Error('Klarte ikke hente klasser');
        const data = await res.json();
        const safe = Array.isArray(data) ? data : [];
        safe.sort((a, b) => a.name.localeCompare(b.name, 'nb'));
        if (isMounted) {
          setClasses(safe);
        }
      } catch {
        if (isMounted) {
          setStatus('Klarte ikke hente klasser fra backend.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchClasses();
    loadRemoteClassLogos();

    const unsubscribe = subscribeToClassLogoUpdates(() => {
      setLogoVersion((prev) => prev + 1);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const openPicker = (className) => {
    const input = inputRefs.current[className];
    if (input) {
      input.click();
    }
  };

  const handleFileSelected = async (className, file) => {
    if (!file) return;

    setUploadingClass(className);
    setStatus(`Laster opp nytt bilde for ${className}...`);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_BASE}/admin/class-logo/${encodeURIComponent(className)}`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Opplasting feilet');
      }

      await loadRemoteClassLogos(true);
      setStatus(`Oppdatert logo for ${className}.`);
    } catch {
      setStatus(`Klarte ikke laste opp bilde for ${className}.`);
    } finally {
      setUploadingClass('');
      if (inputRefs.current[className]) {
        inputRefs.current[className].value = '';
      }
    }
  };

  const handleResetLogo = async (className) => {
    setUploadingClass(className);
    setStatus(`Tilbakestiller ${className} til standard dyrelogo...`);

    try {
      const res = await fetch(`${API_BASE}/admin/class-logo/${encodeURIComponent(className)}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Tilbakestilling feilet');
      }

      await loadRemoteClassLogos(true);
      setStatus(`${className} bruker nå standard dyrelogo.`);
    } catch {
      setStatus(`Klarte ikke tilbakestille ${className}.`);
    } finally {
      setUploadingClass('');
    }
  };

  return (
    <div style={{ maxWidth: 980, margin: '2rem auto', padding: '2rem', border: '1px solid #ccc', borderRadius: 10 }}>
      <h2 style={{ marginTop: 0 }}>Klassebilder</h2>
      <p style={{ marginTop: 0, color: '#444' }}>
        Trykk på et bilde for å laste opp et nytt. På mobil/iPad kan du ta bilde direkte med kameraet.
      </p>

      {status && (
        <div style={{ marginBottom: 12, color: status.includes('ikke') || status.includes('feilet') ? '#b00020' : '#1b5e20', fontWeight: 600 }}>
          {status}
        </div>
      )}

      {loading ? (
        <div>Laster klasser...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
          {classes.map((schoolClass) => {
            const className = schoolClass.name;
            const isUploading = uploadingClass === className;
            return (
              <div key={schoolClass.id} style={{ border: '1px solid #ddd', borderRadius: 12, padding: 12, background: '#f8fbff', textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: 18, color: '#1a2b3c', marginBottom: 8 }}>
                  {className}
                </div>
                <button
                  type="button"
                  onClick={() => openPicker(className)}
                  disabled={isUploading}
                  aria-label={`Bytt bilde for klasse ${className}`}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    cursor: isUploading ? 'wait' : 'pointer',
                  }}
                >
                  <img
                    src={getClassLogo(className)}
                    alt={`${className} logo`}
                    style={{
                      width: 86,
                      height: 86,
                      borderRadius: 16,
                      objectFit: 'contain',
                      background: '#fff',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                    }}
                  />
                </button>

                <input
                  ref={(el) => {
                    inputRefs.current[className] = el;
                  }}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={(event) => handleFileSelected(className, event.target.files?.[0])}
                />

                <div style={{ marginTop: 8, fontSize: 12, color: '#4a4a4a' }}>
                  Elever: {schoolClass.total_students}
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: '#4a4a4a' }}>
                  {isUploading ? 'Laster opp...' : 'Trykk for nytt bilde'}
                </div>
                <button
                  type="button"
                  onClick={() => handleResetLogo(className)}
                  disabled={isUploading}
                  style={{
                    marginTop: 8,
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: '1px solid #c8ced6',
                    background: '#ffffff',
                    color: '#234',
                    fontSize: 12,
                    cursor: isUploading ? 'not-allowed' : 'pointer',
                  }}
                >
                  Tilbakestill til dyr
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ClassLogoManagerPage;
