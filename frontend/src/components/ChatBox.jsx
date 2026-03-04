import { useState } from 'react';

/**
 * ChatBox component for the RAG-powered course recommendation chatbot.
 * Provides a text input for user questions and displays AI responses.
 */
function ChatBox() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!question.trim()) return;
    
    const userQuestion = question.trim();
    setQuestion('');
    setLoading(true);
    
    // Add user message to chat
    setMessages(prev => [...prev, { type: 'user', content: userQuestion }]);
    
    try {
      const response = await fetch('http://127.0.0.1:5000/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: userQuestion }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setMessages(prev => [...prev, { 
          type: 'assistant', 
          content: data.answer,
          sources: data.sources 
        }]);
      } else {
        setMessages(prev => [...prev, { 
          type: 'error', 
          content: data.error || 'An error occurred. Please try again.' 
        }]);
      }
    } catch (error) {
      console.error('Error calling /api/ask:', error);
      setMessages(prev => [...prev, { 
        type: 'error', 
        content: 'Failed to connect to the server. Make sure the backend is running.' 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={() => setIsExpanded(!isExpanded)}>
        <span style={styles.headerTitle}>🎓 Course Advisor Chatbot</span>
        <span style={styles.toggleIcon}>{isExpanded ? '▼' : '▲'}</span>
      </div>
      
      {isExpanded && (
        <div style={styles.content}>
          <div style={styles.messagesContainer}>
            {messages.length === 0 ? (
              <div style={styles.welcomeMessage}>
                <p>👋 Hi! I can help you find courses at UGA.</p>
                <p style={styles.exampleText}>Try asking:</p>
                <ul style={styles.exampleList}>
                  <li>"What courses teach machine learning?"</li>
                  <li>"I want to learn about environmental science"</li>
                  <li>"Recommend courses for a career in data science"</li>
                </ul>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div 
                  key={index} 
                  style={{
                    ...styles.message,
                    ...(msg.type === 'user' ? styles.userMessage : 
                        msg.type === 'error' ? styles.errorMessage : 
                        styles.assistantMessage)
                  }}
                >
                  <div style={styles.messageLabel}>
                    {msg.type === 'user' ? '👤 You' : 
                     msg.type === 'error' ? '⚠️ Error' : 
                     '🤖 Advisor'}
                  </div>
                  <div style={styles.messageContent}>
                    {msg.content}
                  </div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div style={styles.sources}>
                      <div style={styles.sourcesLabel}>📚 Sources:</div>
                      {msg.sources.map((source, idx) => (
                        <div key={idx} style={styles.sourceItem}>
                          <strong>{source.code}</strong>: {source.title} 
                          <span style={styles.similarity}>({source.similarity}% match)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
            {loading && (
              <div style={styles.loadingMessage}>
                <div style={styles.loadingDots}>
                  Thinking<span className="dots">...</span>
                </div>
              </div>
            )}
          </div>
          
          <form onSubmit={handleSubmit} style={styles.inputForm}>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about courses..."
              style={styles.input}
              disabled={loading}
            />
            <button 
              type="submit" 
              style={{
                ...styles.sendButton,
                ...(loading || !question.trim() ? styles.sendButtonDisabled : {})
              }}
              disabled={loading || !question.trim()}
            >
              {loading ? '...' : 'Send'}
            </button>
          </form>
          
          {messages.length > 0 && (
            <button onClick={clearChat} style={styles.clearButton}>
              Clear Chat
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    width: '380px',
    maxHeight: '500px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    fontFamily: 'sans-serif',
    zIndex: 1000,
    overflow: 'hidden',
    border: '1px solid #e0e0e0',
  },
  header: {
    backgroundColor: '#BA0C2F', // UGA Red
    color: 'white',
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
  },
  headerTitle: {
    fontWeight: 'bold',
    fontSize: '14px',
  },
  toggleIcon: {
    fontSize: '12px',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    height: '420px',
  },
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px',
    backgroundColor: '#f9f9f9',
  },
  welcomeMessage: {
    textAlign: 'center',
    color: '#555',
    padding: '20px',
    fontSize: '14px',
  },
  exampleText: {
    marginTop: '16px',
    fontWeight: 'bold',
    color: '#333',
  },
  exampleList: {
    textAlign: 'left',
    fontSize: '13px',
    color: '#666',
    lineHeight: '1.8',
  },
  message: {
    marginBottom: '12px',
    padding: '10px 12px',
    borderRadius: '8px',
    fontSize: '14px',
    lineHeight: '1.5',
  },
  userMessage: {
    backgroundColor: '#BA0C2F',
    color: 'white',
    marginLeft: '20px',
  },
  assistantMessage: {
    backgroundColor: '#ffffff',
    border: '1px solid #ddd',
    marginRight: '20px',
  },
  errorMessage: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    border: '1px solid #ffcdd2',
  },
  messageLabel: {
    fontWeight: 'bold',
    fontSize: '12px',
    marginBottom: '4px',
    opacity: 0.8,
  },
  messageContent: {
    whiteSpace: 'pre-wrap',
  },
  sources: {
    marginTop: '10px',
    paddingTop: '10px',
    borderTop: '1px solid #eee',
    fontSize: '12px',
    color: '#666',
  },
  sourcesLabel: {
    fontWeight: 'bold',
    marginBottom: '6px',
  },
  sourceItem: {
    marginBottom: '4px',
  },
  similarity: {
    color: '#888',
    marginLeft: '6px',
  },
  loadingMessage: {
    textAlign: 'center',
    padding: '10px',
    color: '#666',
  },
  loadingDots: {
    fontSize: '14px',
  },
  inputForm: {
    display: 'flex',
    padding: '12px',
    borderTop: '1px solid #eee',
    backgroundColor: '#fff',
    gap: '8px',
  },
  input: {
    flex: 1,
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: '20px',
    fontSize: '14px',
    outline: 'none',
  },
  sendButton: {
    padding: '10px 18px',
    backgroundColor: '#BA0C2F',
    color: 'white',
    border: 'none',
    borderRadius: '20px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px',
    transition: 'background-color 0.2s',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
  },
  clearButton: {
    display: 'block',
    width: 'calc(100% - 24px)',
    margin: '0 12px 12px',
    padding: '8px',
    backgroundColor: 'transparent',
    color: '#666',
    border: '1px solid #ddd',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
  },
};

export default ChatBox;
