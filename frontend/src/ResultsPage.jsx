import { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
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
  const days = Array.from({ length: 10 }, (_, i) => i + 1);

  const fetchLeaders = async () => {
    setLoadingLeaders(true);
    try {
      const res = await fetch('http://localhost:8000/standings');
      const data = await res.json();
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
    }
    setLoadingLeaders(false);
  };

  // Fetch table data for cumulative graph
  const fetchTableData = async () => {
    try {
      const res = await fetch('http://localhost:8000/results-table');
      const data = await res.json();
      setTableData(data.table || {});
      setBaseDate(data.base_date || null);
    } catch {
      setTableData({});
      setBaseDate(null);
    }
  };

  // Fetch classes for labels
  const fetchClasses = async () => {
    try {
      const res = await fetch('http://localhost:8000/classes');
      const data = await res.json();
      setClasses(data);
    } catch {
      setClasses([]);
    }
  };

  useEffect(() => {
    fetchLeaders();
    fetchTableData();
    fetchClasses();
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
  const groupClasses = classes.filter(cls => groupClassIds.includes(cls.id));

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
    <div style={{ maxWidth: 900, margin: '2rem auto', padding: '2rem', border: '1px solid #ccc', borderRadius: 8 }}>
      <h2>Resultater</h2>
      {/* Cumulative Graph for current group */}
      {currentGroup && (
        <div style={{ marginBottom: 32, background: '#f9f9ff', borderRadius: 8, padding: 16 }}>
          <Line data={chartData} options={chartOptions} height={320} />
        </div>
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
            <div style={{ maxWidth: 500, margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <button onClick={() => setGroupPage((p) => (p - 1 + groupNames.length) % groupNames.length)}>&lt; Forrige</button>
                <div style={{ fontWeight: 'bold', fontSize: 20, margin: '0 24px', color: '#1976d2' }}>{currentGroup}</div>
                <button onClick={() => setGroupPage((p) => (p + 1) % groupNames.length)}>Neste &gt;</button>
              </div>
              {/* Podium for this group */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', marginBottom: 24 }}>
                {['🥇', '🥈', '🥉'].map((emoji, idx) => {
                  const colors = ['#ffd700', '#b0bec5', '#cd7f32'];
                  const entry = groupEntries[idx];
                  if (!entry) return <div key={idx} style={{ width: 90 }} />;
                  return (
                    <div key={idx} style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      margin: '0 12px',
                      background: colors[idx],
                      borderRadius: 12,
                      padding: 8,
                      minWidth: 90,
                      minHeight: 120,
                      boxShadow: '0 2px 8px #8883'
                    }}>
                      <div style={{ fontSize: 48, marginBottom: 4 }}>{emoji}</div>
                      <div style={{ fontWeight: 'bold', fontSize: 18 }}>{entry.class_name}</div>
                      <div style={{ fontSize: 14 }}>{entry.percent_walked.toFixed(1)}%</div>
                    </div>
                  );
                })}
              </div>
              {/* Full leaderboard table for this group */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>Klasse</th>
                    <th>% som gikk</th>
                  </tr>
                </thead>
                <tbody>
                  {groupEntries.map((entry, i) => (
                    <tr key={entry.class_id} style={i < 3 ? { fontWeight: 'bold', background: '#f7faff', color: '#111' } : {}}>
                      <td>{entry.class_name}</td>
                      <td>{entry.percent_walked.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()
      )}
      <button style={{ marginTop: '1rem' }} onClick={fetchLeaders}>Oppdater resultater</button>
    </div>
  );
}

export default ResultsPage;
