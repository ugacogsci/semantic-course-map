import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import CytoscapeComponent from "react-cytoscapejs";

// [CHANGE: CHATBOT INTEGRATION] - Imported the RAG chatbot component.
import Chatbot from "./Chatbot";

// Color palette per department 
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

// [CHANGE: THEME SYSTEM] - Centralized color variables to support dynamic light/dark mode switching.
const THEMES = {
  dark: {
    bg: "#050812",
    text: "white",
    textMuted: "rgba(255,255,255,0.4)",
    textSemi: "rgba(255,255,255,0.75)",
    panelBg: "rgba(10,15,26,0.85)",
    panelBorder: "rgba(255,255,255,0.12)",
    borderSubtle: "rgba(255,255,255,0.08)",
    borderHighlight: "rgba(255,255,255,0.6)",
    headerGradient: "linear-gradient(to bottom, rgba(1, 4, 11, 0.85) 60%, transparent)",
    modalBg: "#0d1323",
    modalOverlay: "rgba(5,8,18,0.7)",
    highlightBg: "rgba(255, 255, 255, 0.2)",
    highlightText: "#fff",
    nodeBorder: "rgba(255,255,255,0.2)",
    nodeHoverBorder: "white",
    nodeSelectedBorder: "white",
    nodeSelectedBg: "white",
    nodeTextOutline: "#050812",
    landingSelectBg: "rgba(5,8,18,0.8)",
    landingButtonBg: "white",
    landingButtonText: "#050812",
    landingButtonHover: "#e0e0e0",
    linkColor: "#8aa8f8",
    searchIcon: "rgba(255,255,255,0.3)",
    buttonHover: "rgba(255,255,255,0.1)"
  },
  light: {
    bg: "#f4f6f8",
    text: "#0d1323",
    textMuted: "rgba(0,0,0,0.5)",
    textSemi: "rgba(0,0,0,0.8)",
    panelBg: "rgba(255,255,255,0.85)",
    panelBorder: "rgba(0,0,0,0.15)",
    borderSubtle: "rgba(0,0,0,0.1)",
    borderHighlight: "rgba(0,0,0,0.6)",
    headerGradient: "linear-gradient(to bottom, rgba(225, 225, 225, 0.85) 60%, transparent)",
    modalBg: "#ffffff",
    modalOverlay: "rgba(255,255,255,0.7)",
    highlightBg: "rgba(0, 0, 0, 0.15)",
    highlightText: "#000",
    nodeBorder: "rgba(0,0,0,0.2)",
    nodeHoverBorder: "#050812",
    nodeSelectedBorder: "#050812",
    nodeSelectedBg: "#050812",
    nodeTextOutline: "#f4f6f8",
    landingSelectBg: "rgba(255,255,255,0.8)",
    landingButtonBg: "#050812",
    landingButtonText: "white",
    landingButtonHover: "#2a2f3a",
    linkColor: "#0055cc",
    searchIcon: "rgba(0,0,0,0.4)",
    buttonHover: "rgba(0,0,0,0.05)"
  }
};

//[CHANGE: CRASH PREVENTION] - Escapes special characters like '+' or '(' so searching for "C++" doesn't crash the Regex engine.
const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// [CHANGE: DYNAMIC TEXT HIGHLIGHTING] - Added a regex helper function to dynamically wrap searched text in a glowing span inside the modal.
const highlightMatch = (text, searchStr, theme) => {
  if (!searchStr || !text) return text;
  const words = searchStr.trim().split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return text;
  
  const regex = new RegExp(`(${words.map(escapeRegExp).join('|')})`, 'gi');
  const parts = String(text).split(regex);
  
  return parts.map((part, i) => 
    regex.test(part) ? (
      <span key={i} style={{ backgroundColor: theme.highlightBg, color: theme.highlightText, padding: '0 4px', borderRadius: '4px', fontWeight: 'bold' }}>
        {part}
      </span>
    ) : part
  );
};

