import { useState, useRef, useEffect } from "react";

// ─── UPGRADED RAG RETRIEVAL ENGINE ──────────────────────────────────────────
function searchCourses(query, courses, topK = 12) { // Increased to 12 for better context
  // 1. Remove common "filler" words that ruin the scoring math
  const stopwords = new Set(["what", "should", "take", "if", "love", "like", "the", "and", "or", "for", "with", "this", "that", "how", "why", "are", "you", "can", "about", "difference", "between"]);
  
  // 2. Tokenize the query, ignoring punctuation
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 1 && !stopwords.has(w));
  
  if (words.length === 0) return[];

  const scored = courses.map((c) => {
    const text = `${c.subject} ${c.number} ${c.title} ${c.description} ${c.course_objectives} ${c.topical_outline}`.toLowerCase();
    let score = 0;
    
    words.forEach(w => {
      // 3. WORD BOUNDARY REGEX: \b ensures "ai" only matches " AI ", not "train" or "main"
      const regex = new RegExp(`\\b${w}\\b`, 'i');
      if (regex.test(text)) {
        // Boost the score if the keyword is in the actual Title or Subject!
        if (`${c.subject} ${c.title}`.toLowerCase().includes(w)) {
          score += 5;
        } else {
          score += 1;
        }
      }
    });
    return { course: c, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score) // Sort by highest score first
    .slice(0, topK)
    .map(s => s.course);
}

// ─── Format courses for the AI prompt ────────────────────────────────────────
function formatCoursesForPrompt(courses) {
  return courses.map(c =>
    `${c.subject} ${c.number}: ${c.title}\nDescription: ${c.description}\nObjectives: ${c.course_objectives || "N/A"}\nTopics: ${c.topical_outline || "N/A"}`
  ).join("\n\n---\n\n");
}

// ─── Markdown Parser Helper ───────────────────────────────────────────────────────────
//[CHANGE: MARKDOWN RENDERING] - Safely converts **bold** text from Claude into actual bold HTML elements
const renderMarkdown = (text) => {
  if (!text) return null;
  // Splits the text by **...**. 
  // Capturing group (.*?) ensures the matched text is kept in the array at odd indices.
  const parts = text.split(/\*\*(.*?)\*\*/g);
  
  return parts.map((part, index) => {
    // Odd indices are the text that was between the asterisks
    if (index % 2 === 1) {
      return <strong key={index} style={{ color: "#fff", fontWeight: 700 }}>{part}</strong>;
    }
    // Even indices are normal text
    return <span key={index}>{part}</span>;
  });
};

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
        borderRadius: isUser ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
        padding: "10px 14px",
        color: "rgba(255,255,255,0.9)",
        fontSize: 13,
        lineHeight: 1.6,
        fontFamily: "'IBM Plex Mono', monospace",
        // pre-wrap ensures that Claude's newlines and bullet points format correctly
        whiteSpace: "pre-wrap",
      }}>
        {/*[CHANGE: MARKDOWN RENDERING] - Pass the text through our parser instead of rendering raw text */}
        {renderMarkdown(msg.content)}
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
//[CHANGE: CHATBOT MAP SYNC] - Added onRecommend prop to pass selected course IDs back up to the map!
export default function Chatbot({ courses, onRecommend }) {
  const[open, setOpen] = useState(false);
  const[messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Ask me anything — like \"What should I take if I love psychology and AI?\" or \"What's the difference between CSCI 4360 and STAT 4230?\"",
    }
  ]);
  const [input, setInput] = useState("");
  const[loading, setLoading] = useState(false);
  
  const [apiKey, setApiKey] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    if (!apiKey) {
      setMessages(prev =>[...prev, { role: "assistant", content: "--Please enter your Anthropic API Key in the settings first" }]);
      return;
    }

    const userMsg = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const relevant = searchCourses(text, courses);
      const courseContext = relevant.length > 0
        ? `Here are the most relevant UGA courses I found:\n\n${formatCoursesForPrompt(relevant)}`
        : "No specific courses matched your keywords. Answer generally about UGA's curriculum based on your base knowledge.";

      const systemPrompt = `You are a helpful academic exploration assistant embedded in the UGA Semantic Course Map. You help students explore University of Georgia (UGA) courses.
      Use the provided course information to give accurate, helpful recommendations and explanations. 
      If the user’s question or interests are unclear, ask a clarifying question before giving recommendations. 
      Be friendly, concise, and specific. When recommending courses always mention the course code and title in bold (e.g. **CSCI 1301: Intro to Computing**).
      Only recommend courses that appear in the context provided below. Be very concise. Try not to exceed 70 words.

      CONTEXT:
      ${courseContext}`;

      const history = messages
        .filter(m => m.role !== "system" && !m.content.includes("--"))
        .map(m => ({ role: m.role, content: m.content }));

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-api-key": apiKey, 
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001", 
          max_tokens: 1000,
          system: systemPrompt,
          messages:[...history, { role: "user", content: text }],
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        console.error("API Error:", data.error);
        setMessages(prev =>[...prev, { role: "assistant", content: `API Error: ${data.error.message}` }]);
      } else {
        const reply = data.content?.[0]?.text || "Sorry, I couldn't get a response. Try again!";
        setMessages(prev =>[...prev, { role: "assistant", content: reply }]);

        //[CHANGE: CHATBOT MAP SYNC] - Parse the AI's reply for bolded course codes (e.g., **CSCI 4360**)
        if (onRecommend) {
          // [CHANGE: REGEX FIX] - Updated regex to properly capture cross-listed courses (parentheses) and weird numbers (slashes)
          // Group 1: Any uppercase letter or parenthesis -> [A-Z()]+
          // Group 2: Starts with digit, followed by digits, letters, or slashes -> [\d][\da-zA-Z/]*
          const regex = /\*\*([A-Z()]+)\s+([\d][\da-zA-Z/]*)/gi;
          const matches =[...reply.matchAll(regex)];
          
          if (matches.length > 0) {
            // Format them exactly how our node IDs are formatted ("CSCI-4360")
            const courseIds = matches.map(m => `${m[1].toUpperCase()}-${m[2].toUpperCase()}`);
            onRecommend(courseIds); // Pass the IDs back to App.jsx to select them on the map
          }
        }
      }
    } catch (err) {
      console.error(err);
      setMessages(prev =>[...prev, {
        role: "assistant",
        content: "Network error connecting to the AI. Check your console.",
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
            
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowSettings(!showSettings)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: 16, padding: 4 }}>
                ⚙️
              </button>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: 18, padding: 4 }}>
                ✕
              </button>
            </div>
          </div>

          {/* API Key Settings Dropdown */}
          {showSettings && (
            <div style={{ padding: "12px", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <input 
                //[CHANGE: PASSWORD BUG FIX] - Changed from type="password" to type="text". 
                // This permanently stops Firefox from thinking the App.jsx search bar is a username field
                type="text"
                placeholder="Paste Anthropic API Key (sk-ant-...)"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={{
                  width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 6, padding: "8px", color: "white", fontFamily: "monospace", fontSize: 11, outline: "none",
                  // Optional: use webkit-text-security if you still want it to look like dots visually
                  WebkitTextSecurity: "disc" 
                }}
              />
            </div>
          )}

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
            {messages.map((msg, i) => <Message key={i} msg={msg} />)}
            {loading && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMessage()}
              placeholder="Ask about courses…"
              autoComplete="off"
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
                background: loading || !input.trim() ? "rgba(99,102,241,0.2)" : "linear-gradient(135deg, #a78bfa, #6366f1)",
                border: "none", borderRadius: 10, width: 38, height: 38, cursor: loading ? "not-allowed" : "pointer",
                color: "white", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
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
          fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center",
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