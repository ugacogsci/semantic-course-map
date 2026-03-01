import { useState, useEffect } from 'react'

function App() {
  const [backendData, setBackendData] = useState(null)
  const [loading, setLoading] = useState(true)

  // This useEffect hook runs once when the page loads
  useEffect(() => {
    // Fetch data from our Flask backend
    fetch('http://127.0.0.1:5000/api/status')
      .then(response => response.json())
      .then(data => {
        setBackendData(data)
        setLoading(false)
      })
      .catch(error => {
        console.error("Error fetching data:", error)
        setLoading(false)
      })
  },[])

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1>UGA Semantic Course Map</h1>
      <p>This is the React Frontend.</p>
      
      <div style={{ marginTop: '2rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h3>Backend Connection Status:</h3>
        {loading ? (
          <p>Connecting to Flask...</p>
        ) : backendData ? (
          <div>
            <p style={{ color: 'green' }}>🟢 Connected successfully!</p>
            <p><strong>Message from server:</strong> {backendData.message}</p>
          </div>
        ) : (
          <p style={{ color: 'red' }}>🔴 Failed to connect to backend. Is Flask running?</p>
        )}
      </div>
    </div>
  )
}

export default App