import { ArrowUpRight, Search, ChevronLeft, ChevronRight, Info, X } from 'lucide-react'
import MinistryLogo from './MinistryLogo'
import MeasurementOverview from './MeasurementOverview'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { usePreferences } from '../Preferences'
import { directoryMessages, normalizeDirectorySearch } from '../directoryMessages'

import { pilotSummaries as pilotEvaluations } from '../data/pilotSummaries'
import { campaignStatus } from '../data/campaignStatus'
import { campaignMessages } from '../campaignMessages'

const filters = ['all', 'measured', 'candidate', 'unresolved']
const pageSize = 10
const sourceDate = '2026-09-03'
const isCandidate = ministry => ministry.status === 'Candidate' && pilotEvaluations[ministry.id]?.ownership?.status !== 'Government directory confirmed'

export default function Results({ ministries, query, setQuery, filter, setFilter, pageNumber, setPageNumber }) {
  const { language, number, date, reportHref, reportLanguage } = usePreferences()
  const messages = directoryMessages[language]
  const campaignCopy = campaignMessages[language]
  const statuses = Object.fromEntries((campaignStatus?.entries ?? []).map(entry => [entry.id, entry.status]))
  const pilotCount = Object.keys(pilotEvaluations).length
  const counts = useMemo(() => ({
    all: ministries.length,
    measured: ministries.filter(ministry => pilotEvaluations[ministry.id]).length,
    candidate: ministries.filter(isCandidate).length,
    unresolved: ministries.filter(ministry => ministry.status === 'Unresolved').length,
  }), [ministries])
  const filtered = useMemo(() => {
    const search = normalizeDirectorySearch(query.trim())
    return ministries.filter(ministry => normalizeDirectorySearch(`${messages.names[ministry.id]} ${ministry.name} ${ministry.domain ?? ''} ${pilotEvaluations[ministry.id]?.website ?? ''}`).includes(search)
      && (filter === 'all' || (filter === 'measured' ? Boolean(pilotEvaluations[ministry.id]) : filter === 'candidate' ? isCandidate(ministry) : ministry.status.toLowerCase() === filter)))
  }, [ministries, query, filter, messages])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(pageNumber, totalPages)
  const first = (currentPage - 1) * pageSize
  const visible = filtered.slice(first, first + pageSize)
  const hasFilters = query !== '' || filter !== 'all'
  const resetFilters = () => { setQuery(''); setFilter('all'); setPageNumber(1) }

  return <section id="results" className="results-section section-pad" aria-labelledby="corpus-heading">
    <div className="results-heading" data-reveal>
      <div><div className="section-kicker">{messages.kicker}</div><h2 id="corpus-heading">{messages.heading[0]}<br className="mobile-break" /> {messages.heading[1]}</h2><p className="corpus-intro">{messages.intro}</p></div>
      <span className="directory-edition"><span /> {messages.edition} <strong>{date(sourceDate)}</strong></span>
    </div>
    <MeasurementOverview reports={pilotEvaluations} onShowAll={() => { setFilter('measured'); setQuery(''); setPageNumber(1); requestAnimationFrame(() => document.getElementById('directory-workspace')?.scrollIntoView({ behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth', block:'start' })) }} />
    <div id="directory-workspace" className="directory-workspace" data-reveal style={{ '--reveal-delay': '120ms' }}>
      <div className="directory-tabs" role="group" aria-label={messages.filterLabel}>
        {filters.filter(value => value !== 'unresolved' || counts.unresolved > 0).map(value => <button type="button" key={value} className={filter === value ? 'active' : ''} aria-pressed={filter === value} aria-controls="corpus-table" onClick={() => { setFilter(value); setPageNumber(1) }}>{messages.filters[value]}<span>{number(counts[value])}</span></button>)}
        <span className="directory-scope">{messages.scope}</span>
      </div>
      <div className="results-toolbar">
        <div className="search-wrap"><Search size={17} aria-hidden="true" /><input type="search" aria-label={messages.searchLabel} aria-controls="corpus-table" value={query} onChange={event => { setQuery(event.target.value); setPageNumber(1) }} placeholder={messages.searchPlaceholder} />{query && <button type="button" className="clear-search" aria-label={messages.clearSearch} onClick={() => { setQuery(''); setPageNumber(1) }}><X size={14} aria-hidden="true" /></button>}</div>
        <span className="directory-pending"><span /> {pilotCount ? ({ en: `${number(pilotCount)} measured pilots · Ranking pending`, fr: `${number(pilotCount)} pilotes mesurés · Classement à venir`, ar: `${number(pilotCount)} تقييمات تجريبية · الترتيب معلق` })[language] : messages.pending}</span>
      </div>
      <div className="corpus-note"><Info size={15} aria-hidden="true" /><p><strong>{messages.noteTitle}</strong> {pilotCount ? ({ en: 'Provisional measurements are published. National evaluation and rankings remain pending; the directory still includes candidate hosts awaiting ownership verification.', fr: 'Des évaluations provisoires sont publiées. L’évaluation nationale et le classement restent à réaliser ; les domaines candidats du répertoire attendent leur vérification.', ar: 'نُشرت تقييمات تجريبية أولية. التقييم الوطني والترتيب لم يكتملا، ولا تزال ملكية النطاقات المرشحة في الدليل قيد التحقق.' })[language] : messages.note(number(counts.candidate), number(counts.unresolved))}</p></div>
      <div className="results-count">
        <p role="status" aria-live="polite" aria-atomic="true">
          {filtered.length ? messages.showing(number(first + 1), number(Math.min(first + pageSize, filtered.length)), number(filtered.length)) : messages.noMatches}
          {query.trim() ? messages.matching(query.trim()) : ''}
          {filter !== 'all' ? ` · ${messages.filters[filter]}` : ''}
        </p>
        {hasFilters && <button type="button" className="reset-button" onClick={resetFilters}>{messages.reset}</button>}
      </div>
      <div className="table-wrap" tabIndex={0} role="region" aria-label={messages.tableLabel}>
        <table id="corpus-table">
          <caption className="sr-only">{messages.caption(date(sourceDate))}</caption>
          <thead><tr><th scope="col">{messages.portfolio}</th><th scope="col">{messages.website}</th><th scope="col">{messages.status}</th><th scope="col"><span className="sr-only">{messages.profile}</span></th></tr></thead>
          <tbody>
            {visible.map(ministry => <tr key={ministry.id}>
              <th scope="row"><div className="ministry-cell"><MinistryLogo id={ministry.id} /><strong>{messages.names[ministry.id]}</strong></div></th>
              <td className="domain-cell" data-label={messages.website}><span className="domain">{pilotEvaluations[ministry.id]?.website || ministry.domain ? <bdi dir="ltr">{pilotEvaluations[ministry.id]?.website ? new URL(pilotEvaluations[ministry.id].website).hostname : ministry.domain}</bdi> : messages.unidentified}</span></td>
              <td className="status-cell" data-label={messages.status}><span className={`status status-${ministry.status.toLowerCase()}`}><i aria-hidden="true" />{pilotEvaluations[ministry.id] ? ({ en: 'Measured pilot', fr: 'Pilote mesuré', ar: 'تقييم تجريبي' })[language] : statuses[ministry.id] ? campaignCopy.labels[statuses[ministry.id]] : messages.statuses[ministry.status]}</span></td>
              <td className="profile-cell"><Link to={`/ministries/${ministry.id}`} className="row-action profile-link" aria-label={messages.profileLabel(messages.names[ministry.id])}>{pilotEvaluations[ministry.id] ? ({ en: 'View measured pilot', fr: 'Voir le pilote mesuré', ar: 'عرض التقييم الفعلي' })[language] : messages.viewProfile} <ArrowUpRight size={15} aria-hidden="true" /></Link></td>
            </tr>)}
            {filtered.length === 0 && <tr><td className="empty-state" colSpan={4}><span className="empty-icon"><Search size={25} aria-hidden="true" /></span><strong>{messages.emptyTitle}</strong><p>{messages.emptyHint}</p><button type="button" className="reset-button" onClick={resetFilters}>{messages.showAll}</button></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="directory-bottom">
        <span>{messages.source(date(sourceDate))}</span>
        <nav className="pagination" aria-label={messages.pages}>
          <button type="button" aria-label={messages.previousPage} disabled={currentPage === 1} onClick={() => setPageNumber(currentPage - 1)}><ChevronLeft size={16} aria-hidden="true" /></button>
          {Array.from({ length: totalPages }, (_, index) => index + 1).map(page => <button type="button" key={page} className={page === currentPage ? 'active' : ''} aria-label={messages.page(number(page))} aria-current={page === currentPage ? 'page' : undefined} onClick={() => setPageNumber(page)}>{number(page)}</button>)}
          <button type="button" aria-label={messages.nextPage} disabled={currentPage === totalPages} onClick={() => setPageNumber(currentPage + 1)}><ChevronRight size={16} aria-hidden="true" /></button>
        </nav>
      </div>
    </div>
    <div className="table-hint"><span>{messages.hint}</span><a href={reportHref} target="_blank" rel="noreferrer">{messages.explore} ({messages.pdfLanguage[reportLanguage]}) <ArrowUpRight size={13} aria-hidden="true" /><span className="sr-only">{messages.newTab}</span></a></div>
  </section>
}
