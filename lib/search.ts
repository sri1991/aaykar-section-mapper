import Fuse from 'fuse.js'
import type { Section, Form, MappingData } from './types'

let _data: MappingData | null = null

export function getData(): MappingData {
  if (!_data) {
    _data = require('./data/mapping.json') as MappingData
  }
  return _data
}

let _sectionFuse: Fuse<Section> | null = null
let _formFuse: Fuse<Form> | null = null

export function getSectionFuse(): Fuse<Section> {
  if (!_sectionFuse) {
    const { sections } = getData()
    _sectionFuse = new Fuse(sections, {
      keys: [
        { name: 'old_ref', weight: 2 },
        { name: 'new_ref', weight: 2 },
        { name: 'old_title', weight: 1.5 },
        { name: 'new_title', weight: 1.5 },
        { name: 'keywords', weight: 1 },
        { name: 'plain_english_summary', weight: 0.8 },
        { name: 'category', weight: 0.5 },
      ],
      threshold: 0.35,
      includeScore: true,
      ignoreLocation: true,
      minMatchCharLength: 2,
    })
  }
  return _sectionFuse
}

export function getFormFuse(): Fuse<Form> {
  if (!_formFuse) {
    const { forms } = getData()
    _formFuse = new Fuse(forms, {
      keys: [
        { name: 'old_form', weight: 2 },
        { name: 'new_form', weight: 2 },
        { name: 'old_purpose', weight: 1.5 },
        { name: 'new_purpose', weight: 1.5 },
        { name: 'keywords', weight: 1 },
        { name: 'structural_changes', weight: 0.8 },
        { name: 'related_section_old', weight: 0.6 },
      ],
      threshold: 0.35,
      includeScore: true,
      ignoreLocation: true,
      minMatchCharLength: 2,
    })
  }
  return _formFuse
}

export const SECTION_CATEGORIES = [
  'All',
  'TDS',
  'TCS',
  'Deductions',
  'Salary',
  'Capital Gains',
  'Business Income',
  'House Property',
  'Audit',
  'Tax Regimes',
  'Assessment & Compliance',
  'Interest & Penalties',
  'Losses',
  'Trusts & NGOs',
  'General',
] as const

export const CHANGE_TYPE_LABELS: Record<string, string> = {
  renumbered: 'Renumbered',
  amended: 'Amended',
  merged: 'Merged',
  relocated: 'Relocated',
  deleted: 'Deleted',
}

export const CHANGE_TYPE_COLORS: Record<string, string> = {
  renumbered: 'bg-blue-50 text-blue-700 border-blue-200',
  amended: 'bg-amber-50 text-amber-700 border-amber-200',
  merged: 'bg-purple-50 text-purple-700 border-purple-200',
  relocated: 'bg-teal-50 text-teal-700 border-teal-200',
  deleted: 'bg-red-50 text-red-700 border-red-200',
}
