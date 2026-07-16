// ver 20260714124000.1

export interface ELVField {
    id: string;
    label: string;
    type: "text" | "textarea" | "date" | "number";
    tooltip: string;
    category: string;
    whyWeAsk: string;
}

export const INDEPENDENT_CONTRACTOR_FIELDS: ELVField[] = [
    { id: "owner_name", label: "Business owner legal name", type: "text", tooltip: "The complete legal name of the person or entity hiring the contractor.", category: "Parties", whyWeAsk: "This identifies who is responsible for the owner's promises in the agreement." },
    { id: "contractor_name", label: "Contractor legal name", type: "text", tooltip: "The contractor's complete individual or registered business name.", category: "Parties", whyWeAsk: "This identifies the independent contractor who will provide the services." },
    { id: "owner_business_description", label: "Owner business description", type: "textarea", tooltip: "A short, plain description of the owner's business activities.", category: "Business", whyWeAsk: "The agreement uses this context to describe the parties and the engagement." },
    { id: "scope_agr_longtext", label: "Scope of services", type: "textarea", tooltip: "Describe the services, deliverables, and important limits with enough detail to avoid guesswork.", category: "Business", whyWeAsk: "A concrete scope helps both parties understand the work the contractor agreed to perform." },
    { id: "agreement_start_date", label: "Agreement start date", type: "date", tooltip: "The date on which the agreement becomes effective.", category: "Timing", whyWeAsk: "The start date anchors the agreement's duration and related deadlines." },
    { id: "agreement_duration_years_text", label: "Agreement duration in words", type: "text", tooltip: "Spell out the duration, such as One.", category: "Timing", whyWeAsk: "The template states the duration in words as a cross-check against the number." },
    { id: "agreement_duration_years_num", label: "Agreement duration in years", type: "number", tooltip: "Enter the same duration as a number, such as 1.", category: "Timing", whyWeAsk: "The numeric duration makes the agreement term precise." },
    { id: "termination_notice_days", label: "Termination notice days", type: "number", tooltip: "The number of days' advance notice required to end the agreement.", category: "Timing", whyWeAsk: "This sets the notice deadline either party must follow before termination." },
    { id: "owner_add1", label: "Owner address line 1", type: "text", tooltip: "Street address and suite or unit for the owner.", category: "Notices", whyWeAsk: "The agreement needs a reliable address for notices to the owner." },
    { id: "owner_add2", label: "Owner address line 2", type: "text", tooltip: "City, state, and ZIP code for the owner.", category: "Notices", whyWeAsk: "This completes the owner's notice address." },
    { id: "contr_add1", label: "Contractor address line 1", type: "text", tooltip: "Street address and suite or unit for the contractor.", category: "Notices", whyWeAsk: "The agreement needs a reliable address for notices to the contractor." },
    { id: "contr_add2", label: "Contractor address line 2", type: "text", tooltip: "City, state, and ZIP code for the contractor.", category: "Notices", whyWeAsk: "This completes the contractor's notice address." },
    { id: "forum_county_comma_state", label: "Forum county and state", type: "text", tooltip: "The selected North Carolina county followed by North Carolina, such as Guilford County, North Carolina.", category: "Legal", whyWeAsk: "This identifies the forum specified by the recovered template for covered disputes." },
    { id: "arbitration_city", label: "Arbitration city", type: "text", tooltip: "The North Carolina city where arbitration would occur.", category: "Legal", whyWeAsk: "The template requires a defined place for any arbitration proceeding." },
    { id: "arbitration_state", label: "Arbitration state", type: "text", tooltip: "The state where arbitration would occur; this demo supports North Carolina only.", category: "Legal", whyWeAsk: "A location outside North Carolina falls outside this workflow's maintained scope." },
    { id: "court_amended_miles", label: "Court-amended radius in miles", type: "number", tooltip: "The fallback distance a court may use when narrowing a restriction.", category: "Restrictions", whyWeAsk: "The recovered template uses this fallback when a broader restriction is narrowed." },
    { id: "court_amended_years", label: "Court-amended duration in years", type: "number", tooltip: "The fallback duration a court may use when narrowing a restriction.", category: "Restrictions", whyWeAsk: "The recovered template uses this fallback when a longer restriction is narrowed." },
    { id: "hire_away_duration_years_num", label: "Hire-away duration in years", type: "number", tooltip: "Enter the hire-away restriction duration as a number.", category: "Restrictions", whyWeAsk: "This defines how long the template's hire-away restriction lasts." },
    { id: "hire_away_duration_years_text", label: "Hire-away duration in words", type: "text", tooltip: "Spell out the same hire-away duration.", category: "Restrictions", whyWeAsk: "The words provide a cross-check against the numeric duration." },
    { id: "non_compete_duration_years_num", label: "Non-compete duration in years", type: "number", tooltip: "Enter the non-compete duration as a number.", category: "Restrictions", whyWeAsk: "This defines the requested duration of the template's non-compete restriction." },
    { id: "non_compete_duration_years_text", label: "Non-compete duration in words", type: "text", tooltip: "Spell out the same non-compete duration.", category: "Restrictions", whyWeAsk: "The words provide a cross-check against the numeric duration." },
    { id: "non_compete_radius_miles", label: "Non-compete radius in miles", type: "number", tooltip: "The geographic radius used by the non-compete provision.", category: "Restrictions", whyWeAsk: "This defines the geographic reach of the requested restriction." },
    { id: "non_compete_states", label: "Non-compete states", type: "text", tooltip: "List the states covered by the non-compete provision.", category: "Restrictions", whyWeAsk: "This identifies the jurisdictions where the requested restriction would apply." },
    { id: "non_solicit_employees_duration_years_num", label: "Employee non-solicit duration in years", type: "number", tooltip: "Enter the employee non-solicitation duration as a number.", category: "Restrictions", whyWeAsk: "This defines how long the employee non-solicitation provision lasts." },
    { id: "non_solicit_employees_duration_years_text", label: "Employee non-solicit duration in words", type: "text", tooltip: "Spell out the same employee non-solicitation duration.", category: "Restrictions", whyWeAsk: "The words provide a cross-check against the numeric duration." },
    { id: "owner_signatory_name", label: "Owner signatory name", type: "text", tooltip: "The person authorized to sign for the owner.", category: "Signatures", whyWeAsk: "This identifies the individual signing on the owner's behalf." },
    { id: "owner_signatory_title", label: "Owner signatory title or capacity", type: "text", tooltip: "The confirmed title or legal capacity of the person signing for the owner.", category: "Signatures", whyWeAsk: "A business signs through a human whose authority and capacity must be clear." },
    { id: "owner_signatory_date", label: "Owner signature date", type: "date", tooltip: "The date the owner signs the agreement.", category: "Signatures", whyWeAsk: "The completion record needs the owner's signing date." },
    { id: "contractor_signatory_name", label: "Contractor signatory name", type: "text", tooltip: "The individual signing for the contractor.", category: "Signatures", whyWeAsk: "This identifies the individual accepting the agreement for the contractor." },
    { id: "contractor_signatory_title", label: "Contractor signatory title or capacity", type: "text", tooltip: "The confirmed title or capacity of the contractor signatory.", category: "Signatures", whyWeAsk: "This keeps the contracting party separate from the human and capacity used to execute the agreement." },
    { id: "contractor_signatory_date", label: "Contractor signature date", type: "date", tooltip: "The date the contractor signs the agreement.", category: "Signatures", whyWeAsk: "The completion record needs the contractor's signing date." },
    { id: "compensation_terms", label: "Confirmed compensation terms", type: "textarea", tooltip: "The compensation treatment selected and confirmed for this transaction.", category: "Compensation", whyWeAsk: "The agreement must state the selected compensation structure without relying on hidden commission or demo language." },
];

export const INDEPENDENT_CONTRACTOR_FIELD_IDS = INDEPENDENT_CONTRACTOR_FIELDS.map((field) => field.id);

// Version history
// 20260714124000.0 - Completed the 29-field recovered template schema and added plain-language whyWeAsk guidance.
// 20260714124000.1 - Added the three v1.1 fields for separate signatory capacities and explicit compensation terms.
