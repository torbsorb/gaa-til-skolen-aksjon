import { useState, useEffect } from 'react';

function SurveyPage() {
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
    setStatus('Sender inn...');
    const selectedClass = classes.find(c => c.id === parseInt(form.class_id));
    if (!selectedClass) {
      setStatus('Velg en klasse.');
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
        setStatus('Skjema sendt inn!');
      } else {
        setStatus('Feil ved innsending av skjema');
      }
    } catch (err) {
      setStatus('Nettverksfeil');
    }
  };

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await fetch('http://localhost:8000/classes');
        const data = await res.json();
        setClasses(data);
        const cmap = {};
        data.forEach(c => { cmap[c.id] = c; });
        setClassMap(cmap);
      } catch {
        setClasses([]);
      }
    };
    fetchClasses();
  }, []);

  return (
    <div style={{ maxWidth: 400, margin: '2rem auto', padding: '2rem', border: '1px solid #ccc', borderRadius: 8 }}>
      <h2>Daglig registrering</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Klasse:
          <select name="class_id" value={form.class_id} onChange={handleChange} required>
            <option value="">Velg klasse</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        {form.class_id && classMap[form.class_id] && (
          <div style={{ margin: '0.5rem 0', color: '#1976d2', fontWeight: 'bold', fontSize: '1.1rem' }}>
            Antall elever i klassen: {classMap[form.class_id].total_students}
          </div>
        )}
        <br />
        <label>
          Dato:
          <input type="date" name="date" value={form.date} readOnly />
        </label>
        <br />
        <label>
            Antall elever som gikk til skolen:
          <input type="number" name="walked_count" value={form.walked_count} onChange={handleChange} required min="0" max={classMap[form.class_id]?.total_students || undefined} />
        </label>
        <br />
        <button type="submit">Send inn</button>
      </form>
      <div style={{ marginTop: '1rem', color: 'green' }}>{status}</div>
    </div>
  );
}

export default SurveyPage;
