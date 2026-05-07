export type ChangeType = "renumbered" | "merged" | "relocated" | "amended" | "deleted";

export type RelationshipType =
  | 'READ_WITH'
  | 'GOVERNED_BY'
  | 'FORM_REQUIRED'
  | 'EXEMPTION_AVAILABLE'
  | 'AGGREGATE_CAP_SHARED';

export interface SectionVariant {
  id: string;
  label: string;
  conditions: {
    taxpayer_type?: string[];
    asset_type?: string;
    holding_period?: string;
    regime?: 'new' | 'old' | 'both';
  };
  tax_treatment: string;
  applicable_sections?: string[];
  caveat?: string | null;
}

export interface SectionRelationship {
  type: RelationshipType;
  target_section_id: string;
  target_ref: string;
  target_title: string;
  note: string;
}

export interface SourceText {
  act_2025: {
    section_header: string;
    main_provision: string;
    sub_sections?: Record<string, string>;
    provisos?: string[];
    explanations?: Record<string, string>;
  };
  pdf_source: string;
  pdf_page: number;
  extraction_date: string;
}

export interface Section {
  id: string;
  old_ref: string;
  old_title: string;
  new_ref: string;
  new_title: string;
  category: string;
  change_type: ChangeType;
  limit_changed: boolean;
  limit_changed_note: string | null;
  old_limit: number | null;
  new_limit: number | null;
  impact_category: 'deduction' | 'exemption' | 'rebate' | 'tds_threshold' | 'tcs_threshold' | 'audit_threshold' | 'rate' | null;
  plain_english_summary: string;
  keywords: string[];
  variants?: SectionVariant[];
  relationships?: SectionRelationship[];
  source_text?: SourceText;
  source_text_available?: boolean;
  cbdt_verified?: boolean;
  verified_date?: string;
}

export interface Form {
  id: string;
  old_form: string;
  old_purpose: string;
  new_form: string;
  new_purpose: string;
  related_section_old: string;
  related_section_new: string;
  change_type: ChangeType;
  structural_changes: string;
  keywords: string[];
}

// Alias for backwards compatibility
export type TaxForm = Form;

export interface TerminologyItem {
  old_term: string;
  new_term: string;
  note: string;
}

export interface MappingData {
  meta: {
    version: string;
    generated: string;
    source: string;
    disclaimer: string;
    total_sections: number;
    total_forms: number;
  };
  terminology: TerminologyItem[];
  sections: Section[];
  forms: TaxForm[];
}
