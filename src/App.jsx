import { lazy, Suspense, useEffect, useState } from 'react'
import { matchPath, Route, Routes, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import About from './components/About'
import Categories from './components/Categories'
import Results from './components/Results'
const MinistryProfile = lazy(() => import('./components/MinistryProfile'))
const NotFound = lazy(() => import('./components/MinistryProfile').then(module => ({ default: module.NotFound })))
import Methodology from './components/Methodology'
import Footer from './components/Footer'
import { ministries } from './data/ministries'
import { pageMetadata, usePreferences } from './Preferences'
import { directoryMessages } from './directoryMessages'
import { profileMessages } from './profileMessages'

function LoadingProfile() {
  const { language } = usePreferences()
  return <main id="main-content" tabIndex={-1} className="section-pad" aria-busy="true" style={{ minHeight:'60vh', paddingBlock:60 }}><p role="status">{({ en:'Loading the report…', fr:'Chargement du rapport…', ar:'جارٍ تحميل التقرير…' })[language]}</p></main>
}

function RevealEffects() {
  const { pathname, key } = useLocation()
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    document.documentElement.classList.add('js-reveal')
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed')
        observer.unobserve(entry.target)
      }
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 })
    for (const element of document.querySelectorAll('[data-reveal]:not(.is-revealed)')) observer.observe(element)
    return () => observer.disconnect()
  }, [pathname, key])
  return null
}

function RouteEffects() {
  const { pathname, hash, key } = useLocation()
  const { language } = usePreferences()
  const match = matchPath('/ministries/:id', pathname)
  const ministry = match && ministries.find(entry => entry.id === match.params.id)
  const title = pathname === '/' ? pageMetadata[language].title
    : `${ministry ? directoryMessages[language].names[ministry.id] : profileMessages[language].notFoundKicker} | ${pageMetadata[language].title}`

  useEffect(() => {
    document.title = title
  }, [title])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const main = document.getElementById('main-content')
      const target = hash && document.getElementById(hash.slice(1))
      main?.focus({ preventScroll: true })
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
      if (target) target.scrollIntoView({ block: 'start', behavior })
      else window.scrollTo({ top: 0, behavior })
    })
    return () => cancelAnimationFrame(frame)
  }, [pathname, hash, key])

  return null
}

export default function App() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [pageNumber, setPageNumber] = useState(1)

  return <>
    <RouteEffects />
    <RevealEffects />
    <Navbar />
    <Suspense fallback={<LoadingProfile />}><Routes>
      <Route path="/" element={<main id="main-content" tabIndex={-1}>
        <Hero />
        <Results ministries={ministries} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} pageNumber={pageNumber} setPageNumber={setPageNumber} />
        <About /><Categories /><Methodology /><About compact />
      </main>} />
      <Route path="/ministries/:id" element={<MinistryProfile />} />
      <Route path="*" element={<NotFound />} />
    </Routes></Suspense>
    <Footer />
  </>
}
