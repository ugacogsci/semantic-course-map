import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import CytoscapeComponent from "react-cytoscapejs";

// ─── Color palette per department ───────────────────────────────────────────
const DEPT_COLOR_CACHE = {};
function getDeptBase(subject) {
  const key = subject?.replace(/[^A-Z]/g, "").slice(0, 4) || "ZZZ";
  if (!DEPT_COLOR_CACHE[key]) {
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash);
    const hue = Math.abs(hash) % 360;
    DEPT_COLOR_CACHE[key] = `hsl(${hue}, 70%, 60%)`;
  }
  return DEPT_COLOR_CACHE[key];
}

// [CHANGE: DYNAMIC TEXT HIGHLIGHTING] - Added a regex helper function to dynamically wrap searched text in a glowing span inside the modal.
const highlightMatch = (text, searchStr) => {
  if (!searchStr || !text) return text;
  const words = searchStr.trim().split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return text;
  
  const regex = new RegExp(`(${words.join('|')})`, 'gi');
  const parts = text.toString().split(regex);
  
  return parts.map((part, i) => 
    regex.test(part) ? (
      <span key={i} style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', color: '#fff', padding: '0 4px', borderRadius: '4px', fontWeight: 'bold' }}>
        {part}
      </span>
    ) : part
  );
};

// ─── Cytoscape stylesheet ────────────────────────────────────────────────────
const CY_STYLE =[
  {
    selector: "node",
    style: {
      width: 18, height: 18,
      "background-color": "data(color)",
      "border-width": 1.5,
      "border-color": "rgba(255,255,255,0.2)",
      "transition-property": "width, height, background-color, border-color, opacity",
      "transition-duration": "0.15s",
      "overlay-opacity": 0,
    },
  },
  {
    selector: "node:hover",
    style: { width: 26, height: 26, "border-color": "white", "border-width": 2, "z-index": 999 },
  },
  {
    selector: "node.selected",
    style: { width: 28, height: 28, "border-color": "white", "border-width": 2.5, "background-color": "white", "z-index": 1000 },
  },
  //[CHANGE: DIMMED OPACITY] - Increased dimmed opacity from 0.05 to 0.15 so the background nodes remain slightly visible as a "galaxy" context.
  { selector: '.dimmed', style: { 'opacity': 0.15 } },
  { selector: '.highlighted', style: { 'opacity': 1, 'z-index': 10 } }
];

// ─── UI Components (Section/Divider) ────────────────────────────────────────
function Section({ label, color, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color, letterSpacing: "0.14em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>{label}</span>
      {children}
    </div>
  );
}

function Divider({ color }) {
  return <div style={{ height: 1, background: `${color}22`, margin: "20px 0" }} />;
}


// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [courses, setCourses] = useState([]);
  const[loading, setLoading] = useState(true);
  
  const[searchTerm, setSearchTerm] = useState("");
  // [CHANGE: DEBOUNCING] - Added debouncedSearch state to prevent the graph from freezing while the user is actively typing.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  //[CHANGE: TARGETED SEARCH] - Added searchField state to track the user's dropdown selection (All vs Title vs Objectives, etc.).
  const[searchField, setSearchField] = useState('all');
  
  const[selectedCourse, setSelectedCourse] = useState(null);
  // [CHANGE: MULTI-SELECT LEGEND] - Changed legend tracking to a Set() to allow multiple departments to be selected simultaneously.
  const [selectedDepartments, setSelectedDepartments] = useState(new Set());
  const[legendExpanded, setLegendExpanded] = useState(false);

  const cyRef = useRef(null);

  useEffect(() => {
    fetch('http://127.0.0.1:5000/api/all_courses')
      .then(res => res.json())
      .then(data => {
        const mappedData = data
          .filter(c => c.x !== undefined && c.y !== undefined)
          .map(c => ({
            ...c,
            // [CHANGE: SEMANTIC SEARCH / PRE-COMPUTING] - Concatenated all fields on initial load to avoid expensive string building during every search keystroke.
            searchableText: `${c.subject || ''} ${c.number || ''} ${c.title || ''} ${c.description || ''} ${c.course_objectives || ''} ${c.topical_outline || ''}`.toLowerCase(),
            //[CHANGE: TARGETED SEARCH] - Pre-computed individual fields for the targeted search dropdown.
            searchTitle: (c.title || '').toLowerCase(),
            searchSubjectNum: `${c.subject || ''} ${c.number || ''}`.toLowerCase(),
            searchDesc: (c.description || '').toLowerCase(),
            searchObj: (c.course_objectives || '').toLowerCase(),
            searchOut: (c.topical_outline || '').toLowerCase(),
          }));
        setCourses(mappedData);
        setLoading(false);
      })
      .catch(err => { console.error("Error:", err); setLoading(false); });
  },[]);

  //[CHANGE: DEBOUNCING] - 300ms delay timer intercepts rapid typing before updating the heavy graph calculations.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  //[CHANGE: MULTI-SELECT LEGEND] - Toggles department existence within the active Set().
  const toggleDepartment = (dept) => {
    setSelectedDepartments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dept)) newSet.delete(dept); else newSet.add(dept);
      return newSet;
    });
  };

  // ─── Build Cytoscape elements from course data ───────────────────────────────
  const { elements, uniqueSubjects, visibleCount } = useMemo(() => {
    const subjectsSet = new Set();
    // [CHANGE: STRICT SEARCH FIX] - Tokenizes search term by spaces so "intro arti" correctly finds "ARTI 1301: Intro to AI".
    const searchWords = debouncedSearch.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);
    // [CHANGE: UNIFIED COUNTER] - Initialized count variable to track how many nodes pass ALL filters.
    let count = 0;

    const els = courses.map((c, i) => {
      subjectsSet.add(c.subject);
      const SCALE = 800; 
      
      let matchesSearch = true;
      // [CHANGE: TARGETED SEARCH] - Switch statement routes the search logic to the specific field the user selected in the dropdown.
      if (searchWords.length > 0) {
        if (searchField === 'all') matchesSearch = searchWords.every(w => c.searchableText.includes(w));
        else if (searchField === 'title') matchesSearch = searchWords.every(w => c.searchTitle.includes(w));
        else if (searchField === 'subject') matchesSearch = searchWords.every(w => c.searchSubjectNum.includes(w));
        else if (searchField === 'description') matchesSearch = searchWords.every(w => c.searchDesc.includes(w));
        else if (searchField === 'objectives') matchesSearch = searchWords.every(w => c.searchObj.includes(w));
        else if (searchField === 'outline') matchesSearch = searchWords.every(w => c.searchOut.includes(w));
      }

      //[CHANGE: MULTI-SELECT LEGEND] - Node passes if no legend filters exist, or if its subject is in the active Set().
      const matchesLegend = selectedDepartments.size === 0 || selectedDepartments.has(c.subject);
      
      // [CHANGE: UNIFIED FILTER DIMMING] - Node is highlighted ONLY if it passes both the search AND the legend filter. 
      // Failed nodes are never deleted from the array, just given the '.dimmed' CSS class.
      const isHighlighted = matchesSearch && matchesLegend;
      
      // [CHANGE: UNIFIED COUNTER] - Increment counter only for fully visible/highlighted nodes.
      if (isHighlighted) {
        count++; 
      }
      
      return {
        data: {
          id: `course-${i}`,
          course: c,
          color: getDeptBase(c.subject),
        },
        position: { x: c.x * SCALE, y: c.y * SCALE },
        classes: isHighlighted ? 'highlighted' : 'dimmed'
      };
    });

    return { elements: els, uniqueSubjects: Array.from(subjectsSet).sort(), visibleCount: count };
  },[courses, debouncedSearch, searchField, selectedDepartments]);


  const handleCyReady = useCallback((cy) => {
    cyRef.current = cy;
    cy.on("tap", "node", (evt) => {
      const course = evt.target.data("course");
      cy.nodes().removeClass("selected");
      evt.target.addClass("selected");
      setSelectedCourse(course);
    });
    cy.on("tap", (evt) => {
      if (evt.target === cy) {
        cy.nodes().removeClass("selected");
        setSelectedCourse(null);
      }
    });
  },[]);

  //[CHANGE: COMPONENT MEMOIZATION] - Wrapped CytoscapeComponent in useMemo so React doesn't try to re-render the 14k nodes on every single search keystroke.
  const memoizedGraph = useMemo(() => (
    <CytoscapeComponent
      elements={elements}
      style={{ width: "100%", height: "100%", background: "transparent" }}
      stylesheet={CY_STYLE}
      layout={{ name: "preset" }}
      cy={handleCyReady}
      wheelSensitivity={0.3}
      // [CHANGE: ZOOM EXTENSION] - Lowered minZoom from 0.1 to 0.02 allowing the user to zoom out and view the entire mapped galaxy at once.
      minZoom={0.02}
      maxZoom={10}
    />
  ), [elements, handleCyReady]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Instrument+Serif&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #050812; overflow: hidden; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 3px; }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>

      <div style={{ width: "100vw", height: "100vh", position: "relative", background: "#050812" }}>
        
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'white', fontFamily: "'IBM Plex Mono', monospace" }}>
            Loading (14,000+ courses)...
          </div>
        ) : memoizedGraph}

        {/* Header */}
        <div style={{
          position: "absolute", top: 0, left: "140px", right: 0, zIndex: 10,
          padding: "18px 28px", background: "linear-gradient(to bottom, rgba(5,8,18,0.95) 60%, transparent)", pointerEvents: "none",
        }}>
          <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 24, fontWeight: 400, color: "white", letterSpacing: "0.01em", margin: 0 }}>
            UGA Semantic Course Map
          </h1>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", marginTop: 4, margin: 0 }}>
            {courses.length} courses · click a node to explore
          </p>
        </div>

        {/* ─── Search Bar & Field Dropdown ─────────────────────────────────── */}
        {/* [CHANGE: TARGETED SEARCH] - Wrapped Search input and Field Dropdown together in a flex container */}
        <div style={{ position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)", zIndex: 20, display: "flex", gap: 10, width: "min(90vw, 550px)" }}>
          <select 
            value={searchField} onChange={(e) => setSearchField(e.target.value)}
            style={{ padding: "10px 14px", background: "rgba(10,15,26,0.85)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "white", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", outline: "none", cursor: "pointer" }}
          >
            <option value="all">All Fields</option>
            <option value="subject">Course Code</option>
            <option value="title">Course Title</option>
            <option value="description">Description</option>
            <option value="objectives">Objectives</option>
            <option value="outline">Topical Outline</option>
          </select>

          <div style={{ position: "relative", flexGrow: 1 }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)", fontSize: 13, pointerEvents: "none" }}>⌕</span>
            <input
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search concepts, topics, or classes…"
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 36px", background: "rgba(10,15,26,0.85)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "white", fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", outline: "none" }}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 13 }}>✕</button>
            )}
          </div>
        </div>

        {/* ─── Legend ───────────────────────────────────────────────────────── */}
        {/* [CHANGE: LEGEND FIXES] - Pushed top from 24 to 100 to clear the title. Converted container to a Flexbox to allow internal scrolling while keeping headers sticky. */}
        {!loading && (
          <div style={{
            position: "absolute", top: 100, left: 24, zIndex: 20, 
            background: "rgba(10,15,26,0.85)", backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px 16px",
            display: "flex", flexDirection: "column", gap: 6, maxHeight: "calc(100vh - 140px)"
          }}>
            
            {/* [CHANGE: LEGEND FIXES] - Sticky header area containing the Expand/Collapse button so it never scrolls out of view. */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, paddingBottom: 4, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em" }}>DEPARTMENTS</span>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button onClick={() => setLegendExpanded(!legendExpanded)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer", padding: 0 }}>
                  {legendExpanded ? "Collapse ▲" : "Expand ▼"}
                </button>
                {selectedDepartments.size > 0 && (
                  <button onClick={() => setSelectedDepartments(new Set())} style={{ background: "none", border: "none", color: "#8aa8f8", fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer", padding: 0 }}>Clear</button>
                )}
              </div>
            </div>
            
            {/*[CHANGE: MULTI-SELECT LEGEND] - Scrollable list applies styling logic based on presence in the active Set(). */}
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
              {(legendExpanded ? uniqueSubjects : uniqueSubjects.slice(0, 10)).map(dept => {
                const isSelected = selectedDepartments.has(dept);
                const anySelected = selectedDepartments.size > 0;
                return (
                  <div key={dept} onClick={() => toggleDepartment(dept)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", opacity: !anySelected || isSelected ? 1 : 0.3, padding: "2px 0" }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: getDeptBase(dept), flexShrink: 0 }} />
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.75)" }}>{dept}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Node count when searching */}
        {/*[CHANGE: UNIFIED COUNTER] - Now accurately displays `visibleCount` based on the intersection of search and legend filters. */}
        {(debouncedSearch || selectedDepartments.size > 0) && (
          <div style={{
            position: "absolute", bottom: 24, right: 24, zIndex: 20,
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.4)",
            background: "rgba(10,15,26,0.85)", backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 14px",
          }}>
            {visibleCount} result{visibleCount !== 1 ? "s" : ""}
          </div>
        )}

        {/* ─── Course Modal ───────────────────────────────────────────────────── */}
        {selectedCourse && (() => {
          const color = getDeptBase(selectedCourse.subject);
          return (
            <div onClick={() => setSelectedCourse(null)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(5,8,18,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.18s ease" }}>
              <div onClick={(e) => e.stopPropagation()} style={{ width: "min(92vw, 580px)", maxHeight: "80vh", overflowY: "auto", background: "#0d1323", border: `1px solid ${color}44`, borderTop: `3px solid ${color}`, borderRadius: 14, padding: "32px 36px", position: "relative", animation: "slideUp 0.2s cubic-bezier(0.16,1,0.3,1)", boxShadow: `0 0 60px ${color}22, 0 24px 80px rgba(0,0,0,0.6)` }}>
                <button onClick={() => setSelectedCourse(null)} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
                
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: "inline-block", background: `${color}22`, border: `1px solid ${color}55`, borderRadius: 6, padding: "3px 10px", marginBottom: 12 }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color, letterSpacing: "0.08em" }}>{selectedCourse.subject} {selectedCourse.number}</span>
                  </div>
                  <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 26, color: "white", margin: 0, lineHeight: 1.2, fontWeight: 400 }}>
                    {/*[CHANGE: DYNAMIC TEXT HIGHLIGHTING] - Wrapped all rendered text strings in the highlightMatch parser. */}
                    {highlightMatch(selectedCourse.title, debouncedSearch)}
                  </h2>
                  {selectedCourse.url && (
                    <a href={selectedCourse.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: `${color}cc`, marginTop: 8, display: "block", textDecoration: "none" }}>
                      → View in UGA Bulletin
                    </a>
                  )}
                </div>

                <Divider color={color} />

                <Section label="Description" color={color}>
                  <p style={{ margin: 0, color: "rgba(255,255,255,0.75)", lineHeight: 1.7, fontSize: 14 }}>
                    {highlightMatch(selectedCourse.description || "No description available.", debouncedSearch)}
                  </p>
                </Section>

                {selectedCourse.course_objectives && (
                  <Section label="Learning Objectives" color={color}>
                    <p style={{ margin: 0, color: "rgba(255,255,255,0.75)", lineHeight: 1.7, fontSize: 14 }}>
                      {highlightMatch(selectedCourse.course_objectives, debouncedSearch)}
                    </p>
                  </Section>
                )}

                {selectedCourse.topical_outline && (
                  <Section label="Topical Outline" color={color}>
                    <p style={{ margin: 0, color: "rgba(255,255,255,0.75)", lineHeight: 1.7, fontSize: 14 }}>
                      {highlightMatch(selectedCourse.topical_outline, debouncedSearch)}
                    </p>
                  </Section>
                )}
              </div>
            </div>
          );
        })()}

      </div>
    </>
  );
}