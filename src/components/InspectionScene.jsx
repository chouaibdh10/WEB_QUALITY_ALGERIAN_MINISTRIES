import { useState } from 'react'
import { ArrowUpRight, Fingerprint, Gauge, Shield } from 'lucide-react'
import { usePreferences } from '../Preferences'
import '../inspection.css'

const copy = {
  en: { title: 'Beneath the surface.', subtitle: 'Seven dimensions. One view of the public web.', schematic: 'Public website · schematic', browser: 'The public web', labels: ['Performance', 'Accessibility', 'Security'], unit: 'out of 100', points: 'points', notes: ['Loading speed, responsiveness and visual stability. Repeated mobile and desktop tests turn observations into evidence.', 'Keyboard access, readable contrast and meaningful alternatives. Automated checks are paired with manual review.', 'HTTPS, response policies and cookie protection. Publicly observable checks, with a clear record of what remains untested.'], evidence: 'Explore the framework', provisional: 'Example scores · not measured results', illustration: 'Illustration of the 100-point public website evaluation framework' },
  fr: { title: 'Au-delà des apparences.', subtitle: 'Sept dimensions. Une vue du web public.', schematic: 'Site public · schéma', browser: 'Le web public', labels: ['Performance', 'Accessibilité', 'Sécurité'], unit: 'sur 100', points: 'points', notes: ['Vitesse, réactivité et stabilité visuelle. Des tests répétés sur mobile et ordinateur transforment les observations en preuves.', 'Navigation au clavier, contraste lisible et alternatives utiles. Les tests automatisés sont complétés par une revue manuelle.', 'HTTPS, politiques de réponse et protection des cookies. Des contrôles publics, avec des limites de mesure explicites.'], evidence: 'Explorer le référentiel', provisional: 'Notes illustratives · résultats non mesurés', illustration: 'Illustration du référentiel d’évaluation des sites publics sur 100 points' },
  ar: { title: 'ما وراء الواجهة.', subtitle: 'سبعة أبعاد. رؤية واحدة للويب العمومي.', schematic: 'موقع عمومي · رسم توضيحي', browser: 'الويب العمومي', labels: ['الأداء', 'إمكانية الوصول', 'الأمن'], unit: 'من ١٠٠', points: 'نقطة', notes: ['سرعة التحميل والاستجابة والثبات البصري. اختبارات متكررة على الهاتف والحاسوب تحوّل الملاحظات إلى أدلة.', 'التنقل بلوحة المفاتيح وتباين مقروء وبدائل مفيدة. نجمع بين الفحوص الآلية والمراجعة اليدوية.', 'HTTPS وسياسات الاستجابة وحماية ملفات الارتباط. فحوص متاحة للعموم مع توضيح ما لم يُختبر بعد.'], evidence: 'استكشف إطار التقييم', provisional: 'نتائج توضيحية · وليست قياسات فعلية', illustration: 'رسم توضيحي لإطار تقييم المواقع العمومية من ١٠٠ نقطة' },
}

export default function InspectionScene() {
  const [selected, setSelected] = useState(0)
  const { language, number } = usePreferences()
  const t = copy[language]
  const examples = [92, 77, 43]
  return <aside className="inspection-scene" aria-label={t.title} data-reveal style={{ '--reveal-delay': '160ms' }}>
    <h2>{t.title}</h2><p className="inspection-subtitle">{t.subtitle}</p>
    <div className={`inspection-art inspection-mode-${selected}`} role="img" aria-label={t.illustration}>
      <div className="inspection-browser" aria-hidden="true">
        <div className="inspection-browser-bar"><span>•••</span><span>{t.browser}</span><span>↗</span></div>
        <div className="inspection-wire-site"><div className="wire-nav"><i /><b /><b /><b /></div><div className="wire-feature"><div><i /><i /><i /><b /></div><span><Fingerprint size={45} strokeWidth={.8} /></span></div><div className="wire-columns"><i /><i /><i /></div><div className="wire-lines"><i /><i /></div></div>
        <span className="inspection-schematic">{t.schematic}</span>
      </div>
      <div className="inspection-guide" aria-hidden="true"><span /><span /></div>
      <div className="inspection-lens" aria-hidden="true"><div className="inspection-lens-inner"><span className="lens-cross">+</span><strong key={selected}>{number(examples[selected])}</strong><span>{t.unit}</span><span className="lens-cross">+</span></div></div>
      <div className="inspection-marker" aria-hidden="true"><span />{t.labels[selected]}</div>
    </div>
    <div className="inspection-controls" role="group" aria-label={t.subtitle}>
      {[Gauge, Fingerprint, Shield].map((Icon, index) => <button type="button" key={index} aria-pressed={selected === index} aria-controls="inspection-finding" onClick={() => setSelected(index)}><Icon size={15} aria-hidden="true" />{t.labels[index]}</button>)}
    </div>
    <div className="inspection-finding" id="inspection-finding" aria-live="polite"><span>{t.labels[selected]}</span><p>{t.notes[selected]}</p></div>
    <div className="inspection-foot"><a href="#categories">{t.evidence}<ArrowUpRight size={17} aria-hidden="true" /></a><small>{t.provisional}</small></div>
  </aside>
}
