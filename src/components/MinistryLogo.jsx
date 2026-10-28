import { useState } from 'react'
import { ministryIdentities } from '../data/ministryIdentities'

export default function MinistryLogo({ id, large = false }) {
  const identity = ministryIdentities[id]
  const [failed, setFailed] = useState(false)
  return <span className={`ministry-identity${large ? ' ministry-identity-large' : ''}${!identity || failed ? ' identity-pending' : ''}`} aria-hidden="true">
    {identity && !failed ? <img src={identity.asset} alt="" loading={large ? 'eager' : 'lazy'} decoding="async" width="64" height="64" onError={() => setFailed(true)} /> : <span>—</span>}
  </span>
}
