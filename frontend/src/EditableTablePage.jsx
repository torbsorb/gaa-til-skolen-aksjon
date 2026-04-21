import { useState, useEffect } from 'react';
import API_BASE from './apiBase';
import ClassLogo from './ClassLogo';


function EditableTablePage() {
  const sortClassesAlphabetically = (classList) => (
    [...classList].sort((a, b) => {
      const left = typeof a?.name === 'string' ? a.name : '';
      const right = typeof b?.name === 'string' ? b.name : '';
      return left.localeCompare(right, 'nb', { numeric: true, sensitivity: 'base' });
    })
  );

  const [classes, setClasses] = useState([]);
  const [tableData, setTableData] = useState({}); // { class_id: { day: walked_count } }
  const [editCounts, setEditCounts] = useState({}); // { class_id: { day: edit_count } }
  const [status, setStatus] = useState('');
  const [baseDate, setBaseDate] = useState(null);
  const [cleanStatus, setCleanStatus] = useState('');
  const [reseedStatus, setReseedStatus] = useState('');
  const [simulatedDay, setSimulatedDay] = useState(5);
  const [simulationEnabled, setSimulationEnabled] = useState(true);
  const days = Array.from({ length: 10 }, (_, i) => i + 1);
  const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const campaignStartDate = new Date('2026-04-13T12:00:00');

  const getWorkingDateForDay = (day) => {
    const workingDate = new Date(campaignStartDate);
    let remainingDays = day - 1;

    while (remainingDays > 0) {
      workingDate.setDate(workingDate.getDate() + 1);
      if (workingDate.getDay() !== 0 && workingDate.getDay() !== 6) {
        remainingDays -= 1;
      }
    }

    return workingDate;
  };

  const formatDisplayDate = (dateValue) => (
    dateValue.toLocaleDateString('sv-SE')
  );

  const getLiveCompetitionDay = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);

    if (today < campaignStartDate) {
      return 1;
    }

    let workingDay = 0;
    const cursor = new Date(campaignStartDate);

    while (cursor <= today && workingDay < 10) {
      if (cursor.getDay() !== 0 && cursor.getDay() !== 6) {
        workingDay += 1;
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return Math.max(1, Math.min(10, workingDay));
  };

  const currentCompetitionDay = simulationEnabled ? simulatedDay : getLiveCompetitionDay();

  useEffect(() => {
    // Fetch classes
    fetch(`${API_BASE}/classes`)
      .then(res => {
        if (!res.ok) throw new Error('Feil ved henting av klasser');
        return res.json();
      })
      .then(data => {
        const safeData = Array.isArray(data) ? data : [];
        setClasses(sortClassesAlphabetically(safeData));
      })
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

    fetch(`${API_BASE}/app-config`)
      .then(res => {
        if (!res.ok) throw new Error('Ingen app-config');
        return res.json();
      })
      .then(data => {
        setSimulationEnabled(Boolean(data.simulation_enabled));
      })
      .catch(() => {
        // Keep preview defaults if endpoint is unavailable.
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

  const handleReseedPreview = async () => {
    setReseedStatus('Gjenoppretter...');
    try {
      const res = await fetch(`${API_BASE}/admin/reset-preview-data`, { method: 'POST' });
      if (!res.ok) throw new Error('Feilet');
      // Reload data
      const tableRes = await fetch(`${API_BASE}/results-table`);
      const tableJson = await tableRes.json();
      setTableData(tableJson?.table || {});
      setEditCounts(tableJson?.edit_counts || {});
      if (tableJson?.base_date) setBaseDate(tableJson.base_date);
      setReseedStatus('Simulerte data er gjenopprettet!');
    } catch {
      setReseedStatus('Feilet – er APP_MODE=preview?');
    }
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

  // Helper to get the real campaign date for each working day column
  const getDateForDay = (day) => formatDisplayDate(getWorkingDateForDay(day));

  const getWeekdayForDay = (day) => {
    const dateForDay = getWorkingDateForDay(day);
    const weekday = dateForDay.toLocaleDateString('nb-NO', { weekday: 'long' });
    return weekday.charAt(0).toUpperCase() + weekday.slice(1);
  };

  const getColumnBackground = (day) => {
    if (day === currentCompetitionDay) return '#dbeafe';
    if (day < currentCompetitionDay) return '#e8edf3';
    return '#e2e8f0';
  };

  // Same height for all data rows so uke 2 (without klasse-kolonne) matches uke 1 with logo.
  const DATA_ROW_HEIGHT_PX = 48;

  const renderTable = (weekDays, weekLabel, showClassColumn = false) => (
    <div style={{ flex: showClassColumn ? '0 0 auto' : 1, minWidth: 0 }}>
      <h3 style={{ marginTop: 0, color: '#111' }}>{weekLabel}</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', color: '#111' }}>
        <thead>
          <tr>
            {showClassColumn && <th style={{ color: '#111', verticalAlign: 'bottom' }}>Klasse</th>}
            {weekDays.map(day => (
              <th key={day} style={{ background: getColumnBackground(day) }}>
                <div style={{ color: '#111' }}>{getWeekdayForDay(day)}</div>
                <div style={{ fontSize: 12, fontWeight: 400, color: '#111' }}>{getDateForDay(day)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {classes.map(cls => (
            <tr key={cls.id} style={{ height: DATA_ROW_HEIGHT_PX }}>
              {showClassColumn && (
                <td style={{ whiteSpace: 'nowrap', color: '#111', paddingRight: 12, verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 34 }}>
                    <ClassLogo className={cls.name} size={34} />
                    <span>{cls.name} ({cls.total_students})</span>
                  </div>
                </td>
              )}
              {weekDays.map(day => (
                <td
                  key={day}
                  style={{
                    background: getColumnBackground(day),
                    verticalAlign: 'middle',
                    padding: '6px 4px',
                  }}
                >
                  <input
                    type="text"
                    inputMode="numeric"
                    value={tableData[cls.id]?.[day] || ''}
                    disabled={day > currentCompetitionDay}
                    onChange={e => handleChange(cls.id, day, e.target.value, cls.total_students)}
                    style={{
                      width: 60,
                      minHeight: 34,
                      boxSizing: 'border-box',
                      background: day > currentCompetitionDay ? '#cbd5e1' : getCellBackground(cls.id, day),
                      color: '#111',
                      border: '1px solid #bbb',
                      opacity: day > currentCompetitionDay ? 0.75 : 1,
                      cursor: day > currentCompetitionDay ? 'not-allowed' : 'text',
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={{ maxWidth: 1400, margin: '2rem auto', padding: '2rem', border: '1px solid #ccc', borderRadius: 8, color: '#111', background: '#f9f9ff' }}>
      <h2>Redigerbare dagsresultater</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        {simulationEnabled ? (
          <>
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
          </>
        ) : (
          <div style={{ fontWeight: 600 }}>
            Konkurransedag: <span style={{ marginLeft: 8, color: '#1976d2' }}>Dag {currentCompetitionDay}</span>
          </div>
        )}
      </div>
      <div style={{ marginBottom: 10, color: '#333' }}>
        Aktiv dag: <strong>Dag {currentCompetitionDay}</strong>.
        Tidligere dager kan endres, fremtidige dager er låst.
      </div>
      {simulationEnabled && (
        <div style={{ marginBottom: 10 }}>
          <button
            onClick={handleReseedPreview}
            style={{ background: '#1976d2', color: 'white', border: 'none', borderRadius: 4, padding: '6px 14px', cursor: 'pointer' }}
          >
            Gjenopprett simulerte data
          </button>
          {reseedStatus && <span style={{ marginLeft: 12, color: reseedStatus.includes('eilet') ? '#b00020' : '#1b5e20' }}>{reseedStatus}</span>}
        </div>
      )}
      {isLocalHost && (
        <div style={{ marginBottom: 10 }}>
          <button onClick={handleMarkClean}>Marker database clean (localhost)</button>
          {cleanStatus && <div style={{ marginTop: 6, color: '#222' }}>{cleanStatus}</div>}
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, overflow: 'auto', marginBottom: '1rem', alignItems: 'flex-start' }}>
        {renderTable([1, 2, 3, 4, 5], 'Uke 1 (13–17 april)', true)}
        {renderTable([6, 7, 8, 9, 10], 'Uke 2 (20–24 april)', false)}
      </div>
      <div style={{ marginTop: '1rem', color: status.includes('feilet') ? '#b00020' : '#1b5e20' }}>{status}</div>
    </div>
  );
}

export default EditableTablePage;
