import { ArrowUpRight } from 'lucide-react'
import { usePreferences } from '../Preferences'
import { contentMessages } from '../contentMessages'


export default function Methodology() {
  const { language, number, reportHref, reportLanguage } = usePreferences()
  const messages = contentMessages[language]
  const t = messages.method
  const documentLanguages = reportLanguage === 'fr' ? ['fr', 'en'] : ['en', 'fr']
  return (
    <section id="methodology" className="research-section research-methodology section-pad" aria-labelledby="methodology-title">
      <div className="research-heading" data-reveal>
        <div>
          <p className="research-kicker">{t.kicker}</p>
          <h2 id="methodology-title" className="research-title">{t.title[0]} <span>{t.title[1]}</span></h2>
        </div>
        <p className="research-intro">{t.intro}</p>
      </div>
      <ol className="research-steps" role="list">
        {t.steps.map(([title, description], index) => (
          <li className="research-step" key={title} data-reveal style={{ '--reveal-delay': `${(index % 4) * 90}ms` }}>
            <span className="research-step-number" aria-hidden="true">{number(0)}{number(index + 1)}</span>
            <div><h3>{title}</h3><p>{description}</p></div>
          </li>
        ))}
      </ol>
      <div className="research-readiness" data-reveal>
        <div className="research-subheading">
          <h3>{t.ready}</h3>
          <p>{t.statusNote}</p>
        </div>
        <dl className="research-status-grid">
          {t.statuses.map(([title, description]) => <div className="research-status-card" key={title}><dt>{title}</dt><dd>{description}</dd></div>)}
        </dl>
      </div>
      <div className="research-rules">
        {t.rules.map(([title, description]) => <article className="research-rule-card" key={title}><h3>{title}</h3><p>{description}</p></article>)}
      </div>
      <div className="research-report">
        <p>{t.download}</p>
        <div className="research-downloads">
          {documentLanguages.map(documentLanguage => <a key={documentLanguage} className={`research-document-link ${documentLanguage === reportLanguage ? 'research-document-primary' : ''}`} href={documentLanguage === reportLanguage ? reportHref : `/reports/methodology-${documentLanguage}.pdf`} hrefLang={documentLanguage} target="_blank" rel="noopener noreferrer">
            {messages.documents[documentLanguage]}<span className="research-sr-only"> ({messages.newTab})</span><ArrowUpRight size={20} aria-hidden="true" />
          </a>)}
        </div>
      </div>
    </section>
  )
}
