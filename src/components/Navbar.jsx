import LanguageMenu from './LanguageMenu'
import { ArrowUpRight, Menu, Moon, Sun, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { usePreferences } from '../Preferences'
import { interfaceMessages } from '../interfaceMessages'

export default function Navbar() {
  const { language, setLanguage, theme, setTheme, reportHref, logoSrc, number } = usePreferences()
  const copy = interfaceMessages[language]
  const { pathname } = useLocation()
  const [activeSection, setActiveSection] = useState(null)
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const menuRef = useRef(null)
  const headerRef = useRef(null)
  const links = [[copy.directory, 'results'], [copy.project, 'evaluation'], [copy.framework, 'categories'], [copy.methodology, 'methodology'], [copy.about, 'about']]
  useEffect(() => {
    const header = headerRef.current
    const updateHeight = () => document.documentElement.style.setProperty('--header-height', `${header.getBoundingClientRect().height}px`)
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(header)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    let frame = 0
    const sections = ['home', 'results', 'evaluation', 'categories', 'methodology', 'about']
      .map(id => document.getElementById(id)).filter(Boolean)
    const update = () => {
      frame = 0
      setScrolled(window.scrollY > 8)
      if (pathname !== '/') {
        setActiveSection(pathname.startsWith('/ministries/') ? 'results' : null)
        return
      }
      const readingLine = headerRef.current.getBoundingClientRect().bottom + 80
      let current = null
      for (const section of sections) {
        if (section.getBoundingClientRect().top > readingLine) break
        current = section.id
      }
      setActiveSection(current === 'home' ? null : current)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    const observer = new ResizeObserver(schedule)
    const main = document.getElementById('main-content')
    if (main) observer.observe(main)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [pathname])
  useEffect(() => {
    if (!open) return
    const closeOnEscape = event => {
      if (event.key === 'Escape') { setOpen(false); menuRef.current?.focus() }
    }
    const closeOnWideScreen = () => { if (window.innerWidth > 1120) setOpen(false) }
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', closeOnWideScreen)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', closeOnWideScreen)
    }
  }, [open])
  const themeAction = theme === 'dark' ? copy.light : copy.dark
  return <header ref={headerRef} className={`site-header ${scrolled ? 'is-scrolled' : ''}`}>
    <a href="#main-content" className="skip-link">{copy.skip}</a>
    <nav className="nav-shell" aria-label={copy.navigation}>
      <Link className="brand" to="/#home" onClick={() => setOpen(false)} aria-label={copy.home}><img className="brand-logo" src={logoSrc} alt="" width="48" height="48" /><span><strong>{copy.brandTitle} <span>{copy.brandAccent}</span></strong><small>{copy.brandDescriptor} <em>{number(2026)}</em></small></span></Link>
      <div id="main-navigation" className={`nav-links ${open ? 'is-open' : ''}`}>{links.map(([label, id]) => <Link key={id} to={`/#${id}`} aria-current={activeSection === id ? 'location' : undefined} onClick={() => setOpen(false)}>{label}</Link>)}<a className="nav-cta" href={reportHref} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>{copy.readFramework} <ArrowUpRight size={16} /><span className="sr-only"> ({copy.newTab})</span></a></div>
      <div className="nav-controls" role="group" aria-label={copy.themeGroup}>
        <LanguageMenu language={language} label={copy.language} onChange={value => { setLanguage(value); setOpen(false) }} />
        <button type="button" id="theme-toggle" className="theme-toggle" title={themeAction} aria-label={themeAction} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
      </div>
      <button ref={menuRef} type="button" className="menu-button" aria-label={open ? copy.closeMenu : copy.openMenu} aria-expanded={open} aria-controls="main-navigation" onClick={() => setOpen(!open)}>{open ? <X size={22} /> : <Menu size={22} />}</button>
    </nav>
  </header>
}