// ─── Cytoscape stylesheet ────────────────────────────────────────────────────
//[CHANGE: THEME SYSTEM] - Converted CY_STYLE into a function so node styles update when the theme switches.
const getCyStyle = (theme) =>[
  {
    selector: "node",
    style: {
      width: 18, height: 18,
      "background-color": "data(color)",
      "border-width": 1.5,
      "border-color": theme.nodeBorder,
      "transition-property": "width, height, background-color, border-color, opacity",
      "transition-duration": "0.15s",
      "overlay-opacity": 0,
      label: "data(label)", // [CHANGE: RESTORED] - Restored the label field so hovered nodes show text.
      "font-family": "'IBM Plex Mono', monospace",
      "font-size": 0, 
      "text-outline-width": 2,
      "text-outline-color": theme.nodeTextOutline,
      color: theme.text
    },
  },
  {
    selector: "node:hover",
    style: { width: 26, height: 26, "border-color": theme.nodeHoverBorder, "border-width": 2, "font-size": 12, "z-index": 999 },
  },
  {
    selector: "node.selected",
    // [CHANGE: VISUAL FEEDBACK] - Increased selected node size (28px -> 60px) and border width so the active course clearly stands out against the cluster.
    style: { width: 60, height: 60, "border-color": theme.nodeSelectedBorder, "border-width": 8, "background-color": theme.nodeSelectedBg, "z-index": 1000 },
  },
  //[CHANGE: DIMMED OPACITY] - Increased dimmed opacity from 0.05 to 0.15 so the background nodes remain slightly visible as a "galaxy" context.
  { selector: '.dimmed', style: { 'opacity': 0.10 } },
  { 
    selector: '.highlighted', 
    // [CHANGE: SEARCH PROMINENCE] - Increased size (18->40px) and added border to highlighted nodes so search/filter results visually "pop" against the dimmed background.
    style: { 
      'opacity': 1, 
      'z-index': 10,
      'width': 40,
      'height': 40,
      'border-color': theme.borderHighlight,
      'border-width': 2
    } 
  }
];

