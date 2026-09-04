import { ArrowUpRight, Menu, X } from 'lucide-react'
import { useState } from 'react'

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const links = [['Home', 'home'], ['Evaluation', 'evaluation'], ['Results', 'results'], ['Methodology', 'methodology'], ['About', 'about']]
  return <header className="site-header">
    <nav className="nav-shell">
      <a className="brand" href="#home" onClick={() => setOpen(false)}><span className="brand-mark">AQ</span><span><strong>ALGERIAN MINISTRIES</strong><small>WEB QUALITY INDEX <em>2026</em></small></span></a>
      <button className="menu-button" aria-label="Toggle menu" onClick={() => setOpen(!open)}>{open ? <X size={21} /> : <Menu size={21} />}</button>
      <div className={`nav-links ${open ? 'is-open' : ''}`}>{links.map(([label, id]) => <a key={id} href={`#${id}`} onClick={() => setOpen(false)}>{label}</a>)}<a className="nav-cta" href="#results" onClick={() => setOpen(false)}>View results <ArrowUpRight size={16} /></a></div>
    </nav>
  </header>
}
