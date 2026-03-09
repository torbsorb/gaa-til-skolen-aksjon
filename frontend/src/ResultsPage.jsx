import { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import API_BASE from './apiBase';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);


function ResultsPage() {
  const [leaders, setLeaders] = useState([]);
  const [loadingLeaders, setLoadingLeaders] = useState(false);
  const [groupedLeaders, setGroupedLeaders] = useState({});
  const [groupPage, setGroupPage] = useState(0);
  const [tableData, setTableData] = useState({});
  const [baseDate, setBaseDate] = useState(null);
  const [classes, setClasses] = useState([]);
  const [isWideLayout, setIsWideLayout] = useState(true);
  const [apiError, setApiError] = useState('');
  const days = Array.from({ length: 10 }, (_, i) => i + 1);

  const fetchLeaders = async () => {
    setLoadingLeaders(true);
    setApiError('');
    try {
      const res = await fetch(`${API_BASE}/standings`);
      if (!res.ok) throw new Error('Feil ved henting av resultater');
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Ugyldig svar for resultater');
      setLeaders(data);
      // Group by group_name
      const groups = {};
      data.forEach(entry => {
        if (!groups[entry.group_name]) groups[entry.group_name] = [];
        groups[entry.group_name].push(entry);
      });
      setGroupedLeaders(groups);
    } catch {
      setLeaders([]);
      setGroupedLeaders({});
      setApiError('Får ikke kontakt med backend. Sjekk at serveren kjører på nettverket.');
    }
    setLoadingLeaders(false);
  };

  // Fetch table data for cumulative graph
  const fetchTableData = async () => {
    try {
      const res = await fetch(`${API_BASE}/results-table`);
      if (!res.ok) throw new Error('Feil ved henting av tabell');
      const data = await res.json();
      setTableData(data && typeof data.table === 'object' ? data.table : {});
      setBaseDate(data.base_date || null);
    } catch {
      setTableData({});
      setBaseDate(null);
    }
  };

  // Fetch classes for labels
  const fetchClasses = async () => {
    try {
      const res = await fetch(`${API_BASE}/classes`);
      if (!res.ok) throw new Error('Feil ved henting av klasser');
      const data = await res.json();
      setClasses(Array.isArray(data) ? data : []);
    } catch {
      setClasses([]);
    }
  };

  useEffect(() => {
    fetchLeaders();
    fetchTableData();
    fetchClasses();

    const getWideLayout = () => {
      const isLandscape = window.matchMedia('(orientation: landscape)').matches;
      // iPad/Safari can keep similar effective widths across rotations,
      // so we prioritize orientation for layout choice.
      if (isLandscape) return true;
      return window.matchMedia('(min-width: 1200px)').matches;
    };
    setIsWideLayout(getWideLayout());
    const handleResize = () => setIsWideLayout(getWideLayout());
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Prepare cumulative graph data for the current group
  const getDateForDay = (day) => {
    if (!baseDate) return `Dag ${day}`;
    const d = new Date(baseDate);
    d.setDate(d.getDate() + (day - 1));
    return d.toISOString().split('T')[0];
  };

  // Group navigation logic (same as leaderboard)
  const groupNames = Object.keys(groupedLeaders);
  const currentGroup = groupNames.length > 0 ? groupNames[groupPage % groupNames.length] : null;
  // Filter classes in the current group
  const groupClassIds = currentGroup
    ? (groupedLeaders[currentGroup] || []).map(entry => entry.class_id)
    : [];
  const safeClasses = Array.isArray(classes) ? classes : [];
  const groupClasses = safeClasses.filter(cls => groupClassIds.includes(cls.id));

  // Build datasets for each class in the group
  const datasets = groupClasses.map(cls => {
    let cumSum = 0;
    const data = days.map(day => {
      const val = Number(tableData[cls.id]?.[day] || 0);
      cumSum += val;
      return cumSum;
    });
    return {
      label: cls.name,
      data,
      fill: false,
      borderColor: `hsl(${(cls.id * 47) % 360}, 70%, 50%)`,
      backgroundColor: `hsl(${(cls.id * 47) % 360}, 70%, 70%)`,
      tension: 0.2
    };
  });

  const chartData = {
    labels: days.map(getDateForDay),
    datasets
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: `Kumulativt antall som gikk - ${currentGroup || ''}` }
    },
    scales: {
      y: { beginAtZero: true, title: { display: true, text: 'Kumulativt antall som gikk' } },
      x: { title: { display: true, text: 'Dato' } }
    }
  };

  return (
    <div style={{ maxWidth: 1400, width: '96vw', margin: '2rem auto', padding: '1.5rem', border: '1px solid #ccc', borderRadius: 8, boxSizing: 'border-box' }}>
      <h2>Resultater</h2>
      {apiError && (
        <div style={{ marginBottom: 12, color: '#b00020', fontWeight: 600 }}>{apiError}</div>
      )}
      {loadingLeaders ? (
        <div>Laster resultatliste...</div>
      ) : (
        (() => {
          const groupNames = Object.keys(groupedLeaders);
          if (groupNames.length === 0) return <div>Fant ingen trinn.</div>;
          const currentGroup = groupNames[groupPage % groupNames.length];
          const groupEntries = groupedLeaders[currentGroup].sort((a, b) => b.percent_walked - a.percent_walked);
          return (
            <div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', justifyContent: 'center', flexDirection: isWideLayout ? 'row' : 'column', marginBottom: 16 }}>
                <div style={{ flex: '1 1 0', minWidth: 0, background: '#f9f9ff', borderRadius: 8, padding: 12, height: isWideLayout ? 320 : '52vh', maxHeight: 560 }}>
                  {datasets.length > 0 ? (
                    <Line data={chartData} options={chartOptions} />
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#666' }}>
                      Ingen grafdata tilgjengelig ennå.
                    </div>
                  )}
                </div>
                <div style={{ flex: isWideLayout ? '0 0 300px' : '1 1 auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', width: '100%', marginBottom: 16 }}>
                    {['🥇', '🥈', '🥉'].map((emoji, idx) => {
                      const colors = ['#ffd700', '#b0bec5', '#cd7f32'];
                      const entry = groupEntries[idx];
                      if (!entry) return <div key={idx} style={{ width: 90 }} />;
                      return (
                        <div key={idx} style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                          margin: '0 6px',
                          background: colors[idx],
                          borderRadius: 12,
                          padding: 8,
                          minWidth: 82,
                          minHeight: 120,
                          boxShadow: '0 2px 8px #8883'
                        }}>
                          <div style={{ fontSize: 42, marginBottom: 4 }}>{emoji}</div>
                          <div style={{ fontWeight: 'bold', fontSize: 16 }}>{entry.class_name}</div>
                          <div style={{ fontSize: 13 }}>{entry.percent_walked.toFixed(1)}%</div>
                        </div>
                      );
                    })}
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', background: '#f7faff', borderRadius: 8, overflow: 'hidden' }}>
                    <thead>
                      <tr>
                        <th>Klasse</th>
                        <th>% som gikk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupEntries.map((entry, i) => (
                        <tr key={entry.class_id} style={i < 3 ? { fontWeight: 'bold', color: '#111' } : {}}>
                          <td>{entry.class_name}</td>
                          <td>{entry.percent_walked.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <button onClick={() => setGroupPage((p) => (p - 1 + groupNames.length) % groupNames.length)}>&lt; Forrige</button>
                  <div style={{ fontWeight: 'bold', fontSize: 20, margin: '0 24px', color: '#1976d2' }}>{currentGroup}</div>
                  <button onClick={() => setGroupPage((p) => (p + 1) % groupNames.length)}>Neste &gt;</button>
                </div>
                <button onClick={fetchLeaders}>Oppdater resultater</button>
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
}

export default ResultsPage;
