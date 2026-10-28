import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowUpRight, ExternalLink } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { categoryMax, ministries } from '../data/ministries'
import { usePreferences } from '../Preferences'
import { directoryMessages } from '../directoryMessages'
import { profileMessages } from '../profileMessages'
import '../profile.css'
import MinistryLogo from './MinistryLogo'
import PilotEvaluation from './PilotEvaluation'
import { pilotSummaries } from '../data/pilotSummaries'
import { campaignStatus } from '../data/campaignStatus'
import { campaignMessages } from '../campaignMessages'

const reportCache = new Map()
import { ministryIdentities } from '../data/ministryIdentities'

const categories = ['security', 'performance', 'accessibility', 'reliability', 'mobile', 'content', 'technical']

export function NotFound() {
  const { language } = usePreferences()
  const copy = profileMessages[language]
  return <main id="main-content" tabIndex={-1} className="ministry-profile ministry-profile-not-found">
    <span className="section-kicker">{copy.notFoundKicker}</span>
    <h1>{copy.notFoundTitle}</h1>
    <p>{copy.notFoundDescription}</p>
    <Link to="/#results" className="ministry-profile-back"><ArrowLeft size={17} aria-hidden="true" />{copy.backToDirectory}</Link>
  </main>
}

export default function MinistryProfile() {
  const { id } = useParams()
  const ministry = ministries.find(entry => entry.id === id)
  const { language, number, date, reportHref, reportLanguage } = usePreferences()
  const messages = directoryMessages[language]
  const copy = profileMessages[language]
  const campaignCopy = campaignMessages[language]
  const [reportState, setReportState] = useState({ id: null })
  useEffect(() => {
    if (!pilotSummaries[id]) return
    if (reportCache.has(id)) { setReportState({ id, report: reportCache.get(id) }); return }
    const controller = new AbortController()
    fetch(`/evaluations/${id}-pilot.json`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw Error('Report unavailable'); return response.json() })
      .then(report => {
        if (report.ministryId !== id || !Array.isArray(report.categories)) throw Error('Invalid report')
        reportCache.set(id, report)
        setReportState({ id, report })
      })
      .catch(error => { if (error.name !== 'AbortError') setReportState({ id, error: true }) })
    return () => controller.abort()
  }, [id])
  const pilot = reportState.id === id ? reportState.report : reportCache.get(id)
  const reportError = reportState.id === id && reportState.error
  const campaignEntry = campaignStatus?.entries.find(entry => entry.id === id)
  const evaluatedHost = pilot?.pages.find(page => page.type === 'homepage')?.url ? new URL(pilot.pages.find(page => page.type === 'homepage').url).hostname : ministry?.domain
  useEffect(() => { document.getElementById('main-content')?.focus({ preventScroll: true }) }, [id])
  const ownershipConfirmed = pilot?.ownership?.status === 'Government directory confirmed'

  if (!ministry) return <NotFound />
  if (pilotSummaries[id] && !pilot) return <main id="main-content" tabIndex={-1} className="ministry-profile">
    <Link to="/#results" className="ministry-profile-back"><ArrowLeft size={17} aria-hidden="true" />{copy.backToDirectory}</Link>
    <h1>{messages.names[id]}</h1>
    <p role={reportError ? 'alert' : 'status'}>{reportError
      ? ({ en: 'The reviewed report could not load. You can open its JSON record directly or reload this page.', fr: 'Le rapport ne peut pas être chargé. Ouvrez son fichier JSON ou rechargez la page.', ar: 'تعذر تحميل التقرير. يمكنك فتح سجل JSON مباشرة أو إعادة تحميل الصفحة.' })[language]
      : ({ en: 'Loading the reviewed measurement report…', fr: 'Chargement du rapport de mesure révisé…', ar: 'جارٍ تحميل تقرير القياس المراجع…' })[language]}</p>
    {reportError && <a href={`/evaluations/${id}-pilot.json`}>{({ en: 'Open report record', fr: 'Ouvrir le rapport', ar: 'فتح سجل التقرير' })[language]}</a>}
  </main>

  return <main id="main-content" tabIndex={-1} className={`ministry-profile${pilot ? ' ministry-profile-has-pilot' : ''}`}>
    <header className="ministry-profile-heading" data-reveal>
      <Link to="/#results" className="ministry-profile-back"><ArrowLeft size={17} aria-hidden="true" />{copy.backToDirectory}</Link>
      <span className="section-kicker">{pilot ? ({ en: 'Measured website pilot', fr: 'Évaluation pilote du site', ar: 'تقييم تجريبي فعلي للموقع' })[language] : messages.profileKicker}</span>
      <div className="profile-identity-heading"><MinistryLogo id={ministry.id} large /><h1>{messages.names[ministry.id]}</h1></div>
      <div className="ministry-profile-status">
        <span className={`status status-${ministry.status.toLowerCase()}`}><i aria-hidden="true" />{pilot ? ({ en: 'Measured pilot', fr: 'Pilote mesuré', ar: 'تقييم تجريبي' })[language] : campaignEntry ? campaignCopy.labels[campaignEntry.status] : messages.statuses[ministry.status]}</span>
        <span>{pilot ? ownershipConfirmed ? ({ en: 'Pilot published · Government directory confirmed', fr: 'Pilote publié · Domaine confirmé par un annuaire gouvernemental', ar: 'نُشر التقييم · النطاق مثبت بدليل حكومي' })[language] : ({ en: 'Pilot published · Ownership verification pending', fr: 'Pilote publié · Propriété du domaine à vérifier', ar: 'نُشر التقييم · تأكيد ملكية النطاق معلق' })[language] : messages.statusNotice}</span>
      </div>
      <p className="identity-source">{ministryIdentities[id] ? <a href={ministryIdentities[id].page} target="_blank" rel="noreferrer">{({ en: 'Identity source: ministry website', fr: 'Source de l’identité : site ministériel', ar: 'مصدر الهوية: موقع الوزارة' })[language]}<ArrowUpRight size={13} aria-hidden="true" /><span className="sr-only">{messages.newTab}</span></a> : ({ en: 'Official visual identity awaiting verification.', fr: 'Identité visuelle officielle en attente de vérification.', ar: 'الهوية البصرية الرسمية قيد التحقق.' })[language]}</p>
      <p className="ministry-profile-notice">{pilot ? ownershipConfirmed ? ({ en: 'Domain association is supported by an independent government directory. Measurements cover the declared page sample; this is a provisional evaluation, excluded from national rankings.', fr: 'Le domaine est confirmé par un annuaire gouvernemental indépendant. Les mesures portent sur l’échantillon déclaré ; évaluation provisoire, hors classement national.', ar: 'النطاق مؤكد عبر دليل حكومي مستقل. تغطي القياسات عينة الصفحات المعلنة؛ التقييم أولي وخارج الترتيب الوطني.' })[language] : ({ en: `Pilot of ${evaluatedHost}. Independent confirmation of the primary ministry domain is pending; excluded from national rankings.`, fr: `Pilote de ${evaluatedHost}. La confirmation indépendante du domaine principal reste à effectuer ; hors classement national.`, ar: `تقييم أولي للنطاق ${evaluatedHost}. تأكيد النطاق الرسمي من مصدر مستقل معلق؛ التقييم خارج الترتيب الوطني.` })[language] : ministry.status === 'Candidate' ? messages.candidateNotice : messages.unresolvedNotice}</p>
      {ownershipConfirmed && <p className="identity-source"><a href={pilot.ownership.source} target="_blank" rel="noreferrer">{({ en: 'Government directory verification', fr: 'Vérification dans l’annuaire gouvernemental', ar: 'مصدر تأكيد النطاق الحكومي' })[language]}<ArrowUpRight size={13} aria-hidden="true" /></a></p>}
    </header>

    {!pilot && campaignEntry && <section className="profile-collection-status" aria-labelledby="collection-status-heading">
      <span className="section-kicker">{campaignCopy.title}</span>
      <h2 id="collection-status-heading">{campaignCopy.labels[campaignEntry.status]}</h2>
      <p>{campaignCopy.descriptions[campaignEntry.status]}</p>
      <p>{campaignCopy.pending}</p>
      {campaignEntry.checkedAt && <p className="collection-checked">{campaignCopy.date}: {date(campaignEntry.checkedAt)}</p>}
      <a href="/evaluations/campaign-status.json" download>{campaignCopy.record}<ArrowUpRight size={16} aria-hidden="true" /></a>
    </section>}
    {pilot ? <PilotEvaluation report={pilot} /> : <>
    <section className="ministry-profile-facts" aria-labelledby="profile-facts-heading" data-reveal style={{ '--reveal-delay': '120ms' }}>
      <h2 id="profile-facts-heading">{copy.detailsHeading}</h2>
      <dl className="ministry-profile-metadata">
        <div className="ministry-profile-host">
          <dt>{messages.primaryHost}</dt>
          <dd>
            {ministry.domain ? <>
              <a href={`https://${evaluatedHost}`} target="_blank" rel="noreferrer">
                <bdi dir="ltr">{ministry.domain}</bdi><ExternalLink size={16} aria-hidden="true" />
                <span className="sr-only">{messages.newTab}</span>
              </a>
              <span>{messages.unverified}</span>
            </> : messages.unresolvedHost}
          </dd>
        </div>
        <div><dt>{messages.overall}</dt><dd>{messages.overallUnavailable}</dd></div>
        <div><dt>{messages.coverage}</dt><dd>{messages.coverageUnavailable}</dd></div>
        <div><dt>{messages.observationDate}</dt><dd>{messages.dateUnavailable}</dd></div>
        <div><dt>{messages.evidence}</dt><dd>{messages.evidenceUnavailable}</dd></div>
        <div><dt>{messages.referenceDate}</dt><dd>{messages.reference(date('2026-09-03'))}</dd></div>
      </dl>
    </section>

    <section className="ministry-profile-categories" aria-labelledby="profile-categories-heading" data-reveal>
      <div className="ministry-profile-section-heading">
        <h2 id="profile-categories-heading">{messages.evaluationCategories}</h2>
        <p>{messages.categoriesNotice}</p>
      </div>
      <dl className="ministry-profile-category-grid">
        {categories.map((key, index) => <div className="ministry-profile-category" key={key}>
          <dt><span aria-hidden="true" className="ministry-profile-category-number">{number(index + 1)}</span>{messages.categories[key]}</dt>
          <dd><strong>{messages.notMeasured}</strong><span>{messages.possiblePoints(number(categoryMax[key]))}</span></dd>
        </div>)}
      </dl>
    </section>

    </>}
    <section className="ministry-profile-source" aria-labelledby="profile-source-heading">
      <div><h2 id="profile-source-heading">{copy.sourceHeading}</h2><p>{messages.profileSource}</p></div>
      <div className="ministry-profile-source-links">
        <Link to="/#methodology">{copy.methodologyLink}<ArrowUpRight size={16} aria-hidden="true" /></Link>
        <a href={reportHref} hrefLang={reportLanguage} target="_blank" rel="noreferrer">{messages.readMethodology} ({messages.pdfLanguage[reportLanguage]})<ExternalLink size={15} aria-hidden="true" /><span className="sr-only">{messages.newTab}</span></a>
      </div>
    </section>
  </main>
}
