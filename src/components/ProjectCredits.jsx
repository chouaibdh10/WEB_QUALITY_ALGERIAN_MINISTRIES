import { ArrowUpRight, GraduationCap } from 'lucide-react'
import { usePreferences } from '../Preferences'
import '../credits.css'

const copy = {
  en: { title: 'Behind the index', intro: 'The people and communities behind this student research project.', school: 'Academic setting', community: 'Cybersecurity community', estin: 'Higher School of Computer Science and Digital Technologies, Béjaïa. The academic setting for this research in the 2026–2027 academic year.', nexus: 'A student cybersecurity club at ESTIN, bringing students together through learning, mentorship and practical security challenges.', visit: 'Discover ESTIN', club: 'Meet Nexus', prepared: 'Research team', supervised: 'Academic supervision' },
  fr: { title: 'Derrière l’indice', intro: 'Les personnes et les communautés qui entourent ce projet de recherche étudiant.', school: 'Cadre universitaire', community: 'Communauté cybersécurité', estin: 'École supérieure en sciences et technologies de l’informatique et du numérique, Béjaïa. Le cadre universitaire de cette recherche pour l’année 2026–2027.', nexus: 'Un club étudiant de cybersécurité à l’ESTIN, qui réunit les étudiants autour de l’apprentissage, du mentorat et de défis pratiques de sécurité.', visit: 'Découvrir l’ESTIN', club: 'Découvrir Nexus', prepared: 'Équipe de recherche', supervised: 'Encadrement universitaire' },
  ar: { title: 'وراء المؤشر', intro: 'الأشخاص والمجتمعات المرتبطة بهذا المشروع البحثي الطلابي.', school: 'الإطار الأكاديمي', community: 'مجتمع الأمن السيبراني', estin: 'المدرسة العليا لعلوم وتكنولوجيات الإعلام الآلي والرقمنة، بجاية. الإطار الأكاديمي لهذا البحث خلال السنة الجامعية ٢٠٢٦–٢٠٢٧.', nexus: 'نادي طلابي للأمن السيبراني في المدرسة، يجمع الطلبة من خلال التعلم والتوجيه والتحديات العملية في مجال الأمن.', visit: 'اكتشف المدرسة', club: 'تعرّف على Nexus', prepared: 'فريق البحث', supervised: 'الإشراف الأكاديمي' },
}
const team = ['Rayane Boucheraine', 'Barkat Taki', 'Boudouh Ahmed Chouaib', 'Telkhoukh Mohamed']

export default function ProjectCredits() {
  const { language } = usePreferences()
  const t = copy[language]
  return <div className="project-credits" aria-labelledby="credits-title">
    <div className="credits-heading" data-reveal><h3 id="credits-title">{t.title}</h3><p>{t.intro}</p></div>
    <div className="credits-institutions" data-reveal>
      <article className="credits-institution">
        <div className="credits-identity"><img className="credits-estin" src="/brand/estin-logo.png" alt="ESTIN" width="120" height="44" /><span>{t.school}</span></div>
        <h4>ESTIN · Béjaïa</h4><p>{t.estin}</p>
        <a href="https://estin.dz/" target="_blank" rel="noreferrer">{t.visit}<ArrowUpRight size={16} aria-hidden="true" /></a>
      </article>
      <article className="credits-institution">
        <div className="credits-identity"><img src="/brand/nexus-security-club.png" alt="Nexus" width="45" height="52" /><span>{t.community}</span></div>
        <h4>Nexus Security Club</h4><p>{t.nexus}</p>
        <a href="https://www.linkedin.com/company/nexus-security-club" target="_blank" rel="noreferrer">{t.club}<ArrowUpRight size={16} aria-hidden="true" /></a>
      </article>
    </div>
    <div className="credits-people" data-reveal>
      <div className="credits-team"><h4>{t.prepared}</h4><ul>{team.map(name => <li key={name}><span className="credits-avatar" aria-hidden="true">{name.split(' ').map(part => part[0]).slice(0, 2).join('')}</span><span lang="en" dir="ltr">{name}</span></li>)}</ul></div>
      <div className="credits-supervisor"><div className="credits-supervisor-heading"><GraduationCap size={18} aria-hidden="true" /><h4>{t.supervised}</h4></div><div className="credits-supervisor-profile"><span className="credits-supervisor-icon" aria-hidden="true"><GraduationCap size={22} /></span><p lang="en" dir="ltr">Azouaou Faicel</p></div></div>
    </div>
  </div>
}
