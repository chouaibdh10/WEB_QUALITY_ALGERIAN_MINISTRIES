import { ArrowDown, ArrowUpRight, ScanLine } from 'lucide-react'

export default function Hero() {
  return <section id="home" className="hero section-pad">
    <div className="hero-grid" />
    <div className="hero-copy reveal"><div className="eyebrow"><span className="pulse-dot" /> Academic research project <span className="eyebrow-line" /></div><h1>Algerian Ministries<br /><span>Web Quality</span> Index <sup>2026</sup></h1><p className="hero-lead">A technical evaluation of the quality of Algerian ministry websites.</p><div className="hero-actions"><a href="#results" className="button button-primary">View results <ArrowUpRight size={17} /></a><a href="#methodology" className="button button-ghost">Explore methodology <ArrowDown size={16} /></a></div></div>
    <div className="hero-art reveal"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-center"><ScanLine size={30} strokeWidth={1.5} /><span>WEB<br />QUALITY</span></div><div className="art-label label-top">01 <span>OBSERVE</span></div><div className="art-label label-bottom">07 <span>CATEGORIES</span></div></div>
    <div className="hero-foot"><span>01 / 08</span><span className="hero-foot-line" /><span>PUBLIC WEB RESEARCH · DZ</span></div>
  </section>
}
