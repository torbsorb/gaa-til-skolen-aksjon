import { useState, useEffect } from 'react';
import API_BASE from './apiBase';


function EditableTablePage() {
  const [classes, setClasses] = useState([]);
  const [tableData, setTableData] = useState({}); // { class_id: { day: walked_count } }
  const [editCounts, setEditCounts] = useState({}); // { class_id: { day: edit_count } }
  const [status, setStatus] = useState('');
  const [baseDate, setBaseDate] = useState(null);
  const [cleanStatus, setCleanStatus] = useState('');
  const [simulatedDay, setSimulatedDay] = useState(5);
  const days = Array.from({ length: 10 }, (_, i) => i + 1);
  const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  useEffect(() => {
    // Fetch classes
    fetch(`${API_BASE}/classes`)
      .then(res => {
        if (!res.ok) throw new Error('Feil ved henting av klasser');
        return res.json();
      })
      .then(data => setClasses(Array.isArray(data) ? data : []))
      .catch(() => setClasses([]));

    // Fetch all survey results and base date
    fetch(`${API_BASE}/results-table`)
      .then(res => {
        if (!res.ok) throw new Error('Feil ved henting av tabell');
        return res.json();
      })
      .then(data => {
        setTableData(data && typeof data.table === 'object' ? data.table : {});
        setEditCounts(data && typeof data.edit_counts === 'object' ? data.edit_counts : {});
        if (data.base_date) setBaseDate(data.base_date);
      })
      .catch(() => {
        setTableData({});
        setEditCounts({});
        setBaseDate(null);
      });
  }, []);

  const handleChange = (classId, day, value, totalStudents) => {
    // Allow empty while editing, otherwise keep only integer input.
    if (!/^\d*$/.test(value)) {
      return;
    }

    let normalizedValue = value;
    if (value !== '') {
      const intValue = Number.parseInt(value, 10);
      const clampedValue = Math.max(0, Math.min(intValue, totalStudents));
      normalizedValue = clampedValue;
    }

    setTableData(prev => ({
      ...prev,
      [classId]: {
        ...prev[classId],
        [day]: normalizedValue
      }
    }));
    // Auto-save to backend
    fetch(`${API_BASE}/survey`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ class_id: classId, day, walked_count: normalizedValue === '' ? 0 : normalizedValue })
    })
      .then(res => {
        if (!res.ok) throw new Error('Lagring feilet');
        return res.json();
      })
      .then((data) => {
        setStatus('Lagret!');
        if (typeof data.edit_count === 'number') {
          setEditCounts(prev => ({
            ...prev,
            [classId]: {
              ...(prev[classId] || {}),
              [day]: data.edit_count
            }
          }));
        }
      })
      .catch(() => setStatus('Lagring feilet'));
  };

  const getCellBackground = (classId, day) => {
    const count = Number(editCounts[classId]?.[day] || 0);
    if (count > 5) return '#ffb3b3';
    if (count > 3) return '#fff2a8';
    return 'white';
  };

  const handleMarkClean = async () => {
    setCleanStatus('Markerer som ren...');
    try {
      const res = await fetch(`${API_BASE}/admin/mark-clean`, { method: 'POST' });
      if (!res.ok) throw new Error('Kun localhost');
      setEditCounts({});
      setCleanStatus('Databasen er markert som ren.');
    } catch {
      setCleanStatus('Kun tilgjengelig fra localhost på vertsmaskin.');
    }
  };

  // Helper to get date string for each column
  const getDateForDay = (day) => {
    if (!baseDate) return `Dag ${day}`;
    const d = new Date(baseDate);
    d.setDate(d.getDate() + (day - 1));
    return d.toISOString().split('T')[0];
  };

  const getWeekdayForDay = (day) => {
    if (!baseDate) return `Dag ${day}`;
    const d = new Date(baseDate);
    d.setDate(d.getDate() + (day - 1));
    const weekday = d.toLocaleDateString('nb-NO', { weekday: 'long' });
    return weekday.charAt(0).toUpperCase() + weekday.slice(1);
  };

  const currentCompetitionDay = simulatedDay;

  const getColumnBackground = (day) => {
    if (day === currentCompetitionDay) return '#dbeafe';
    if (day < currentCompetitionDay) return '#e8edf3';
    return '#e2e8f0';
  };

  return (
    <div style={{ maxWidth: 900, margin: '2rem auto', padding: '2rem', border: '1px solid #ccc', borderRadius: 8, color: '#111', background: '#f9f9ff' }}>
      <h2>Redigerbare dagsresultater</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <label style={{ fontWeight: 600 }}>
          Simuler konkurransedag:
          <span style={{ marginLeft: 8, color: '#1976d2' }}>Dag {simulatedDay}</span>
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 280 }}>
          <span style={{ fontSize: 12, color: '#666' }}>1</span>
          <input
            type="range"
            min="1"
            max="10"
            step="1"
            value={simulatedDay}
            onChange={(e) => setSimulatedDay(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: 12, color: '#666' }}>10</span>
        </div>
      </div>
      <div style={{ marginBottom: 10, color: '#333' }}>
        Aktiv dag: <strong>Dag {currentCompetitionDay}</strong>.
        Tidligere dager kan endres, fremtidige dager er låst.
      </div>
      {isLocalHost && (
        <div style={{ marginBottom: 10 }}>
          <button onClick={handleMarkClean}>Marker database clean (localhost)</button>
          {cleanStatus && <div style={{ marginTop: 6, color: '#222' }}>{cleanStatus}</div>}
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', color: '#111' }}>
        <thead>
          <tr>
            <th style={{ color: '#111' }}>Klasse</th>
            {days.map(day => (
              <th key={day} style={{ background: getColumnBackground(day) }}>
                <div style={{ color: '#111' }}>{getWeekdayForDay(day)}</div>
                <div style={{ fontSize: 12, fontWeight: 400, color: '#111' }}>{getDateForDay(day)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {classes.map(cls => (
            <tr key={cls.id}>
              <td style={{ whiteSpace: 'nowrap', color: '#111' }}>{cls.name} ({cls.total_students})</td>
              {days.map(day => (
                <td key={day} style={{ background: getColumnBackground(day) }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={tableData[cls.id]?.[day] || ''}
                    disabled={day > currentCompetitionDay}
                    onChange={e => handleChange(cls.id, day, e.target.value, cls.total_students)}
                    style={{
                      width: 60,
                      background: day > currentCompetitionDay ? '#cbd5e1' : getCellBackground(cls.id, day),
                      color: '#111',
                      border: '1px solid #bbb',
                      opacity: day > currentCompetitionDay ? 0.75 : 1,
                      cursor: day > currentCompetitionDay ? 'not-allowed' : 'text'
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: '1rem', color: status.includes('feilet') ? '#b00020' : '#1b5e20' }}>{status}</div>
    </div>
  );
}

export default EditableTablePage;
