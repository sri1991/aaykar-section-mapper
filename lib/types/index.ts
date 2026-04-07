export type ChangeType = 'renumbered' | 'amended' | 'merged' | 'relocated' | 'deleted'

export interface Section {
  id: string
  old_ref: string
  old_title: string
  new_ref: string
  new_title: string
  category: string
  change_type: ChangeType
  limit_changed: boolean
  limit_changed_note: string | null
  plain_english_summary: string
  keywords: string[]
}

export interface Form {
  id: string
  old_form: string
  old_purpose: string
  new_form: string
  new_purpose: string
  related_section_old: string
  related_section_new: string
  change_type: ChangeType
  structural_changes: string
  keywords: string[]
}

export interface TerminologyItem {
  old_term: string
  new_term: string
  note: string
}

export interface MappingData {
  meta: {
    version: string
    generated: string
    source: string
    disclaimer: string
    total_sections: number
    total_forms: number
  }
  terminology: TerminologyItem[]
  sections: Section[]
  forms: Form[]
}

export type ActiveTab = 'sections' | 'forms'
