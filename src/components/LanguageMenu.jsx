import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const languages = [['en', 'English', 'EN'], ['fr', 'Français', 'FR'], ['ar', 'العربية', 'AR']]

export default function LanguageMenu({ language, onChange, label }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const trigger = useRef(null)
  const items = useRef([])
  useEffect(() => {
    if (!open) return
    items.current[languages.findIndex(([code]) => code === language)]?.focus()
    const dismiss = event => { if (!root.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open, language])
  const close = () => { setOpen(false); trigger.current?.focus() }
  const navigate = event => {
    const index = items.current.indexOf(document.activeElement)
    const next = event.key === 'ArrowDown' ? (index + 1) % 3 : event.key === 'ArrowUp' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : null
    if (next !== null) { event.preventDefault(); items.current[next]?.focus() }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
    if (event.key === 'Tab') setOpen(false)
  }
  return <div className="language-menu" ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <button ref={trigger} id="language-switcher" className="language-trigger" type="button" aria-label={`${label}: ${languages.find(([code]) => code === language)[1]}`} aria-haspopup="menu" aria-expanded={open} aria-controls="language-options" onClick={() => setOpen(!open)} onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true) } }}><span lang={language}>{languages.find(([code]) => code === language)[1]}</span><ChevronDown size={14} aria-hidden="true" /></button>
    {open && <div id="language-options" className="language-options" role="menu" aria-label={label} onKeyDown={navigate}>
      {languages.map(([code, name, short], index) => <button type="button" role="menuitemradio" aria-checked={language === code} tabIndex={-1} ref={el => { items.current[index] = el }} key={code} onClick={() => { onChange(code); close() }}><span className="language-code">{short}</span><span lang={code} dir="auto">{name}</span>{language === code && <Check size={15} aria-hidden="true" />}</button>)}
    </div>}
  </div>
}
