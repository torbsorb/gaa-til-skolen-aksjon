import { useState, useEffect } from 'react';


function EditableTablePage() {
  const [classes, setClasses] = useState([]);
  const [tableData, setTableData] = useState({}); // { class_id: { day: walked_count } }
  const [status, setStatus] = useState('');
  const [baseDate, setBaseDate] = useState(null);
  const days = Array.from({ length: 10 }, (_, i) => i + 1);

  useEffect(() => {
    // Fetch classes
    fetch('http://localhost:8000/classes')
      .then(res => res.json())
      .then(data => setClasses(data));
    // Fetch all survey results and base date
    fetch('http://localhost:8000/results-table')
      .then(res => res.json())
      .then(data => {
        setTableData(data.table || data); // fallback for old API
        if (data.base_date) setBaseDate(data.base_date);
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
    fetch('http://localhost:8000/survey', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ class_id: classId, day, walked_count: normalizedValue === '' ? 0 : normalizedValue })
    })
      .then(res => {
        if (!res.ok) throw new Error('Lagring feilet');
        return res.json();
      })
      .then(() => setStatus('Lagret!'))
      .catch(() => setStatus('Lagring feilet'));
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

  return (
    <div style={{ maxWidth: 900, margin: '2rem auto', padding: '2rem', border: '1px solid #ccc', borderRadius: 8 }}>
      <h2>Redigerbare dagsresultater</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Klasse</th>
            {days.map(day => (
              <th key={day}>
                <div>{getWeekdayForDay(day)}</div>
                <div style={{ fontSize: 12, fontWeight: 400 }}>{getDateForDay(day)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {classes.map(cls => (
            <tr key={cls.id}>
              <td style={{ whiteSpace: 'nowrap' }}>{cls.name} ({cls.total_students})</td>
              {days.map(day => (
                <td key={day}>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={tableData[cls.id]?.[day] || ''}
                    onChange={e => handleChange(cls.id, day, e.target.value, cls.total_students)}
                    style={{ width: 60 }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: '1rem', color: 'green' }}>{status}</div>
    </div>
  );
}

export default EditableTablePage;
