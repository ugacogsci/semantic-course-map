import { useState, useEffect } from 'react';
import ChatBox from './components/ChatBox';

function App() {
  const[colleges, setColleges] = useState([]);
  const [selectedCollege, setSelectedCollege] = useState('');
  
  const[terms, setTerms] = useState([]);
  const [selectedTerm, setSelectedTerm] = useState('');
  
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);

  // On load, fetch all colleges
  useEffect(() => {
    fetch('http://127.0.0.1:5000/api/colleges')
      .then(res => res.json())
      .then(data => {
        setColleges(data);
        // Try to find UGA automatically to save tim
        const uga = data.find(c => c.abbr_name.includes('UGA') || c.full_name.includes('Georgia'));
        if (uga) setSelectedCollege(uga.abbr_name);
      });
  },[]);

  // When college is selected, fetch terms
  useEffect(() => {
    if (!selectedCollege) return;
    setLoading(true);
    fetch(`http://127.0.0.1:5000/api/terms?college=${selectedCollege}`)
      .then(res => res.json())
      .then(data => { setTerms(data); setLoading(false); });
  }, [selectedCollege]);

  // 3. When term is selected, fetch subjects
  useEffect(() => {
    if (!selectedCollege || !selectedTerm) return;
    setLoading(true);
    fetch(`http://127.0.0.1:5000/api/subjects?college=${selectedCollege}&term=${selectedTerm}`)
      .then(res => res.json())
      .then(data => { setSubjects(data); setLoading(false); });
  }, [selectedCollege, selectedTerm]);

  // When subject is selected, fetch courses
  useEffect(() => {
    if (!selectedCollege || !selectedTerm || !selectedSubject) return;
    setLoading(true);
    fetch(`http://127.0.0.1:5000/api/courses?college=${selectedCollege}&term=${selectedTerm}&subject=${selectedSubject}`)
      .then(res => res.json())
      .then(data => { setCourses(data); setLoading(false); });
  }, [selectedCollege, selectedTerm, selectedSubject]);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>UGA Course Explorer</h1>
      <p>Select the dropdowns below to pull live data from the API.</p>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <select value={selectedCollege} onChange={e => setSelectedCollege(e.target.value)}>
          <option value="">1. Select College</option>
          {colleges.map((c, i) => (
            <option key={i} value={c.abbr_name}>{c.full_name}</option>
          ))}
        </select>

        <select value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)} disabled={!terms.length}>
          <option value="">2. Select Term</option>
          {terms.map((t, i) => (
            <option key={i} value={t.term_id || t.id || t}>{t.name || t}</option>
          ))}
        </select>

        <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} disabled={!subjects.length}>
          <option value="">3. Select Subject</option>
          {subjects.map((s, i) => (
            <option key={i} value={s.abbr_name || s}>{s.full_name || s}</option>
          ))}
        </select>
      </div>

      {loading && <p>Loading data...</p>}

      <div style={{ display: 'grid', gap: '1rem' }}>
        {courses.length > 0 ? (
          courses.map((course, i) => (
            <div key={i} style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 0.5rem 0' }}>{course.subject} {course.number}: {course.title || "Course"}</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#555' }}>
                {course.description || "No description provided by API."}
              </p>
            </div>
          ))
        ) : (
          !loading && selectedSubject && <p>No courses found for this subject.</p>
        )}
      </div>
      
      {/* RAG Chatbot for course recommendations */}
      <ChatBox />
    </div>
  );
}

export default App;