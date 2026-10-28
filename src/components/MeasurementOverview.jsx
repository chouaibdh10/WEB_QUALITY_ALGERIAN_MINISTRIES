import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import MinistryLogo from './MinistryLogo'
import { usePreferences } from '../Preferences'
import { directoryMessages } from '../directoryMessages'
import '../measurements.css'
import { campaignStatus } from '../data/campaignStatus'

const copy = {
 en: { title: 'Inside the measurements', note: 'Confirmed points on a 100-point framework. Coverage varies; these provisional results are not a ranking.', assessed: 'points assessed', pending: 'pending', earned: 'Earned', missing: 'Not earned', unmeasured: 'Unmeasured', open: 'Read the evidence', revision: 'Download revision record' },
 fr: { title: 'Les mesures en détail', note: 'Points confirmés sur un référentiel de 100 points. La couverture varie ; ces résultats provisoires ne sont pas un classement.', assessed: 'points évalués', pending: 'en attente', earned: 'Acquis', missing: 'Non acquis', unmeasured: 'Non mesurés', open: 'Lire les preuves', revision: 'Télécharger la révision' },
 ar: { title: 'داخل القياسات', note: 'نقاط مثبتة ضمن إطار من ١٠٠ نقطة. تختلف التغطية؛ هذه النتائج الأولية ليست ترتيباً.', assessed: 'نقطة مقيمة', pending: 'قيد الانتظار', earned: 'مكتسبة', missing: 'غير مكتسبة', unmeasured: 'غير مقاسة', open: 'اقرأ الأدلة', revision: 'تنزيل سجل المراجعة' },
}

export default function MeasurementOverview({ reports, onShowAll }) {
 const { language, number } = usePreferences()
 const t = copy[language]
 const allEntries = Object.values(reports).sort((a,b) => (b.labCompletedAt ?? b.completedAt).localeCompare(a.labCompletedAt ?? a.completedAt))
 const entries = allEntries.slice(0,6)
 if (!entries.length) return null
 return <section className="measurement-overview" aria-labelledby="measurement-overview-heading">
  <div className="measurement-overview-heading"><div><h3 id="measurement-overview-heading">{t.title}</h3><p>{t.note}</p></div><a href="/evaluations/results-revision.json" download className="measurement-revision">{t.revision}<ArrowUpRight size={14} aria-hidden="true" /></a></div>
  {campaignStatus && <p className="measurement-campaign-summary">{({ en:`${number(campaignStatus.entries.length)} portfolios accounted for · ${number(campaignStatus.published)} reports · ${number(campaignStatus.inProgress)} in progress · ${number(campaignStatus.collectionGaps)} collection gaps · ${number(campaignStatus.unresolved)} unresolved domains`, fr:`${number(campaignStatus.entries.length)} portefeuilles examinés · ${number(campaignStatus.published)} rapports · ${number(campaignStatus.inProgress)} en cours · ${number(campaignStatus.collectionGaps)} collectes limitées · ${number(campaignStatus.unresolved)} domaines non résolus`, ar:`${number(campaignStatus.entries.length)} حقيبة موثقة · ${number(campaignStatus.published)} تقريراً · ${number(campaignStatus.inProgress)} قيد الإنجاز · ${number(campaignStatus.collectionGaps)} حالات تعذر جمع · ${number(campaignStatus.unresolved)} نطاقات غير محسومة` })[language]} <a href="/evaluations/campaign-status.json" download>{({ en:'Collection record', fr:'Registre de collecte', ar:'سجل جمع الأدلة' })[language]}</a> · <a href="/evaluations/domain-review-2026-10-21.json" download>{({ en:'Website verification archive (English)', fr:'Archives de vérification des sites (anglais)', ar:'أرشيف التحقق من المواقع (بالإنجليزية)' })[language]}</a></p>}
  {campaignStatus?.reportsWithPendingCriteria > 0 && <p className="measurement-campaign-summary">{({en:`${number(campaignStatus.assessedCriteria)} / ${number(campaignStatus.totalCriteria)} criterion entries assessed · ${number(campaignStatus.pendingCriteria)} unmeasured. ${number(campaignStatus.reportsWithPerformanceGaps)} reports have incomplete performance samples.`,fr:`${number(campaignStatus.assessedCriteria)} / ${number(campaignStatus.totalCriteria)} entrées de critères évaluées · ${number(campaignStatus.pendingCriteria)} non mesurées. ${number(campaignStatus.reportsWithPerformanceGaps)} rapports ont des mesures de performance incomplètes.`,ar:`${number(campaignStatus.assessedCriteria)} / ${number(campaignStatus.totalCriteria)} معياراً مقيّماً · ${number(campaignStatus.pendingCriteria)} غير مقاس. ما زالت عينات الأداء غير مكتملة في ${number(campaignStatus.reportsWithPerformanceGaps)} تقارير.`})[language]}{' '}<a href="/evaluations/coverage-review-2026-10-26.json" download>{({en:'Review and remaining checks',fr:'Revue et vérifications restantes',ar:'المراجعة والفحوصات المتبقية'})[language]}</a></p>}
  <div className="measurement-grid" role="region" tabIndex={0} aria-label={t.title}>{entries.map(report => <Link className="measurement-card" to={`/ministries/${report.ministryId}`} key={report.ministryId}>
   <div className="measurement-card-heading"><MinistryLogo id={report.ministryId} /><h4>{directoryMessages[language].names[report.ministryId]}</h4><ArrowUpRight size={17} aria-hidden="true" /></div>
   <strong className="measurement-card-score">{number(report.points)}<small> / {number(100)}</small></strong>
   <div className="measurement-score-track" aria-hidden="true"><i style={{width:`${report.points}%`}} /><i style={{width:`${report.assessedPoints-report.points}%`}} /><i style={{width:`${100-report.assessedPoints}%`}} /></div>
   <p>{number(report.assessedPoints)} {t.assessed}<span> · </span>{number(100-report.assessedPoints)} {t.pending}</p>
   <span className="measurement-card-action">{t.open}<ArrowUpRight size={14} aria-hidden="true" /></span>
  </Link>)}</div>
  <div className="measurement-legend">{[t.earned,t.missing,t.unmeasured].map((label,i)=><span key={label}><i className={`measurement-key measurement-key-${i}`} aria-hidden="true" />{label}</span>)}</div>
 {allEntries.length > 6 && <button type="button" className="measurement-show-all" onClick={onShowAll}>{({ en:`View all ${number(allEntries.length)} reports`, fr:`Voir les ${number(allEntries.length)} rapports`, ar:`عرض جميع التقارير (${number(allEntries.length)})` })[language]}<ArrowUpRight size={16} aria-hidden="true" /></button>}
 </section>
}
