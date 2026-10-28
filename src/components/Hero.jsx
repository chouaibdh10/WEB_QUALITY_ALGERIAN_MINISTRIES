import { ArrowUpRight, ShieldCheck } from 'lucide-react'
import { pilotSummaries as pilotEvaluations } from '../data/pilotSummaries'
import { ministries } from '../data/ministries'
import InspectionScene from './InspectionScene'
import { usePreferences } from '../Preferences'
import { contentMessages } from '../contentMessages'

function Stat({ value, label, note, format, index }) {
  const count = value
  return <div data-reveal style={{ '--reveal-delay': `${index * 90}ms` }}>
    <span className="stat-value">{format(count)}</span>
    <div><span className="stat-label">{label}</span><span className="stat-note">{note}</span></div>
  </div>
}

export default function Hero() {
  const { language, number } = usePreferences()
  const t = contentMessages[language].hero
  return <><section id="home" className="hero" aria-labelledby="hero-title">
    <div className="hero-frame section-pad">
      <div className="hero-main">
        <div className="hero-copy">
          <div className="eyebrow" data-reveal><span className="pulse-dot" /> {t.eyebrow}<span className="edition-chip">{t.edition}</span></div>
          <h1 id="hero-title" data-reveal style={{ '--reveal-delay': '90ms' }}><span className="hero-title-main">{t.title[0]}</span><span>{t.title[1]}</span></h1>
          <p className="hero-lead" data-reveal style={{ '--reveal-delay': '180ms' }}>{t.lead}</p>
          <div className="hero-actions" data-reveal style={{ '--reveal-delay': '270ms' }}><a href="#results" className="button button-primary">{t.directory}<ArrowUpRight size={19} aria-hidden="true" /></a><a href="#methodology" className="button button-ghost">{t.measure}<ArrowUpRight size={18} aria-hidden="true" /></a></div>
          <p className="hero-research-note" data-reveal style={{ '--reveal-delay': '360ms' }}><ShieldCheck size={16} aria-hidden="true" />{Object.keys(pilotEvaluations).length > 0 ? <a href="#results">{({ en: 'Explore the measured websites', fr: 'Découvrir les sites évalués', ar: 'استكشف المواقع المقاسة' })[language]}</a> : t.unpublished}</p>
        </div>
        <InspectionScene />
      </div>

    </div>
  </section>
    <section className="landing-scope section-pad" aria-label={t.scope}>
      <div className="hero-stat-strip">
        {[ministries.length, 57, 7, 100].map((value, index) => <Stat key={index} value={value} index={index} format={number} label={t.stats[index][0]} note={t.stats[index][1]} />)}
      </div>
    </section>
  </>
}
