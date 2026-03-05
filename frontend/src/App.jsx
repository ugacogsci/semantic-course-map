import { useState, useEffect, useRef, useCallback } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import cytoscape from "cytoscape";

// ─── Sample data matching database_mapped.json shape ───────────────────────
// Replace SAMPLE_COURSES with your actual import:
//   import courses from "./database_mapped.json";
import courses from "./database_mapped.json";

// import the chatbot
import Chatbot from "./Chatbot";

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

// ─── Build Cytoscape elements from course data ───────────────────────────────
function buildElements(courses) {
  const SCALE = 800;
  return courses.map((c, i) => ({
    data: {
      id: `course-${i}`,
      label: `${c.subject} ${c.number}`,
      course: c,
      color: getDeptBase(c.subject),
    },
    position: { x: c.x * SCALE, y: c.y * SCALE },
  }));
}

// ─── Cytoscape stylesheet ────────────────────────────────────────────────────
const CY_STYLE = [
  {
    selector: "node",
    style: {
      width: 18, height: 18,
      "background-color": "data(color)",
      "border-width": 1.5,
      "border-color": "rgba(255,255,255,0.2)",
      label: "data(label)",
      "font-family": "'IBM Plex Mono', monospace",
      "font-size": 7,
      color: "rgba(255,255,255,0.7)",
      "text-valign": "bottom",
      "text-margin-y": 4,
      "text-outline-width": 1.5,
      "text-outline-color": "#0a0f1a",
      "transition-property": "width, height, background-color, border-color",
      "transition-duration": "0.15s",
    },
  },
  {
    selector: "node:hover",
    style: {
      width: 26, height: 26,
      "border-color": "white",
      "border-width": 2,
      "font-size": 8,
      color: "white",
      "z-index": 999,
    },
  },
  {
    selector: "node.selected",
    style: {
      width: 28, height: 28,
      "border-color": "white",
      "border-width": 2.5,
      "background-color": "white",
    },
  },
];

// ─── Legend ──────────────────────────────────────────────────────────────────
function Legend({ depts }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? depts : depts.slice(0, 8);
  return (
    <div style={{
      position: "absolute", top: 24, left: 24, zIndex: 20,
      background: "rgba(10,15,26,0.85)", backdropFilter: "blur(12px)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 10, padding: "12px 16px",
      display: "flex", flexDirection: "column", gap: 6,
      maxHeight: "60vh", overflowY: "auto",
    }}>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", marginBottom: 4 }}>DEPARTMENTS</span>
      {visible.map(([dept, color]) => (
        <div key={dept} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.65)" }}>{dept}</span>
        </div>
      ))}
      <button onClick={() => setExpanded(!expanded)} style={{
        background: "none", border: "none", cursor: "pointer",
        color: "rgba(255,255,255,0.4)", fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 9, marginTop: 4, textAlign: "left", padding: 0,
      }}>{expanded ? "▲ show less" : `▼ +${depts.length - 8} more`}</button>
    </div>
  );
}

// ─── Course Modal ─────────────────────────────────────────────────────────────
function CourseModal({ course, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const color = getDeptBase(course.subject);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(5,8,18,0.7)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "fadeIn 0.18s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(92vw, 580px)",
          maxHeight: "80vh",
          overflowY: "auto",
          background: "#0d1323",
          border: `1px solid ${color}44`,
          borderTop: `3px solid ${color}`,
          borderRadius: 14,
          padding: "32px 36px",
          position: "relative",
          animation: "slideUp 0.2s cubic-bezier(0.16,1,0.3,1)",
          boxShadow: `0 0 60px ${color}22, 0 24px 80px rgba(0,0,0,0.6)`,
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 16, right: 16,
            background: "none", border: "none", cursor: "pointer",
            color: "rgba(255,255,255,0.4)", fontSize: 20, lineHeight: 1,
            padding: 4,
          }}
        >✕</button>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            display: "inline-block",
            background: `${color}22`, border: `1px solid ${color}55`,
            borderRadius: 6, padding: "3px 10px", marginBottom: 12,
          }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color, letterSpacing: "0.08em" }}>
              {course.subject} {course.number}
            </span>
          </div>
          <h2 style={{
            fontFamily: "'Instrument Serif', serif", fontSize: 26,
            color: "white", margin: 0, lineHeight: 1.2, fontWeight: 400,
          }}>{course.title}</h2>
          {course.url && (
            <a href={course.url} target="_blank" rel="noopener noreferrer"
              style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: `${color}cc`, marginTop: 8, display: "block", textDecoration: "none" }}>
              → View in UGA Bulletin
            </a>
          )}
        </div>

        <Divider color={color} />

        {/* Description */}
        {course.description && (
          <Section label="Description" color={color}>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.75)", lineHeight: 1.7, fontSize: 14 }}>{course.description}</p>
          </Section>
        )}

        {/* Objectives */}
        {course.course_objectives && (
          <Section label="Learning Objectives" color={color}>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.75)", lineHeight: 1.7, fontSize: 14 }}>{course.course_objectives}</p>
          </Section>
        )}

        {/* Topical Outline */}
        {course.topical_outline && (
          <Section label="Topical Outline" color={color}>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.75)", lineHeight: 1.7, fontSize: 14 }}>{course.topical_outline}</p>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ label, color, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <span style={{
        fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
        color, letterSpacing: "0.14em", textTransform: "uppercase",
        display: "block", marginBottom: 8,
      }}>{label}</span>
      {children}
    </div>
  );
}

