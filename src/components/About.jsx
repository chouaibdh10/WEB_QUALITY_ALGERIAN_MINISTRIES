import { ArrowUpRight } from 'lucide-react'
import { usePreferences } from '../Preferences'
import { contentMessages } from '../contentMessages'
import '../research.css'
import ProjectCredits from './ProjectCredits'

export default function About({ compact = false }) {
  const { language } = usePreferences()
  const t = contentMessages[language].about
  const headingId = compact ? 'about-title' : 'evaluation-title'
  const index = compact ? 1 : 0
  return (
    <section id={compact ? 'about' : 'evaluation'} className={`research-section section-pad ${compact ? 'research-context' : 'research-project'}`} aria-labelledby={headingId}>
      <div className="research-heading" data-reveal>
        <div>
          <p className="research-kicker">{t.kicker[index]}</p>
          <h2 id={headingId} className="research-title">{t.titles[index][0]} <span>{t.titles[index][1]}</span></h2>
        </div>
        <p className="research-intro">{compact ? t.context[0] : t.project[0]}</p>
      </div>
      {compact ? (
        <>
        <ProjectCredits />
        <div className="research-context-grid" data-reveal>
          <p className="research-reference-card">{t.context[1]}</p>
          <p className="research-scope-card">{t.context[2]}</p>
        </div>
        </>
      ) : (
        <div className="research-project-grid" data-reveal style={{ '--reveal-delay': '120ms' }}>
          <div className="research-evidence-card">
            <p>{t.project[1]}</p>
            <a href="#methodology" className="research-link">{t.protocol}<ArrowUpRight size={20} aria-hidden="true" /></a>
          </div>
          <ul className="research-principles">
            {t.points.map(point => <li key={point}>{point}</li>)}
          </ul>
        </div>
      )}
    </section>
  )
}
