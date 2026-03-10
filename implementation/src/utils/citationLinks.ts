/**
 * Generate official source links for aviation citations (FAR/AIM/PHAK/AFH/IFH/AC)
 */

/**
 * FAR 91.155 → https://www.ecfr.gov/current/title-14/part-91/section-91.155
 * 14 CFR 91.155 → same
 */
export function farToUrl(citation: string): string | null {
  const match = citation.match(/(?:FAR|14\s*CFR)\s+(\d+)\.(\d+\w*)/i)
  if (!match) return null
  const part = match[1]
  const section = `${part}.${match[2]}`
  return `https://www.ecfr.gov/current/title-14/part-${part}/section-${section}`
}

/**
 * AIM 7-1-2 → https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap7_section_1.html
 */
export function aimToUrl(citation: string): string | null {
  const match = citation.match(/AIM\s+(\d+)-(\d+)(?:-\d+)?/i)
  if (!match) return null
  const chapter = match[1]
  const section = match[2]
  return `https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap${chapter}_section_${section}.html`
}

// PHAK chapter URLs (FAA website)
const PHAK_CHAPTER_URLS: Record<number, string> = {
  1: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak/media/02_phak_ch1.pdf',
  2: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak/media/03_phak_ch2.pdf',
  3: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak/media/04_phak_ch3.pdf',
  4: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak/media/05_phak_ch4.pdf',
  5: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak/media/06_phak_ch5.pdf',
  6: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak/media/07_phak_ch6.pdf',
  7: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak/media/08_phak_ch7.pdf',
  8: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak/media/09_phak_ch8.pdf',
  9: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak/media/10_phak_ch9.pdf',
  10: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak/media/11_phak_ch10.pdf',
  11: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak/media/12_phak_ch11.pdf',
  12: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak/media/13_phak_ch12.pdf',
  13: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak/media/14_phak_ch13.pdf',
  14: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak/media/15_phak_ch14.pdf',
  15: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak/media/16_phak_ch15.pdf',
  16: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak/media/17_phak_ch16.pdf',
  17: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak/media/18_phak_ch17.pdf',
}

/**
 * PHAK Chapter 4 → FAA PDF URL for that chapter
 */
export function phakToUrl(citation: string): string | null {
  const match = citation.match(/PHAK\s+Chapter\s+(\d+)/i)
  if (!match) return null
  const ch = parseInt(match[1])
  return PHAK_CHAPTER_URLS[ch] || 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak'
}

/**
 * AFH Chapter X → FAA AFH page (per-chapter PDFs)
 */
export function afhToUrl(citation: string): string | null {
  const match = citation.match(/AFH\s+Chapter\s+(\d+)/i)
  if (!match) return null
  const ch = parseInt(match[1]).toString().padStart(2, '0')
  return `https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/airplane_handbook/media/afh_chapter_${ch}.pdf`
}

/**
 * IFH Chapter X → FAA IFH page
 */
export function ifhToUrl(citation: string): string | null {
  const match = citation.match(/IFH\s+Chapter\s+(\d+)/i)
  if (!match) return null
  const ch = parseInt(match[1]).toString().padStart(2, '0')
  return `https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/instrument_procedures_handbook/media/ifh_chapter_${ch}.pdf`
}

/**
 * AC 00-6B → https://www.faa.gov/regulations_policies/advisory_circulars/index.cfm/go/document.information/documentID/1029851
 * Simplified: link to AC search for that number
 */
export function acToUrl(citation: string): string | null {
  const match = citation.match(/AC\s+([\d]+-[\w]+)/i)
  if (!match) return null
  const num = match[1]
  return `https://rgl.faa.gov/Regulatory_and_Guidance_Library/rgAdvisoryCircular.nsf/0/by+subject?openview&query=${encodeURIComponent(num)}`
}

/**
 * Get the link URL for any citation string
 */
export function citationToUrl(citation: string): string | null {
  if (/(?:FAR|14\s*CFR)/i.test(citation)) return farToUrl(citation)
  if (/^AIM\s/i.test(citation)) return aimToUrl(citation)
  if (/^PHAK\s/i.test(citation)) return phakToUrl(citation)
  if (/^AFH\s/i.test(citation)) return afhToUrl(citation)
  if (/^IFH\s/i.test(citation)) return ifhToUrl(citation)
  if (/^AC\s/i.test(citation)) return acToUrl(citation)
  if (/ACS$/i.test(citation)) return 'https://www.faa.gov/training_testing/testing/acs'
  return null
}
