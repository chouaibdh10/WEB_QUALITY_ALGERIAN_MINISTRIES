import { X, ExternalLink } from 'lucide-react'
import { categoryMax } from '../data/ministries'

const details = [['Security', 'security'], ['Performance', 'performance'], ['Accessibility', 'accessibility'], ['Reliability', 'reliability'], ['Mobile', 'mobile'], ['Content', 'content'], ['Technical', 'technical']]
export default function MinistryDetails({ ministry, onClose }) {
  if (!ministry) return null
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside className="details-panel"><div className="details-header"><div><span className="section-kicker">Ministry profile</span><h2>{ministry.name}</h2><a href={`https://${ministry.domain}`} target="_blank" rel="noreferrer">{ministry.domain} <ExternalLink size={14} /></a></div><button className="close-button" aria-label="Close details" onClick={onClose}><X size={20} /></button></div><div className="details-score"><span>Overall score</span><strong>{ministry.score}<small>/100</small></strong><i className={`status-dot status-${ministry.status.toLowerCase()}`} /> <em>{ministry.status}</em></div><div className="details-bars">{details.map(([label, key]) => <div className="score-row" key={key}><div><span>{label}</span><strong>{ministry.scores[key]}<small>/{categoryMax[key]}</small></strong></div><div className="progress-track"><span style={{ width: `${(ministry.scores[key] / categoryMax[key]) * 100}%` }} /></div></div>)}</div><div className="placeholder-note">Placeholder data - replace with verified results in <code>src/data/ministries.js</code>.</div></aside></div>
}
