
import { useState, useEffect } from 'react';


function App() {
  // Get today's date in YYYY-MM-DD format
  const todayStr = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    class_id: '',
    date: todayStr,
    walked_count: ''
  });
  const [status, setStatus] = useState('');
  const [classes, setClasses] = useState([]);
  const [classMap, setClassMap] = useState({});

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('Submitting...');
    const selectedClass = classes.find(c => c.id === parseInt(form.class_id));
    if (!selectedClass) {
      setStatus('Please select a class.');
      return;
    }
    try {
      const res = await fetch('http://localhost:8000/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_id: parseInt(form.class_id),
          date: form.date,
          walked_count: parseInt(form.walked_count),
          total_students: selectedClass.total_students || 0
        })
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('Survey submitted!');
      } else {
        setStatus(data.detail || 'Error submitting survey');
      }
    } catch (err) {
      setStatus('Network error');
    }
  };

  const [leaders, setLeaders] = useState([]);
  const [loadingLeaders, setLoadingLeaders] = useState(false);
  // Grouped leaders: { [group_name]: [entries] }
  const [groupedLeaders, setGroupedLeaders] = useState({});
  const [groupPage, setGroupPage] = useState(0);

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


  // Fetch class list and leaders on mount
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await fetch('http://localhost:8000/classes');
        const data = await res.json();
        setClasses(data);
        // Map class id to class object for quick lookup
        const cmap = {};
        data.forEach(c => { cmap[c.id] = c; });
        setClassMap(cmap);
      } catch {
        setClasses([]);
      }
    };
    fetchClasses();
    fetchLeaders();
  }, []);

  return (
    <div style={{ maxWidth: 400, margin: '2rem auto', padding: '2rem', border: '1px solid #ccc', borderRadius: 8 }}>
      <h2>Teacher Survey Form</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Class:
          <select name="class_id" value={form.class_id} onChange={handleChange} required>
            <option value="">Select class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        {form.class_id && classMap[form.class_id] && (
          <div style={{ margin: '0.5rem 0', color: '#1976d2', fontWeight: 'bold', fontSize: '1.1rem' }}>
            Total students in class: {classMap[form.class_id].total_students}
          </div>
        )}
        <br />
        <label>
          Date:
          <input type="date" name="date" value={form.date} readOnly />
        </label>
        <br />
        <label>
          Number of students who walked:
          <input type="number" name="walked_count" value={form.walked_count} onChange={handleChange} required min="0" max={classMap[form.class_id]?.total_students || undefined} />
        </label>
        <br />
        <button type="submit">Submit</button>
      </form>
      <div style={{ marginTop: '1rem', color: 'green' }}>{status}</div>

      <hr style={{ margin: '2rem 0' }} />
      <h2>Leaderboard</h2>
      {loadingLeaders ? (
        <div>Loading leaderboard...</div>
      ) : (
        (() => {
          const groupNames = Object.keys(groupedLeaders);
          if (groupNames.length === 0) return <div>No groups found.</div>;
          const currentGroup = groupNames[groupPage % groupNames.length];
          const groupEntries = groupedLeaders[currentGroup].sort((a, b) => b.percent_walked - a.percent_walked);
          return (
            <div style={{ maxWidth: 500, margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <button onClick={() => setGroupPage((p) => (p - 1 + groupNames.length) % groupNames.length)}>&lt; Prev</button>
                <div style={{ fontWeight: 'bold', fontSize: 20, margin: '0 24px', color: '#1976d2' }}>{currentGroup}</div>
                <button onClick={() => setGroupPage((p) => (p + 1) % groupNames.length)}>Next &gt;</button>
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
                    <th>Class</th>
                    <th>% Walked</th>
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
      <button style={{ marginTop: '1rem' }} onClick={fetchLeaders}>Refresh Leaderboard</button>
    </div>
  );
}

export default App;
