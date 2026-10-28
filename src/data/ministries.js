// Public directory; domain seeds originate from the September discovery appendix.
// Two entries without a verified website were excluded at the user’s request on 21 October 2026.
// Published provisional measurements and ownership evidence are maintained separately.
const discoveryCorpus = [
  ['foreign-affairs', 'Foreign Affairs', 'mfa.gov.dz'],
  ['national-defence', 'National Defence', 'mdn.dz'],
  ['hydrocarbons', 'Hydrocarbons', 'oilmines.gov.dz'],
  ['interior-local-authorities-transport', 'Interior, local authorities and transport', 'interieur.gov.dz'],
  ['justice', 'Justice', 'mjustice.gov.dz'],
  ['finance', 'Finance', 'mf.gov.dz'],
  ['higher-education', 'Higher education', 'mesrs.dz'],
  ['national-education', 'National education', 'education.gov.dz'],
  ['health', 'Health', 'sante.gov.dz'],
  ['moudjahidine-rights-holders', 'Moudjahidine and rights holders', 'mmad.gov.dz'],
  ['industry', 'Industry', 'industrie.gov.dz'],
  ['pharmaceutical-industry', 'Pharmaceutical industry', 'miph.gov.dz'],
  ['agriculture-rural-development-fisheries', 'Agriculture, rural development and fisheries', 'madr.gov.dz'],
  ['energy-renewable-energies', 'Energy and renewable energies', 'energy.gov.dz'],
  ['foreign-trade-export-promotion', 'Foreign trade and export promotion', 'mcepe.gov.dz'],
  ['internal-trade-market-regulation', 'Internal trade and market regulation', 'commerce.gov.dz'],
  ['housing-spatial-planning', 'Housing and spatial planning', 'mhuv.gov.dz'],
  ['religious-affairs-wakfs', 'Religious affairs and wakfs', 'marw.gov.dz'],
  ['culture-arts', 'Culture and arts', 'm-culture.gov.dz'],
  ['youth', 'Youth', 'mjeunesse.gov.dz'],
  ['post-telecommunications', 'Post and telecommunications', 'mpt.gov.dz'],
  ['knowledge-economy-startups', 'Knowledge economy and start-ups', 'startup.dz'],
  ['communication', 'Communication', 'mcomm.gov.dz'],
  ['vocational-training', 'Vocational training', 'mvet.dz'],
  ['public-works-basic-infrastructure', 'Public works and basic infrastructure', 'mtpib.dz'],
  ['hydraulics', 'Hydraulics', 'mh.gov.dz'],
  ['labour-employment-social-security', 'Labour, employment and social security', 'mtess.gov.dz'],
  ['tourism-handicrafts', 'Tourism and handicrafts', 'mta.gov.dz'],
  ['national-solidarity-family', 'National solidarity and family', 'msnfcf.gov.dz'],
  ['environment-quality-of-life', 'Environment and quality of life', 'me.gov.dz'],
  ['sports', 'Sports', 'msport.gov.dz'],
  ['relations-parliament', 'Relations with Parliament', 'mrp.gov.dz'],
]

export const ministries = discoveryCorpus.map(([id, name, domain]) => ({
  id,
  name,
  domain,
  status: domain ? 'Candidate' : 'Unresolved',
}))

export const categoryMax = { security: 20, performance: 15, accessibility: 15, reliability: 10, mobile: 15, content: 15, technical: 10 }
