import { useState } from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import About from './components/About'
import Categories from './components/Categories'
import Results from './components/Results'
import MinistryDetails from './components/MinistryDetails'
import Methodology from './components/Methodology'
import Footer from './components/Footer'
import { ministries } from './data/ministries'

export default function App() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedMinistry, setSelectedMinistry] = useState(null)
  return <><Navbar /><main><Hero /><About /><Categories /><Results ministries={ministries} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} onSelect={setSelectedMinistry} /><Methodology /><About compact /></main><Footer /><MinistryDetails ministry={selectedMinistry} onClose={() => setSelectedMinistry(null)} /></>
}