function Divider({ color }) {
  return <div style={{ height: 1, background: `${color}22`, margin: "20px 0" }} />;
}

// ─── Search Bar ───────────────────────────────────────────────────────────────
function SearchBar({ value, onChange, onClear }) {
  return (
    <div style={{
      position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)",
      zIndex: 20, width: "min(90vw, 400px)",
    }}>
      <div style={{ position: "relative" }}>
        <span style={{
          position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
          color: "rgba(255,255,255,0.3)", fontSize: 13, pointerEvents: "none",
        }}>⌕</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search courses…"
          style={{
            width: "100%", boxSizing: "border-box",
            padding: "10px 36px 10px 36px",
            background: "rgba(10,15,26,0.85)", backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 10, color: "white", fontSize: 13,
            fontFamily: "'IBM Plex Mono', monospace", outline: "none",
          }}
        />
        {value && (
          <button onClick={onClear} style={{
            position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", color: "rgba(255,255,255,0.4)",
            cursor: "pointer", fontSize: 13, padding: 0,
          }}>✕</button>
        )}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
 

  const [selectedCourse, setSelectedCourse] = useState(null);
  const [search, setSearch] = useState("");
  const cyRef = useRef(null);

  // Derive unique departments for legend
   const depts = [...new Set(courses.map((c) => c.subject?.split("(")[0].trim()))]
    .map((d) => [d, getDeptBase(d)]);

  // Filter elements by search
  const filtered = search
    ? courses.filter((c) =>
        `${c.subject} ${c.number} ${c.title} ${c.description}`.toLowerCase().includes(search.toLowerCase())
      )
    : courses;

  const elements = buildElements(filtered);

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
  }, []);

  // Re-fit when search changes
  useEffect(() => {
    if (cyRef.current) {
      setTimeout(() => cyRef.current?.fit(undefined, 60), 50);
    }
  }, [search]);

  return (
    <>
      {/* Global styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Instrument+Serif&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #050812; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 3px; }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>

      <div style={{ width: "100vw", height: "100vh", position: "relative", background: "#050812" }}>

        {/* Header */}
        <div style={{
          position: "absolute", top: 0, left: "140px", right: 0, zIndex: 10,
          padding: "18px 28px",
          background: "linear-gradient(to bottom, rgba(5,8,18,0.95) 60%, transparent)",
          pointerEvents: "none",
        }}>
          <h1 style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: 22, fontWeight: 400, color: "white", letterSpacing: "0.01em",
          }}>
            UGA Semantic Course Map
          </h1>
          <p style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10, color: "rgba(255,255,255,0.35)",
            letterSpacing: "0.06em", marginTop: 4,
          }}>
            {courses.length} courses · click a node to explore
          </p>
        </div>

        {/* Search */}
        <SearchBar value={search} onChange={setSearch} onClear={() => setSearch("")} />

        {/* Cytoscape canvas */}
        <CytoscapeComponent
          elements={elements}
          style={{ width: "100%", height: "100%", background: "transparent" }}
          stylesheet={CY_STYLE}
          layout={{ name: "preset" }}
          cy={handleCyReady}
          wheelSensitivity={0.3}
        />

        {/* Legend */}
        <Legend depts={depts} />

        {/* Node count when searching */}
        {search && (
          <div style={{
            position: "absolute", bottom: 24, right: 24, zIndex: 20,
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 11,
            color: "rgba(255,255,255,0.4)",
            background: "rgba(10,15,26,0.85)", backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8, padding: "8px 14px",
          }}>
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </div>
        )}

        {/* Modal */}
        {selectedCourse && (
          <CourseModal course={selectedCourse} onClose={() => setSelectedCourse(null)} />
        )}

        <Chatbot courses={courses} />
      </div>
    </>
  );
}
