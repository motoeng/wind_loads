import './App.css'
import WindForm from './components/WindForm'

function App() {
  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>Wind Loads</h1>
      <p>Browser-based calculator for preliminary wind pressure per simplified ASCE 7.</p>
      <WindForm />
    </div>
  )
}

export default App
