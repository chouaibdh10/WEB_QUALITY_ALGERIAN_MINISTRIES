import { ShieldCheck, Gauge, Accessibility, Activity, Smartphone, FileText, ScanSearch } from 'lucide-react'
import { usePreferences } from '../Preferences'
import { contentMessages } from '../contentMessages'
import { categoryMax } from '../data/ministries'

const icons = [ShieldCheck, Gauge, Accessibility, Activity, Smartphone, FileText, ScanSearch]
const weights = Object.values(categoryMax)

export default function Categories() {
  const { language, number } = usePreferences()
  const t = contentMessages[language].categories
  return (
    <section id="categories" className="research-section research-framework section-pad" aria-labelledby="categories-title">
      <div className="research-heading" data-reveal>
        <div>
          <p className="research-kicker">{t.kicker}</p>
          <h2 id="categories-title" className="research-title">{t.title[0]} <span>{t.title[1]}</span></h2>
        </div>
        <p className="research-intro">{t.intro}</p>
      </div>
      <div className="research-category-grid">
        {t.items.map(([name, description], index) => { const Icon = icons[index]; return (
          <article className="research-category-card" key={name} data-reveal style={{ '--reveal-delay': `${(index % 3) * 90}ms` }}>
            <div className="research-category-meta">
              <span className="category-icon" aria-hidden="true"><Icon size={24} strokeWidth={1.5} /></span>
              <strong className="research-weight">{number(weights[index])}<span>{t.points}</span></strong>
            </div>
            <h3>{name}</h3>
            <p>{description}</p>
            <div className="category-weight-track" aria-hidden="true"><span style={{width: `${weights[index] * 5}%`}} /></div>
          </article>
        )})}
        <div className="research-category-summary" data-reveal style={{ '--reveal-delay': '180ms' }}>
          <p className="research-total">{t.total}</p>
          <p>{t.note}</p>
        </div>
      </div>
    </section>
  )
}
