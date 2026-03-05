import { useState, useRef, useEffect } from "react";

// ─── Simple keyword-based course search (RAG retrieval step) ─────────────────
function searchCourses(query, courses, topK = 8) {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const scored = courses.map((c) => {
    const text = `${c.title} ${c.description} ${c.course_objectives} ${c.topical_outline} ${c.subject}`.toLowerCase();
    const score = words.reduce((acc, w) => acc + (text.includes(w) ? 1 : 0), 0);
    return { course: c, score };
  });
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(s => s.course);
}

// ─── Format courses for the AI prompt ────────────────────────────────────────
function formatCoursesForPrompt(courses) {
  return courses.map(c =>
    `${c.subject} ${c.number}: ${c.title}\nDescription: ${c.description}\nObjectives: ${c.course_objectives || "N/A"}\nTopics: ${c.topical_outline || "N/A"}`
  ).join("\n\n---\n\n");
}

// ─── Message bubble ───────────────────────────────────────────────────────────
function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex",
      justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: 12,
    }}>
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: "linear-gradient(135deg, #a78bfa, #38bdf8)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, marginRight: 8, flexShrink: 0, marginTop: 2,
        }}>✦</div>
      )}
      <div style={{
        maxWidth: "80%",
        background: isUser ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.06)",
        border: isUser ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.08)",
        borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
        padding: "10px 14px",
        color: "rgba(255,255,255,0.9)",
        fontSize: 13,
        lineHeight: 1.6,
        fontFamily: "'IBM Plex Mono', monospace",
        whiteSpace: "pre-wrap",
      }}>
        {msg.content}
      </div>
    </div>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%",
        background: "linear-gradient(135deg, #a78bfa, #38bdf8)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, flexShrink: 0,
      }}>✦</div>
      <div style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "14px 14px 14px 4px",
        padding: "10px 16px",
        display: "flex", gap: 4, alignItems: "center",
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "rgba(255,255,255,0.4)",
            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

// ─── Main Chatbot Component ───────────────────────────────────────────────────
export default function Chatbot({ courses }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Ask me anything — like \"What should I take if I love psychology and AI?\" or \"What's the difference between CSCI 4360 and STAT 4230?\"",
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // RAG: retrieve relevant courses
      const relevant = searchCourses(text, courses);
      const courseContext = relevant.length > 0
        ? `Here are the most relevant UGA courses I found:\n\n${formatCoursesForPrompt(relevant)}`
        : "No specific courses matched, but answer generally about UGA's curriculum.";

      const systemPrompt = `You are a helpful exploration assistant embedded in the UGA Semantic Course Map. You help students explore University of Georgia (UGA) courses.
      Use the provided course information to give accurate, helpful recommendations. 
      If the user’s question or interests are unclear, ask a clarifying question before giving recommendations. 
      If information is missing or not included in the provided data, state this clearly and do not make up details.  
      You help students explore courses, get recommendations, and understand course content.
      Be friendly, concise, and specific. When recommending courses always mention the course code and title.
      Only recommend courses that appear in the context provided.

${courseContext}`;

      const history = messages
        .filter(m => m.role !== "system")
        .map(m => ({ role: m.role, content: m.content }));

      const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { 
    "Content-Type": "application/json",
    "x-api-key": "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",
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: systemPrompt,
    messages: [...history, { role: "user", content: text }],
  }),
});

      const data = await response.json();
      const reply = data.content?.[0]?.text || "Sorry, I couldn't get a response. Try again!";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Something went wrong connecting to the AI. Please try again!",
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.9) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      {/* Chat window */}
      {open && (
        <div style={{
          position: "fixed", bottom: 90, right: 24, zIndex: 200,
          width: "min(92vw, 380px)", height: 500,
          background: "#0d1323",
          border: "1px solid rgba(167,139,250,0.3)",
          borderRadius: 16,
          display: "flex", flexDirection: "column",
          boxShadow: "0 0 60px rgba(167,139,250,0.15), 0 24px 80px rgba(0,0,0,0.6)",
          animation: "popIn 0.2s cubic-bezier(0.16,1,0.3,1)",
        }}>
          {/* Header */}
          <div style={{
            padding: "14px 18px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "linear-gradient(135deg, #a78bfa, #38bdf8)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14,
              }}>✦</div>
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "white", fontWeight: 500 }}>
                  Orion - Course Assistant 
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.35)" }}>
                  powered by Claude
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "rgba(255,255,255,0.4)", fontSize: 18, padding: 4,
            }}>✕</button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: "auto", padding: "16px 14px",
          }}>
            {messages.map((msg, i) => <Message key={i} msg={msg} />)}
            {loading && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: "12px 14px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex", gap: 8,
          }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMessage()}
              placeholder="Ask about courses…"
              style={{
                flex: 1, background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10, padding: "9px 14px",
                color: "white", fontSize: 12,
                fontFamily: "'IBM Plex Mono', monospace", outline: "none",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              style={{
                background: loading || !input.trim()
                  ? "rgba(99,102,241,0.2)"
                  : "linear-gradient(135deg, #a78bfa, #6366f1)",
                border: "none", borderRadius: 10,
                width: 38, height: 38, cursor: loading ? "not-allowed" : "pointer",
                color: "white", fontSize: 16,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}
            >↑</button>
          </div>
        </div>
      )}

      {/* Floating bubble */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 200,
          width: 56, height: 56, borderRadius: "50%",
          background: "linear-gradient(135deg, #a78bfa, #6366f1)",
          border: "none", cursor: "pointer",
          boxShadow: "0 0 30px rgba(167,139,250,0.4), 0 8px 32px rgba(0,0,0,0.4)",
          fontSize: 22,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform 0.2s, box-shadow 0.2s",
        }}
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
      >
        {open ? "✕" : "✦"}
      </button>
    </>
  );
}
