import { Accessibility, Gauge, LockKeyhole, Map, MonitorCog, ServerCog, TabletSmartphone } from 'lucide-react'

const categories = [
  ['Security', '20', 'Protection, transport encryption and trust signals.', LockKeyhole],
  ['Performance', '15', 'Speed, efficiency and a smooth page experience.', Gauge],
  ['Accessibility', '15', 'Inclusive access for every citizen and ability.', Accessibility],
  ['Reliability', '10', 'Availability, consistency and dependable navigation.', ServerCog],
  ['Mobile Usability', '15', 'A responsive experience on the device in hand.', TabletSmartphone],
  ['Content & Public Services', '15', 'Useful, findable and current public information.', Map],
  ['Technical Quality', '10', 'Standards, structure and maintainable foundations.', MonitorCog],
]

export default function Categories() {
  return <section id="categories" className="categories-section section-pad"><div className="section-heading"><div><div className="section-kicker">02 / Evaluation framework</div><h2>Seven signals.<br /><span>One complete picture.</span></h2></div><p>Each website is examined across seven practical dimensions, weighted by their impact on a useful public digital service.</p></div><div className="category-grid">{categories.map(([name, points, description, Icon], index) => <article className="category-card" key={name}><div className="category-top"><span className="category-number">0{index + 1}</span><Icon size={23} strokeWidth={1.7} /></div><div className="category-name">{name}</div><div className="category-bottom"><span>{description}</span><strong>{points}<small> pts</small></strong></div></article>)}</div></section>
}
