export interface ELVField {
    id: string;
    label: string;
    type: "text" | "textarea" | "date" | "number";
    tooltip: string;
    category: string;
}

export const INDEPENDENT_CONTRACTOR_FIELDS: ELVField[] = [
    { id: "owner_name", label: "Owner Name", type: "text", tooltip: "Legal name of the entity or individual hiring the contractor.", category: "Parties" },
    { id: "contractor_name", label: "Contractor Name", type: "text", tooltip: "Full legal name or business name of the contractor.", category: "Parties" },
    { id: "agreement_start_date", label: "Start Date", type: "date", tooltip: "The date the agreement becomes effective.", category: "Timing" },
    { id: "agreement_duration_years_text", label: "Duration (Text)", type: "text", tooltip: "Duration of the agreement spelled out (e.g., 'One').", category: "Timing" },
    { id: "agreement_duration_years_num", label: "Duration (Number)", type: "number", tooltip: "Duration of the agreement in digits (e.g., '1').", category: "Timing" },
    { id: "scope_agr_longtext", label: "Scope of Work", type: "textarea", tooltip: "Detailed description of the services provided.", category: "Business" },
    { id: "owner_add1", label: "Owner Address Line 1", type: "text", tooltip: "Primary address for notices (Street, Suite).", category: "Notices" },
    { id: "owner_add2", label: "Owner Address Line 2", type: "text", tooltip: "Secondary address details (City, State, Zip).", category: "Notices" },
    { id: "contr_add1", label: "Contractor Address Line 1", type: "text", tooltip: "Contractor's primary notice address.", category: "Notices" },
    { id: "contr_add2", label: "Contractor Address Line 2", type: "text", tooltip: "Contractor's secondary address details.", category: "Notices" },
    { id: "forum_county_comma_state", label: "Forum (County, State)", type: "text", tooltip: "Location where legal disputes will be resolved (e.g. Guilford, North Carolina).", category: "Legal" },
    { id: "owner_signatory_name", label: "Owner Signatory", type: "text", tooltip: "Name of the person signing on behalf of the Owner.", category: "Signatures" },
    { id: "owner_signatory_date", label: "Owner Sign Date", type: "date", tooltip: "Date of signature for the Owner.", category: "Signatures" },
    { id: "contractor_signatory_name", label: "Contractor Signatory", type: "text", tooltip: "Name of the person signing for the Contractor.", category: "Signatures" },
    { id: "contractor_signatory_date", label: "Contractor Sign Date", type: "date", tooltip: "Date of signature for the Contractor.", category: "Signatures" }
];
