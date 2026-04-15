import { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import API_BASE from './apiBase';
import ClassLogo from './ClassLogo';
import { getChartSeriesStyle } from './chartSeriesColors';
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

function scoresNearlyEqual(a, b) {
  return Math.abs(a - b) < 1e-4;
}

function ResultsPage() {
  const [leaders, setLeaders] = useState([]);
  const [loadingLeaders, setLoadingLeaders] = useState(false);
  const [groupPage, setGroupPage] = useState(0);
  const [tableData, setTableData] = useState({});
  const [baseDate, setBaseDate] = useState(null);
  const [classes, setClasses] = useState([]);
  const [isWideLayout, setIsWideLayout] = useState(true);
  const [apiError, setApiError] = useState('');
  const [simulatedDay, setSimulatedDay] = useState(5);
  const [simulationEnabled, setSimulationEnabled] = useState(true);
  const days = Array.from({ length: 10 }, (_, i) => i + 1);

  const getLiveCompetitionDay = () => {
    if (!baseDate) return 1;
    const start = new Date(`${baseDate}T00:00:00`);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, Math.min(10, diffDays));
  };

  const effectiveDay = simulationEnabled ? simulatedDay : getLiveCompetitionDay();

  const fetchLeaders = async () => {
    setLoadingLeaders(true);
    setApiError('');
    try {
      const res = await fetch(`${API_BASE}/standings`);
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`GET /standings feilet (${res.status}). ${body.slice(0, 180)}`);
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        throw new Error('GET /standings returnerte ugyldig format (forventet liste).');
      }
      setLeaders(data);
    } catch (err) {
      setLeaders([]);
      const message = err instanceof Error ? err.message : 'Ukjent feil.';
      setApiError(`Klarte ikke hente resultater fra backend. ${message}`);
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

  const fetchAppConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/app-config`);
      if (!res.ok) return;
      const data = await res.json();
      setSimulationEnabled(Boolean(data.simulation_enabled));
    } catch {
      // Keep defaults for local development if config endpoint is unavailable.
    }
  };

  useEffect(() => {
    fetchLeaders();
    fetchTableData();
    fetchClasses();
    fetchAppConfig();

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
  const safeClasses = Array.isArray(classes) ? classes : [];
  const classById = Object.fromEntries(safeClasses.map((c) => [c.id, c]));

  // Recompute standings using the same simulated-day math as the graph.
  const simulatedEntries = leaders.map((entry) => {
    const classInfo = classById[entry.class_id] || {};
    const totalStudents = Number(classInfo.total_students || entry.total_students || 0);
    let walkedTotal = 0;
    for (let day = 1; day <= effectiveDay; day += 1) {
      walkedTotal += Number(tableData[entry.class_id]?.[day] || 0);
    }
    const denominator = totalStudents * effectiveDay;
    const percentWalked = denominator ? (walkedTotal / denominator) * 100 : 0;
    return {
      ...entry,
      walked_total: walkedTotal,
      total_students: totalStudents,
      percent_walked: percentWalked,
    };
  });

  const simulatedGroupedLeaders = {};
  simulatedEntries.forEach((entry) => {
    if (!simulatedGroupedLeaders[entry.group_name]) {
      simulatedGroupedLeaders[entry.group_name] = [];
    }
    simulatedGroupedLeaders[entry.group_name].push(entry);
  });

  const groupNames = Object.keys(simulatedGroupedLeaders);
  const currentGroup = groupNames.length > 0 ? groupNames[groupPage % groupNames.length] : null;
  const groupEntries = currentGroup
    ? [...(simulatedGroupedLeaders[currentGroup] || [])].sort((a, b) => b.percent_walked - a.percent_walked)
    : [];

  const scoreTiers = [];
  groupEntries.forEach((entry) => {
    const last = scoreTiers[scoreTiers.length - 1];
    if (last && scoresNearlyEqual(last.score, entry.percent_walked)) {
      last.entries.push(entry);
    } else {
      scoreTiers.push({ score: entry.percent_walked, entries: [entry] });
    }
  });
  const podiumSlices = scoreTiers.slice(0, 3);

  const podiumTiers = [
    {
      rank: 1,
      medal: '🥇',
      width: 108,
      height: 82,
      accentColor: '#edd04f',
      numberColor: '#c79c12',
    },
    {
      rank: 2,
      medal: '🥈',
      width: 96,
      height: 62,
      accentColor: '#d7d7d9',
      numberColor: '#9b9ca0',
    },
    {
      rank: 3,
      medal: '🥉',
      width: 96,
      height: 52,
      accentColor: '#e6af69',
      numberColor: '#be7b31',
    },
  ];

  // Same order as tabell/podium (sorted standings), not DB class list order
  const groupClassesOrdered = groupEntries
    .map((e) => classById[e.class_id])
    .filter(Boolean);

  // Build datasets for each class in the group
  const datasets = groupClassesOrdered.map((cls, seriesIndex) => {
    const totalStudents = Number(cls.total_students || 0);
    let cumSum = 0;
    const data = days.map(day => {
      if (day > effectiveDay) return null;
      const val = Number(tableData[cls.id]?.[day] || 0);
      cumSum += val;
      const denominator = totalStudents * day;
      return denominator ? (cumSum / denominator) * 100 : 0;
    });
    const colors = getChartSeriesStyle(seriesIndex);
    return {
      label: cls.name,
      data,
      fill: false,
      ...colors,
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
      title: { display: true, text: `Kumulativ andel som gikk - ${currentGroup || ''} (Dag ${effectiveDay})` }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Kumulativ andel (%)' },
        ticks: {
          callback: (value) => `${value}%`
        }
      },
      x: { title: { display: true, text: 'Dato' } }
    }
  };

  return (
    <div style={{ maxWidth: 1400, width: '96vw', margin: '2rem auto', padding: '1.5rem', border: '1px solid #3b3b3b', borderRadius: 8, boxSizing: 'border-box', color: '#f3f3f3', background: '#242424' }}>
      <h2>Resultater</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        {simulationEnabled ? (
          <>
            <label style={{ fontWeight: 600 }}>
              Simuler konkurransedag:
              <span style={{ marginLeft: 8, color: '#1976d2' }}>Dag {simulatedDay}</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 280 }}>
              <span style={{ fontSize: 12, color: '#cfcfcf' }}>1</span>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={simulatedDay}
                onChange={(e) => setSimulatedDay(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 12, color: '#cfcfcf' }}>10</span>
            </div>
          </>
        ) : (
          <div style={{ fontWeight: 600 }}>Konkurransedag: <span style={{ color: '#1976d2' }}>Dag {effectiveDay}</span></div>
        )}
        <div style={{ color: '#d5d5d5' }}>
          Pågått: <strong>{effectiveDay}</strong> dager • Gjenstår: <strong>{10 - effectiveDay}</strong> dager
        </div>
      </div>
      {apiError && (
        <div style={{ marginBottom: 12, color: '#b00020', fontWeight: 600 }}>{apiError}</div>
      )}
      {loadingLeaders ? (
        <div>Laster resultatliste...</div>
      ) : (
        (() => {
          if (groupNames.length === 0) return <div>Fant ingen trinn.</div>;
          return (
            <div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', justifyContent: 'center', flexDirection: isWideLayout ? 'row' : 'column', marginBottom: 16 }}>
                <div style={{ flex: '1 1 0', minWidth: 0, background: '#f9f9ff', borderRadius: 8, padding: 12, height: isWideLayout ? 320 : '52vh', maxHeight: 560, color: '#111' }}>
                  {datasets.length > 0 ? (
                    <Line data={chartData} options={chartOptions} />
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#666' }}>
                      Ingen grafdata tilgjengelig ennå.
                    </div>
                  )}
                </div>
                <div style={{ flex: isWideLayout ? '0 0 300px' : '1 1 auto' }}>
                  <div style={{ marginBottom: 16, padding: '18px 10px 10px', borderRadius: 16, background: 'linear-gradient(180deg, #f4f0e7 0%, #efe9de 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 6px 16px rgba(0,0,0,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 2, width: '100%', minHeight: 154 }}>
                      {[
                        { sliceIndex: 1, tier: podiumTiers[1] },
                        { sliceIndex: 0, tier: podiumTiers[0] },
                        { sliceIndex: 2, tier: podiumTiers[2] },
                      ].map(({ sliceIndex, tier }) => {
                        const slice = podiumSlices[sliceIndex];
                        const entries = slice?.entries || [];
                        const colWidth = Math.max(tier.width, Math.min(entries.length, 3) * 92 + (entries.length > 1 ? 16 : 0));

                        if (entries.length === 0) {
                          return (
                            <div key={`empty-${tier.rank}`} style={{ width: tier.width, height: tier.height + 52 }} />
                          );
                        }

                        return (
                          <div
                            key={`tier-${tier.rank}-${slice.score}`}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              width: colWidth,
                              maxWidth: '100%',
                            }}
                          >
                            <div
                              style={{
                                marginBottom: 18,
                                minHeight: 62,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                gap: 6,
                                textAlign: 'center',
                                width: '100%',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'row',
                                  flexWrap: 'wrap',
                                  justifyContent: 'center',
                                  alignItems: 'flex-end',
                                  gap: 8,
                                  width: '100%',
                                }}
                              >
                                {entries.map((entry) => (
                                  <div
                                    key={entry.class_id}
                                    style={{
                                      padding: '6px 10px',
                                      fontWeight: 800,
                                      fontSize: 15,
                                      lineHeight: 1.05,
                                      color: '#222',
                                      background: 'rgba(255,255,255,0.9)',
                                      borderRadius: 10,
                                      boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      gap: 6,
                                      minWidth: 0,
                                      flex: entries.length > 1 ? '1 1 88px' : '0 0 auto',
                                    }}
                                  >
                                    <ClassLogo className={entry.class_name} size={entries.length > 2 ? 32 : 38} />
                                    <span>{entry.class_name}</span>
                                  </div>
                                ))}
                              </div>
                              <div style={{ fontWeight: 800, fontSize: 13, color: '#202020' }}>
                                {entries[0].percent_walked.toFixed(1)}%
                              </div>
                            </div>
                            <div
                              style={{
                                position: 'relative',
                                width: '100%',
                                maxWidth: colWidth,
                                height: tier.height,
                                background: 'linear-gradient(135deg, #f6f6f6 0%, #ffffff 38%, #eeeeee 39%, #fbfbfb 100%)',
                                border: '1px solid #d9d9d9',
                                borderBottomColor: '#c7c7c7',
                                boxShadow: '0 8px 14px rgba(0,0,0,0.08)',
                              }}
                            >
                              <div
                                style={{
                                  position: 'absolute',
                                  top: -12,
                                  left: 8,
                                  right: 8,
                                  height: 18,
                                  background: tier.accentColor,
                                  transform: 'skewX(-24deg)',
                                }}
                              />
                              <div
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  background: 'linear-gradient(120deg, transparent 0%, transparent 38%, rgba(255,255,255,0.5) 39%, transparent 56%)',
                                }}
                              />
                              <div
                                style={{
                                  position: 'absolute',
                                  left: '50%',
                                  bottom: tier.rank === 3 ? 10 : 13,
                                  transform: 'translateX(-50%)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <div style={{ fontSize: tier.rank === 1 ? 32 : 28, lineHeight: 1 }}>{tier.medal}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ height: 1, marginTop: 0, background: 'rgba(0,0,0,0.12)' }} />
                    <div style={{ height: 20, marginTop: 8, borderRadius: '50%', background: 'radial-gradient(ellipse at center, rgba(210,210,210,0.34) 0%, rgba(210,210,210,0.12) 45%, rgba(210,210,210,0) 72%)' }} />
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', background: '#f7faff', borderRadius: 8, overflow: 'hidden', color: '#111' }}>
                    <thead>
                      <tr>
                        <th style={{ color: '#111' }}>Klasse</th>
                        <th style={{ color: '#111' }}>% som gikk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupEntries.map((entry, i) => (
                        <tr key={entry.class_id} style={i < 3 ? { fontWeight: 'bold', color: '#111' } : { color: '#111' }}>
                          <td style={{ color: '#111' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <ClassLogo className={entry.class_name} size={32} />
                              <span>{entry.class_name}</span>
                            </div>
                          </td>
                          <td style={{ color: '#111' }}>{entry.percent_walked.toFixed(1)}%</td>
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
                <button onClick={() => {
                  fetchLeaders();
                  fetchTableData();
                  fetchClasses();
                }}>
                  Oppdater resultater
                </button>
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
}

export default ResultsPage;
