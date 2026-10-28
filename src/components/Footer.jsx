import { ArrowUpRight, ArrowUp, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePreferences } from '../Preferences'
import { contentMessages } from '../contentMessages'
import { interfaceMessages } from '../interfaceMessages'

const footerCopy = {
  en: { purpose: 'A clearer picture of Algeria’s public web.', description: 'An independent research project documenting the quality of ministry websites through a transparent, reproducible framework.', explore: 'Explore the index', research: 'Research & documentation', protocol: 'Download the methodology', context: 'Built in an academic context', note: 'Ministry identities are shown for identification. Their inclusion does not imply endorsement.', edition: '2026 research edition' },
  fr: { purpose: 'Un regard précis sur le web public algérien.', description: 'Un projet de recherche indépendant qui documente la qualité des sites ministériels à travers une méthode transparente et reproductible.', explore: 'Explorer l’indice', research: 'Recherche et documentation', protocol: 'Télécharger la méthodologie', context: 'Un projet dans un cadre universitaire', note: 'Les identités des ministères sont présentées à titre d’identification, sans implication de soutien officiel.', edition: 'Édition de recherche 2026' },
  ar: { purpose: 'صورة أوضح للويب العمومي الجزائري.', description: 'مشروع بحثي مستقل يوثق جودة مواقع الوزارات وفق منهجية شفافة وقابلة لإعادة التطبيق.', explore: 'استكشف المؤشر', research: 'البحث والوثائق', protocol: 'تحميل المنهجية', context: 'مشروع في إطار أكاديمي', note: 'تُعرض هويات الوزارات لأغراض التعريف فقط، ولا يعني إدراجها تأييداً رسمياً.', edition: 'الإصدار البحثي ٢٠٢٦' },
}

export default function Footer() {
  const { language, logoSrc, number, reportHref, reportLanguage } = usePreferences()
  const t = contentMessages[language].footer
  const ui = interfaceMessages[language]
  const copy = footerCopy[language]
  return <footer className="footer editorial-footer">
    <div className="footer-topline"><span>{copy.edition}</span><Link className="footer-top" to="/#home">{t.top}<ArrowUp size={15} aria-hidden="true" /></Link></div>
    <div className="footer-grid">
      <div className="footer-project"><Link className="brand footer-brand" to="/#home" aria-label={ui.home}><img className="brand-logo" src={logoSrc} alt="" width="40" height="40" /><span><strong>{ui.brandTitle} <span>{ui.brandAccent}</span></strong><small>{ui.brandDescriptor} {number(2026)}</small></span></Link><p className="footer-purpose">{copy.purpose}</p><p>{copy.description}</p></div>
      <nav className="footer-link-column" aria-label={copy.explore}><h3>{copy.explore}</h3>{[[ui.directory,'results'],[ui.framework,'categories'],[ui.about,'about']].map(([label,id]) => <Link key={id} to={`/#${id}`}>{label}<ArrowUpRight size={14} aria-hidden="true" /></Link>)}</nav>
      <div className="footer-link-column"><h3>{copy.research}</h3><Link to="/#methodology">{ui.methodology}<ArrowUpRight size={14} aria-hidden="true" /></Link><a href={reportHref} hrefLang={reportLanguage} target="_blank" rel="noreferrer">{copy.protocol}<FileText size={15} aria-hidden="true" /><span className="sr-only">({contentMessages[language].newTab})</span></a></div>
    </div>
    <div className="footer-end"><div><p>{t.disclaimer}</p><p>{copy.note}</p></div><span>{t.year}</span></div>
  </footer>
}
