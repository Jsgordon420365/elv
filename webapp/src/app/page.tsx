"use client";

import { useState, useEffect } from "react";
import { INDEPENDENT_CONTRACTOR_FIELDS, ELVField } from "@/lib/variables";
import { Info, Save, FileText, CheckCircle, ChevronRight, User, MapPin, Calendar, Briefcase, Gavel, Lock as LockIcon, Loader2 } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { useVault } from "@/lib/VaultContext";
import { UnlockOverlay } from "@/components/UnlockOverlay";
import { backupVaultToServer } from "@/lib/sync";
import { syncToVault } from "@/lib/vault";
import { generateDocument } from "@/lib/generate";

export default function Home() {
  const { masterKey, userId, lock } = useVault();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [activeField, setActiveField] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

  const handleInputChange = (id: string, value: string) => {
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSave = async () => {
    if (!masterKey || !userId) return;

    setIsSaving(true);
    setSaveStatus("idle");
    try {
      // 1. Sync to local IndexedDB (with encryption)
      await syncToVault(formData, masterKey);

      // 2. Backup to server (encrypted blob)
      const result = await backupVaultToServer(
        userId,
        masterKey,
        formData.owner_name || "Unknown Owner"
      );

      if (result.success) {
        setSaveStatus("success");
      } else {
        setSaveStatus("error");
      }
    } catch (e) {
      console.error("Save Error:", e);
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  const categories = Array.from(new Set(INDEPENDENT_CONTRACTOR_FIELDS.map(f => f.category)));

  const getIcon = (category: string) => {
    switch (category) {
      case "Parties": return <User className="w-4 h-4" />;
      case "Timing": return <Calendar className="w-4 h-4" />;
      case "Notices": return <MapPin className="w-4 h-4" />;
      case "Business": return <Briefcase className="w-4 h-4" />;
      case "Legal": return <Gavel className="w-4 h-4" />;
      case "Signatures": return <CheckCircle className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  // Helper to render a field placeholder with styling
  const Placeholder = ({ id, label }: { id: string; label: string }) => {
    const value = formData[id];
    const isActive = activeField === id;

    return (
      <span
        className={cn(
          "inline-block px-1 border-b mx-1 transition-all duration-300",
          value ? "text-indigo-600 font-semibold border-indigo-200" : "text-slate-300 border-dashed border-slate-300 min-w-[60px]",
          isActive && "bg-indigo-50 border-indigo-400 ring-2 ring-indigo-100 rounded-sm"
        )}
      >
        {value || label}
      </span>
    );
  };

  return (
    <main className="flex h-screen bg-[#0a0a0c] text-slate-200 overflow-hidden">
      {/* Sidebar: Variable Form */}
      <div className="w-[450px] border-r border-slate-800 flex flex-col bg-slate-900/40 backdrop-blur-xl">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">ELV Vault Editor</h1>
            <p className="text-xs text-slate-500 mt-1">Independent Contractor Agreement v2017</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={lock}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 transition-all"
              title="Lock Vault"
            >
              <LockIcon className="w-5 h-5" />
            </button>
            <div className="w-px h-8 bg-slate-800 mx-1" />
            <button
              onClick={async () => {
                try {
                  await generateDocument(
                    '/templates/independent-contractor.docx',
                    formData,
                    `ELV_Contractor_Agreement_${formData.owner_name || 'Draft'}.docx`
                  );
                } catch (err: any) {
                  alert(err.message || "Failed to generate document.");
                }
              }}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
              title="Download Document"
            >
              <FileText className="w-5 h-5" />
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={cn(
                "p-2 rounded-lg transition-all duration-300 shadow-lg",
                saveStatus === "success" ? "bg-emerald-500 text-white" : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20",
                isSaving && "opacity-50 cursor-not-allowed"
              )}
              title="Save to Vault"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : saveStatus === "success" ? <CheckCircle className="w-5 h-5" /> : <Save className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {categories.map((cat) => (
            <div key={cat} className="space-y-4">
              <div className="flex items-center gap-2 text-slate-400 px-1">
                {getIcon(cat)}
                <h2 className="text-xs font-semibold uppercase tracking-widest">{cat}</h2>
              </div>
              <div className="space-y-3">
                {INDEPENDENT_CONTRACTOR_FIELDS.filter(f => f.category === cat).map((field) => (
                  <div key={field.id} className="relative group">
                    <label className="block text-[10px] text-slate-500 mb-1 ml-1 font-medium">{field.label}</label>
                    <div className="relative">
                      {field.type === "textarea" ? (
                        <textarea
                          value={formData[field.id] || ""}
                          onChange={(e) => handleInputChange(field.id, e.target.value)}
                          onFocus={() => setActiveField(field.id)}
                          onBlur={() => setActiveField(null)}
                          className="w-full bg-slate-950/50 border border-slate-800 rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all min-h-[80px] resize-none"
                          placeholder="..."
                        />
                      ) : (
                        <input
                          type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                          value={formData[field.id] || ""}
                          onChange={(e) => handleInputChange(field.id, e.target.value)}
                          onFocus={() => setActiveField(field.id)}
                          onBlur={() => setActiveField(null)}
                          className="w-full bg-slate-950/50 border border-slate-800 rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                          placeholder="..."
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Panel: Document Preview */}
      <div className="flex-1 bg-slate-950 p-12 overflow-y-auto relative bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:40px_40px]">
        {/* Active Field Floating Tooltip */}
        {activeField && (
          <div className="fixed top-24 left-[480px] w-64 p-4 bg-indigo-600 text-white rounded-lg shadow-2xl z-50 text-xs animate-in slide-in-from-left-2 duration-300">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <p className="leading-relaxed font-medium">
                {INDEPENDENT_CONTRACTOR_FIELDS.find(f => f.id === activeField)?.tooltip}
              </p>
            </div>
          </div>
        )}

        <div className="max-w-[850px] mx-auto bg-white text-[#1a1c24] p-20 shadow-2xl rounded-sm min-h-[1200px] font-serif leading-relaxed relative text-[15px]">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-100/10 to-transparent pointer-events-none" />

          <h1 className="text-center font-bold underline text-xl mb-12">INDEPENDENT CONTRACTOR AGREEMENT</h1>

          <p className="mb-8">
            THIS AGREEMENT is made by and between <Placeholder id="owner_name" label="OWNER NAME" /> (hereinafter "Owner")
            and <Placeholder id="contractor_name" label="CONTRACTOR NAME" /> (hereinafter "Contractor").
          </p>

          <p className="mb-6 font-bold uppercase">WITNESSETH:</p>

          <p className="mb-6">
            WHEREAS, Owner and Contractor desire to enter into an agreement whereby Contractor will provide services to Owner as an independent contractor;
          </p>

          <p className="mb-6">
            NOW, THEREFORE, for and in consideration of the mutual covenants and agreements contained herein, the parties agree as follows:
          </p>

          <div className="space-y-6">
            <section>
              <p><span className="font-bold">1. Engagement.</span> Owner hereby engages Contractor as an independent contractor, and Contractor hereby accepts such engagement, to provide services to Owner as set forth in the <span className="font-bold underline">Scope of Agreement</span> below.</p>
            </section>

            <section>
              <p><span className="font-bold">2. Term.</span> The term of this Agreement shall commence on <Placeholder id="agreement_start_date" label="START DATE" /> and shall continue for a period of <Placeholder id="agreement_duration_years_text" label="ONE" /> (<Placeholder id="agreement_duration_years_num" label="1" />) year(s), unless terminated earlier as provided herein.</p>
            </section>

            <section>
              <p><span className="font-bold">3. Scope of Agreement.</span> The services to be performed under this Agreement are as follows:</p>
              <div className="mt-4 p-4 border border-slate-100 min-h-[100px] whitespace-pre-wrap italic text-slate-600 bg-slate-50/50 rounded">
                {formData.scope_agr_longtext || "DESCRIPTION OF SCOPE..."}
              </div>
            </section>

            <section>
              <p><span className="font-bold">4. Notices.</span> All notices, requests, demands and other communications required or permitted under this Agreement shall be in writing and shall be deemed to have been duly given if delivered by hand or mailed, certified or registered mail with return receipt requested, to the following addresses:</p>

              <div className="grid grid-cols-2 gap-12 mt-6">
                <div className="space-y-1">
                  <p className="font-bold underline text-sm">OWNER:</p>
                  <p><Placeholder id="owner_add1" label="Address Line 1" /></p>
                  <p><Placeholder id="owner_add2" label="Address Line 2" /></p>
                </div>
                <div className="space-y-1">
                  <p className="font-bold underline text-sm">CONTRACTOR:</p>
                  <p><Placeholder id="contr_add1" label="Address Line 1" /></p>
                  <p><Placeholder id="contr_add2" label="Address Line 2" /></p>
                </div>
              </div>
            </section>

            <section>
              <p><span className="font-bold">5. Governing Law and Choice of Forum.</span> This Agreement shall be governed by and construed in accordance with the laws of the State of North Carolina. The parties agree that any legal action arising out of this Agreement shall be brought in the general courts of justice in <Placeholder id="forum_county_comma_state" label="Cty, State" />.</p>
            </section>

            <section className="mt-20 pt-12">
              <p className="mb-12 italic">IN WITNESS WHEREOF, the parties hereto have executed this Agreement on the dates indicated below.</p>

              <div className="grid grid-cols-2 gap-12">
                <div className="space-y-8">
                  <div className="border-b border-black pb-1">
                    <Placeholder id="owner_signatory_name" label="OWNER SIGNATORY" />
                  </div>
                  <p className="text-xs uppercase font-medium">Owner</p>
                  <div className="flex gap-2 items-end">
                    <span className="text-sm">Date:</span>
                    <div className="border-b border-black flex-1">
                      <Placeholder id="owner_signatory_date" label="00/00/0000" />
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="border-b border-black pb-1">
                    <Placeholder id="contractor_signatory_name" label="CONTRACTOR SIGNATORY" />
                  </div>
                  <p className="text-xs uppercase font-medium">Contractor</p>
                  <div className="flex gap-2 items-end">
                    <span className="text-sm">Date:</span>
                    <div className="border-b border-black flex-1">
                      <Placeholder id="contractor_signatory_date" label="00/00/0000" />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #334155;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-in {
          animation: slideIn 0.3s ease-out forwards;
        }
      `}</style>
      <UnlockOverlay />
    </main>
  );
}