// UI Components (Section/Divider)
function Section({ label, color, theme, children }) {
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
  // [CHANGE: THEME SYSTEM] - State to track light/dark mode toggling.
  const[isDarkMode, setIsDarkMode] = useState(true);
  const theme = isDarkMode ? THEMES.dark : THEMES.light;
  
  // [CHANGE: LANDING PAGE INTERCEPT] - Added states to hold the user on a configuration screen before mounting the heavy Cytoscape canvas.
  const [hasLaunched, setHasLaunched] = useState(false);
  const [landingUni, setLandingUni] = useState("UGA");
  const[landingTerm, setLandingTerm] = useState("all");

  const[courses, setCourses] = useState([]);
  const[loading, setLoading] = useState(true);
  
  const[searchTerm, setSearchTerm] = useState("");
  //[CHANGE: DEBOUNCING] - Added debouncedSearch state to prevent the graph from freezing while the user is actively typing.
  const[debouncedSearch, setDebouncedSearch] = useState("");
  //[CHANGE: TARGETED SEARCH] - Added searchField state to track the user's dropdown selection (All vs Title vs Objectives, etc.).
  const[searchField, setSearchField] = useState('all');
  
  const[selectedCourse, setSelectedCourse] = useState(null);
  //[CHANGE: MULTI-SELECT LEGEND] - Changed legend tracking to a Set() to allow multiple departments to be selected simultaneously.
  const [selectedDepartments, setSelectedDepartments] = useState(new Set());
  const[legendExpanded, setLegendExpanded] = useState(false);

  //[CHANGE: UNIFIED COUNTER] - Extracted to state so it can update instantly during imperative filtering.
  const[visibleCount, setVisibleCount] = useState(0);

  const cyRef = useRef(null);
  const[cyInitialized, setCyInitialized] = useState(false);

  const[mapType, setMapType] = useState('database_mapped_umap_15');

  // [CHANGE: SERVERLESS DEPLOYMENT] - Bypassing Flask API and fetching static JSON directly from the GitHub Pages public folder. 
  useEffect(() => {
    setLoading(true);
    fetch(`${import.meta.env.BASE_URL}data/${mapType}.json`)
      .then(res => res.json())
      .then(data => {
        const mappedData = data.filter(c => c.x !== undefined && c.y !== undefined).map(c => ({
          ...c,
          //[CHANGE: SEMANTIC SEARCH / PRE-COMPUTING] - Concatenated all fields on initial load to avoid expensive string building during every search keystroke.
          searchableText: `${c.subject || ''} ${c.number || ''} ${c.title || ''} ${c.description || ''} ${c.course_objectives || ''} ${c.topical_outline || ''}`.toLowerCase(),
          searchTitle: String(c.title || '').toLowerCase(),
          searchSubjectNum: `${c.subject || ''} ${c.number || ''}`.toLowerCase(),
          searchDesc: String(c.description || '').toLowerCase(),
          searchObj: String(c.course_objectives || '').toLowerCase(),
          searchOut: String(c.topical_outline || '').toLowerCase(),
        }));
        setCourses(mappedData);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching map:", err);
        setLoading(false);
      });
  }, [mapType]); 

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
  //[CHANGE: IMPERATIVE FILTERING OPTIMIZATION] - The elements array is now built ONLY ONCE when data loads. 
  // It no longer recomputes 14,000 objects during search filtering, preventing severe React rendering lag.
  const { elements, uniqueSubjects } = useMemo(() => {
    const subjectsSet = new Set();
    const els = courses.map((c, i) => {
      subjectsSet.add(c.subject);
      const SCALE = 800; 
      return {
        data: {
          id: `course-${i}`,
          course: c,
          label: `${c.subject} ${c.number}`, 
          color: getDeptBase(c.subject),
        },
        position: { x: c.x * SCALE, y: c.y * SCALE },
        classes: 'highlighted' // Default initialization
      };
    });

    return { elements: els, uniqueSubjects: Array.from(subjectsSet).sort() };
  }, [courses]);


  //[CHANGE: IMPERATIVE ENGINE] - This effect bypasses React to interact with Cytoscape directly. 
  // It computes exactly which IDs match the search/legend, and uses Cytoscape's batch() API to swap CSS classes in milliseconds.
  useEffect(() => {
    if (!cyInitialized || !cyRef.current || courses.length === 0) return;
    
    const cy = cyRef.current;
    
    //[CHANGE: STRICT SEARCH FIX] - Tokenizes search term by spaces so "intro arti" correctly finds "ARTI 1301: Intro to AI".
    const searchWords = debouncedSearch.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);
    
    const highlightedIds = new Set();
    let count = 0;

    // Pure JS loop (runs in < 10ms for 14,000 items)
    courses.forEach((c, i) => {
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
      
      //[CHANGE: UNIFIED FILTER DIMMING] - Node is highlighted ONLY if it passes both the search AND the legend filter. 
      if (matchesSearch && matchesLegend) {
        highlightedIds.add(`course-${i}`);
        // [CHANGE: UNIFIED COUNTER] - Increment counter only for fully visible/highlighted nodes.
        count++;
      }
    });

    setVisibleCount(count);

    // Apply the classes using Cytoscape's ultra-fast imperative API
    cy.startBatch();
    const allNodes = cy.nodes();
    allNodes.removeClass('highlighted dimmed'); // Reset all
    
    const highlightedEles = allNodes.filter(ele => highlightedIds.has(ele.id()));
    const dimmedEles = allNodes.difference(highlightedEles);
    
    highlightedEles.addClass('highlighted');
    dimmedEles.addClass('dimmed');
    cy.endBatch();

    //[CHANGE: AUTO-CAMERA PAN] - When a search executes, the camera smoothly flies to the active nodes so they don't get lost
    if (debouncedSearch.length > 0 || selectedDepartments.size > 0) {
      if (highlightedEles.length > 0 && highlightedEles.length < courses.length) {
        setTimeout(() => {
          if(cyRef.current) cyRef.current.animate({ fit: { eles: highlightedEles, padding: 150 } }, { duration: 600, easing: 'ease-in-out-cubic' });
        }, 50);
      }
    }
  },[debouncedSearch, searchField, selectedDepartments, courses, cyInitialized]);


  const handleCyReady = useCallback((cy) => {
    cyRef.current = cy;
    setCyInitialized(true);
    
    cy.on("tap", "node", (evt) => {
      //[CHANGE: CLICK PERFORMANCE FIX] - Optimized selection logic.
      const node = evt.target;
      const course = node.data("course");
      
      cy.startBatch();
      cy.$('.selected').removeClass("selected");
      node.addClass("selected");
      cy.endBatch();

      requestAnimationFrame(() => { setSelectedCourse(course); });
    });

    cy.on("tap", (evt) => {
      if (evt.target === cy) {
        cy.startBatch();
        cy.$('.selected').removeClass("selected");
        cy.endBatch();
        setSelectedCourse(null);
      }
    });
  },[]);

  //[CHANGE: COMPONENT MEMOIZATION] - Wrapped CytoscapeComponent in useMemo so React doesn't try to re-render the 14k nodes on every single search keystroke.
  //[CHANGE: THEME SYSTEM] - Added theme to dependency array so Cytoscape updates node colors when light/dark mode is toggled.
  const memoizedGraph = useMemo(() => (
    <CytoscapeComponent
      elements={elements}
      style={{ width: "100%", height: "100%", background: "transparent" }}
      stylesheet={getCyStyle(theme)}
      layout={{ name: "preset" }}
      cy={handleCyReady}
      wheelSensitivity={0.3}
      //[CHANGE: ZOOM EXTENSION] - Lowered minZoom from 0.1 to 0.02 allowing the user to zoom out and view the entire mapped galaxy at once.
      minZoom={0.02}
      maxZoom={10}
    />
  ), [elements, handleCyReady, theme]);


  // ─── UNIFIED RENDER ──────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Instrument+Serif&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: ${theme.bg}; overflow: hidden; color: ${theme.text}; transition: background 0.3s ease; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${theme.borderSubtle}; border-radius: 3px; }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>

      <div style={{ width: "100vw", height: "100vh", position: "relative", background: theme.bg, transition: "background 0.3s ease" }}>
        
        {/* ─── PRE-LAUNCH LANDING PAGE ─── */}
        {!hasLaunched ? (
          <>
            <div style={{ position: "absolute", top: 0, left: 0, padding: "24px 32px", zIndex: 10, display: "flex", alignItems: "center", gap: "12px" }}>
              <img src={`${import.meta.env.BASE_URL}cogscilogo.png`} alt="Logo" style={{ height: 40 }} />
              <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 28, fontWeight: 400, color: theme.text, letterSpacing: "0.01em", margin: 0 }}>
                Semantic Course Map
              </h1>
            </div>

            <div style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              background: theme.panelBg, backdropFilter: "blur(12px)",
              border: `1px solid ${theme.panelBorder}`, borderRadius: 16, padding: "40px",
              display: "flex", flexDirection: "column", gap: "24px", width: "min(90vw, 420px)",
              boxShadow: isDarkMode ? "0 24px 80px rgba(0,0,0,0.6)" : "0 24px 80px rgba(0,0,0,0.1)"
            }}>
              <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 32, color: theme.text, margin: 0, textAlign: "center" }}>Configure Map</h2>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.1em" }}>University</label>
                <select value={landingUni} onChange={(e) => setLandingUni(e.target.value)} style={{ padding: "12px 16px", background: theme.landingSelectBg, border: `1px solid ${theme.nodeBorder}`, borderRadius: 8, color: theme.text, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, outline: "none", cursor: "pointer" }}>
                  <option value="UGA">University of Georgia (UGA)</option>
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Term</label>
                <select value={landingTerm} onChange={(e) => setLandingTerm(e.target.value)} style={{ padding: "12px 16px", background: theme.landingSelectBg, border: `1px solid ${theme.nodeBorder}`, borderRadius: 8, color: theme.text, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, outline: "none", cursor: "pointer" }}>
                  <option value="all">All Available Terms</option>
                </select>
              </div>

              <button 
                onClick={() => setHasLaunched(true)} 
                style={{ 
                  marginTop: "10px", padding: "14px", background: theme.landingButtonBg, color: theme.landingButtonText, 
                  border: "none", borderRadius: 8, fontFamily: "'IBM Plex Mono', monospace", 
                  fontSize: 14, fontWeight: "bold", cursor: "pointer", transition: "all 0.2s" 
                }}
                onMouseOver={(e) => e.target.style.background = theme.landingButtonHover}
                onMouseOut={(e) => e.target.style.background = theme.landingButtonBg}
              >
                {loading ? "Initializing Engine..." : "Launch Map →"}
              </button>
            </div>
          </>
        ) : (
          /* ─── POST-LAUNCH MAIN APP ─── */
          <>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: theme.text, fontFamily: "'IBM Plex Mono', monospace" }}>
                Loading (14,000+ courses)...
              </div>
            ) : memoizedGraph}

            {/* Header */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
              padding: "18px 28px", background: theme.headerGradient, pointerEvents: "none",
              display: "flex", alignItems: "center", gap: "12px"
            }}>
              <img src={`${import.meta.env.BASE_URL}cogscilogo.png`} alt="Logo" style={{ height: 36, pointerEvents: "auto" }} />
              <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 24, fontWeight: 400, color: theme.text, letterSpacing: "0.01em", margin: 0 }}>
                {landingUni} Semantic Course Map
              </h1>
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: theme.textMuted, letterSpacing: "0.06em", marginTop: 4, margin: 0 }}>
                {courses.length} courses · click a node to explore
              </p>
            </div>

            {/* Search Bar & Dropdowns */}
            {/* [CHANGE: ERGONOMICS - SEARCH BAR WIDTH] - Increased max-width from 550px to 880px to give the search bar more presence. */}
            <div style={{ position: "absolute", top: 17, left: "calc(50% + 200px)", transform: "translateX(-50%)", zIndex: 20, display: "flex", gap: 10, width: "min(90vw, 880px)" }}>
              <select 
                value={searchField} onChange={(e) => setSearchField(e.target.value)}
                style={{ padding: "10px 14px", background: theme.panelBg, backdropFilter: "blur(12px)", border: `1px solid ${theme.panelBorder}`, borderRadius: 10, color: theme.text, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", outline: "none", cursor: "pointer", transition: "all 0.3s ease" }}
              >
                <option value="all">All Fields</option>
                <option value="subject">Course Code</option>
                <option value="title">Course Title</option>
                <option value="description">Description</option>
                <option value="objectives">Objectives</option>
                <option value="outline">Topical Outline</option>
              </select>

              <div style={{ position: "relative", flexGrow: 1 }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: theme.searchIcon, fontSize: 13, pointerEvents: "none" }}>⌕</span>
                <input
                  value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search concepts, topics, or classes…"
                  style={{ width: "100%", boxSizing: "border-box", padding: "10px 36px", background: theme.panelBg, backdropFilter: "blur(12px)", border: `1px solid ${theme.panelBorder}`, borderRadius: 10, color: theme.text, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", outline: "none", transition: "all 0.3s ease" }}
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: 13 }}>✕</button>
                )}
              </div>

              <select 
                value={mapType} 
                onChange={(e) => setMapType(e.target.value)}
                style={{ padding: "10px 14px", background: theme.panelBg, backdropFilter: "blur(12px)", border: `1px solid ${theme.panelBorder}`, borderRadius: 10, color: theme.text, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", outline: "none", cursor: "pointer", transition: "all 0.3s ease" }}
              >
                <option value="database_mapped_umap_15">UMAP (n=15)</option>
                <option value="database_mapped_umap_40">UMAP (n=40)</option>
                <option value="database_mapped_umap_100">UMAP (n=100)</option>
                <option value="database_mapped_pacmap_o">PaCMAP</option>
                <option value="database_mapped_trimap_500_100_100">TriMAP (500/100/100)</option>
                <option value="database_mapped_trimap_50_20_10">TriMAP (50/20/10)</option>
                <option value="database_mapped_trimap_30_20_10">TriMAP (30/20/10)</option>
                <option value="database_mapped_tsne_100">t-SNE (P=100)</option>
                <option value="database_mapped_tsne_500">t-SNE (P=500)</option>
                <option value="database_mapped_tsne_1000">t-SNE (P=1000)</option>
              </select>
            </div>

            {/* Legend */}
            {!loading && (
              <div style={{
                position: "absolute", top: 100, left: 24, zIndex: 20, 
                background: theme.panelBg, backdropFilter: "blur(12px)",
                border: `1px solid ${theme.panelBorder}`, borderRadius: 10, padding: "12px 16px",
                display: "flex", flexDirection: "column", gap: 6, 
                // [CHANGE: ERGONOMICS - LEGEND MAX HEIGHT] - Adjusted max height to stop above the theme switch.
                maxHeight: "calc(100vh - 180px)",
                // [CHANGE: ERGONOMICS - LEGEND WIDTH] - Conditional width makes the collapsed version less intrusive.
                width: legendExpanded ? 200 : 180,
                transition: "all 0.3s ease"
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, paddingBottom: 4, borderBottom: `1px solid ${theme.borderSubtle}` }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: theme.textMuted, letterSpacing: "0.12em" }}>DEPARTMENTS</span>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button onClick={() => setLegendExpanded(!legendExpanded)} style={{ background: "none", border: "none", color: theme.textSemi, fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer", padding: 0 }}>
                      {legendExpanded ? "Collapse ▲" : "Expand ▼"}
                    </button>
                    {selectedDepartments.size > 0 && (
                      <button onClick={() => setSelectedDepartments(new Set())} style={{ background: "none", border: "none", color: theme.linkColor, fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer", padding: 0 }}>Clear</button>
                    )}
                  </div>
                </div>
                
                {/* [CHANGE: ERGONOMICS - LEGEND SCROLL] - The scrollable div is now persistent but its height changes, preserving scroll position. */}
                <div style={{ 
                  overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, flex: 1, 
                  maxHeight: legendExpanded ? '100%' : '0px', transition: 'max-height 0.3s ease-in-out'
                }}>
                  {(legendExpanded ? uniqueSubjects : uniqueSubjects.slice(0, 10)).map(dept => {
                    const isSelected = selectedDepartments.has(dept);
                    const anySelected = selectedDepartments.size > 0;
                    return (
                      <div key={dept} onClick={() => toggleDepartment(dept)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", opacity: !anySelected || isSelected ? 1 : 0.3, padding: "2px 0" }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: getDeptBase(dept), flexShrink: 0 }} />
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: theme.textSemi }}>{dept}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Counter */}
            {/* [CHANGE: ERGONOMICS - COUNTER POSITION] - Moved the counter from the bottom right to the top right corner. */}
            {(debouncedSearch || selectedDepartments.size > 0) && (
              <div style={{
                position: "absolute", top: 24, right: 24, zIndex: 20,
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: theme.textMuted,
                background: theme.panelBg, backdropFilter: "blur(12px)",
                border: `1px solid ${theme.panelBorder}`, borderRadius: 8, padding: "8px 14px",
                transition: "all 0.3s ease"
              }}>
                {visibleCount} result{visibleCount !== 1 ? "s" : ""}
              </div>
            )}

            {/* Modal */}
            {selectedCourse && (() => {
              const color = getDeptBase(selectedCourse.subject);
              return (
                <div onClick={() => setSelectedCourse(null)} style={{ position: "fixed", inset: 0, zIndex: 100, background: theme.modalOverlay, backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.18s ease", transition: "all 0.3s ease" }}>
                  <div onClick={(e) => e.stopPropagation()} style={{ width: "min(92vw, 580px)", maxHeight: "80vh", overflowY: "auto", background: theme.modalBg, border: `1px solid ${color}44`, borderTop: `3px solid ${color}`, borderRadius: 14, padding: "32px 36px", position: "relative", animation: "slideUp 0.2s cubic-bezier(0.16,1,0.3,1)", boxShadow: isDarkMode ? `0 0 60px ${color}22, 0 24px 80px rgba(0,0,0,0.6)` : `0 0 40px ${color}22, 0 24px 60px rgba(0,0,0,0.15)` }}>
                    <button onClick={() => setSelectedCourse(null)} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer", color: theme.textMuted, fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
                    
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ display: "inline-block", background: `${color}22`, border: `1px solid ${color}55`, borderRadius: 6, padding: "3px 10px", marginBottom: 12 }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color, letterSpacing: "0.08em" }}>{selectedCourse.subject} {selectedCourse.number}</span>
                      </div>
                      <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 26, color: theme.text, margin: 0, lineHeight: 1.2, fontWeight: 400 }}>
                        {highlightMatch(selectedCourse.title, debouncedSearch, theme)}
                      </h2>
                      {selectedCourse.url && (
                        <a href={selectedCourse.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: theme.linkColor, marginTop: 8, display: "block", textDecoration: "none" }}>
                          → View in UGA Bulletin
                        </a>
                      )}
                    </div>

                    <Divider color={color} theme={theme} />

                    <Section label="Description" color={color} theme={theme}>
                      <p style={{ margin: 0, color: theme.textSemi, lineHeight: 1.7, fontSize: 14 }}>
                        {highlightMatch(selectedCourse.description || "No description available.", debouncedSearch, theme)}
                      </p>
                    </Section>

                    {selectedCourse.course_objectives && (
                      <Section label="Learning Objectives" color={color} theme={theme}>
                        <p style={{ margin: 0, color: theme.textSemi, lineHeight: 1.7, fontSize: 14 }}>
                          {highlightMatch(selectedCourse.course_objectives, debouncedSearch, theme)}
                        </p>
                      </Section>
                    )}

                    {selectedCourse.topical_outline && (
                      <Section label="Topical Outline" color={color} theme={theme}>
                        <p style={{ margin: 0, color: theme.textSemi, lineHeight: 1.7, fontSize: 14 }}>
                          {highlightMatch(selectedCourse.topical_outline, debouncedSearch, theme)}
                        </p>
                      </Section>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* [CHANGE: CHATBOT INTEGRATION] - Added Michelle's Chatbot component here. 
                Pass the `courses` data so the RAG system can function. */}
            <Chatbot courses={courses} />

          </>
        )}

        {/* ─── THEME TOGGLE BUTTON ─── */}
        <button 
          onClick={() => setIsDarkMode(!isDarkMode)}
          style={{
            position: "absolute", bottom: 24, left: 24, zIndex: 1000,
            background: theme.panelBg, backdropFilter: "blur(12px)",
            border: `1px solid ${theme.panelBorder}`, borderRadius: 8,
            color: theme.text, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11,
            padding: "8px 12px", cursor: "pointer", transition: "all 0.3s ease"
          }}
          onMouseOver={(e) => e.target.style.background = theme.buttonHover}
          onMouseOut={(e) => e.target.style.background = theme.panelBg}
        >
          {isDarkMode ? "Light Mode" : "Dark Mode"}
        </button>

      </div>
    </>
  );
}