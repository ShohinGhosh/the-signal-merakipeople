import React, { useState, useEffect } from 'react';
import { Link2, Plus, X, MessageSquare } from 'lucide-react';
import { pipelineAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import EmptyState from '../components/shared/EmptyState';
import { PIPELINE_STAGES } from '../types';
import type { Lead } from '../types';

const STAGE_COLORS: Record<string, string> = {
  RADAR: '#6B7280',
  CONTACTED: '#3B82F6',
  CONVERSATION: '#8B5CF6',
  DEMO_DONE: '#F59E0B',
  PROPOSAL: '#F97316',
  NEGOTIATING: '#EC4899',
  SIGNED: '#10B981',
  LOST: '#EF4444',
};

export default function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      setLoading(true);
      const { data } = await pipelineAPI.list();
      setLeads(data.leads || data || []);
    } catch (err) {
      console.error('Failed to load pipeline:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateStage = async (leadId: string, stage: string) => {
    try {
      await pipelineAPI.update(leadId, { stage });
      loadLeads();
    } catch (err) {
      console.error('Failed to update lead:', err);
    }
  };

  if (!loading && leads.length === 0 && !showAddForm) {
    return (
      <EmptyState
        icon={<Link2 size={48} />}
        title="No leads tracked"
        description="The first one is always the hardest."
        action={{ label: 'Add a lead', onClick: () => setShowAddForm(true) }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Pipeline</h1>
        <div className="flex gap-2">
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setView('kanban')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                view === 'kanban' ? 'bg-brand-coral text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Kanban
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                view === 'list' ? 'bg-brand-coral text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              List
            </button>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-1.5 bg-brand-coral text-white rounded-lg text-sm flex items-center gap-1 shadow-sm hover:bg-brand-coral/90 transition-colors"
          >
            <Plus size={14} /> Add Lead
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : view === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PIPELINE_STAGES.filter((s) => s !== 'LOST').map((stage) => {
            const stageLeads = leads.filter((l) => l.stage === stage);
            return (
              <div
                key={stage}
                className="min-w-[220px] flex-shrink-0 bg-slate-50 rounded-xl p-3 border border-slate-200/60"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: STAGE_COLORS[stage] }}
                  />
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {stage.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-slate-300 ml-auto">{stageLeads.length}</span>
                </div>
                <div className="space-y-2">
                  {stageLeads.map((lead) => (
                    <div
                      key={lead._id}
                      onClick={() => setSelectedLead(lead)}
                      className="bg-white rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow border border-slate-200/60 shadow-sm"
                    >
                      <div className="text-sm font-medium text-slate-900">{lead.companyName || 'Unnamed'}</div>
                      <div className="text-xs text-slate-500">{lead.contactName}</div>
                      {lead.dealValue > 0 && (
                        <div className="text-xs text-brand-coral mt-1 font-mono">
                          {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(lead.dealValue)}
                        </div>
                      )}
                      <div className="text-xs text-slate-300 mt-1 capitalize">{lead.source?.replace('_', ' ')}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-slate-200/60 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 text-xs uppercase tracking-wider">
                <th className="text-left p-3">Company</th>
                <th className="text-left p-3">Contact</th>
                <th className="text-left p-3">Stage</th>
                <th className="text-left p-3">Value</th>
                <th className="text-left p-3">Source</th>
                <th className="text-left p-3">Owner</th>
                <th className="text-left p-3">Next Action</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead._id}
                  onClick={() => setSelectedLead(lead)}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="p-3 font-medium text-slate-900">{lead.companyName}</td>
                  <td className="p-3 text-slate-500">{lead.contactName}</td>
                  <td className="p-3">
                    <span
                      className="px-2 py-0.5 rounded-full text-xs"
                      style={{
                        backgroundColor: `${STAGE_COLORS[lead.stage]}20`,
                        color: STAGE_COLORS[lead.stage],
                      }}
                    >
                      {lead.stage.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-xs text-slate-700">
                    {lead.dealValue > 0
                      ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(lead.dealValue)
                      : '—'}
                  </td>
                  <td className="p-3 text-slate-500 capitalize">{lead.source?.replace('_', ' ')}</td>
                  <td className="p-3 capitalize text-slate-700">{lead.owner}</td>
                  <td className="p-3 text-slate-500 text-xs">{lead.nextAction || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Lead Detail Modal */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={loadLeads}
        />
      )}

      {/* Add Lead Form Modal */}
      {showAddForm && (
        <AddLeadModal onClose={() => setShowAddForm(false)} onCreated={loadLeads} />
      )}
    </div>
  );
}

function LeadDetailModal({
  lead,
  onClose,
  onUpdate,
}: {
  lead: Lead;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [draftingOutreach, setDraftingOutreach] = useState(false);
  const [outreachDraft, setOutreachDraft] = useState('');

  const handleDraftOutreach = async (channel: string) => {
    setDraftingOutreach(true);
    try {
      const { data } = await pipelineAPI.draftOutreach(lead._id, channel);
      setOutreachDraft(data.message || data.draft || '');
    } catch (err) {
      console.error('Draft failed:', err);
    } finally {
      setDraftingOutreach(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">{lead.companyName || 'Lead Details'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-slate-400 text-xs">Contact</span>
              <p className="text-slate-900">{lead.contactName || '—'}</p>
            </div>
            <div>
              <span className="text-slate-400 text-xs">Role</span>
              <p className="text-slate-900">{lead.contactRole || '—'}</p>
            </div>
            <div>
              <span className="text-slate-400 text-xs">Vertical</span>
              <p className="text-slate-900">{lead.vertical || '—'}</p>
            </div>
            <div>
              <span className="text-slate-400 text-xs">Deal Value</span>
              <p className="font-mono text-slate-900">
                {lead.dealValue > 0
                  ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(lead.dealValue)
                  : '—'}
              </p>
            </div>
          </div>

          {/* Draft Outreach */}
          <div>
            <p className="text-xs text-slate-400 mb-2">AI Outreach Draft</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleDraftOutreach('linkedin_dm')}
                disabled={draftingOutreach}
                className="px-3 py-1.5 bg-slate-100 text-slate-500 rounded text-xs hover:bg-slate-200 flex items-center gap-1 transition-colors"
              >
                <MessageSquare size={12} /> LinkedIn DM
              </button>
              <button
                onClick={() => handleDraftOutreach('email')}
                disabled={draftingOutreach}
                className="px-3 py-1.5 bg-slate-100 text-slate-500 rounded text-xs hover:bg-slate-200 flex items-center gap-1 transition-colors"
              >
                <MessageSquare size={12} /> Email
              </button>
            </div>
            {draftingOutreach && <p className="text-xs text-slate-300 mt-2">Generating...</p>}
            {outreachDraft && (
              <div className="mt-2 bg-slate-50 rounded-lg p-3 text-sm text-slate-700 whitespace-pre-wrap border border-slate-200/60">
                {outreachDraft}
              </div>
            )}
          </div>

          {/* Notes */}
          {lead.notes?.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 mb-2">Notes</p>
              <div className="space-y-2">
                {lead.notes.map((note, i) => (
                  <div key={i} className="bg-slate-50 rounded p-2 text-xs border border-slate-100">
                    <p className="text-slate-600">{note.text}</p>
                    <p className="text-slate-300 mt-1">
                      {note.author} — {new Date(note.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AddLeadModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    companyName: '',
    contactName: '',
    contactRole: '',
    source: 'direct',
    vertical: '',
    dealValue: 0,
    owner: user?.role || 'shohini',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await pipelineAPI.create(form);
      onCreated();
      onClose();
    } catch (err) {
      console.error('Failed to create lead:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Add Lead</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {[
            { key: 'companyName', label: 'Company', placeholder: 'Company name' },
            { key: 'contactName', label: 'Contact', placeholder: 'Contact person' },
            { key: 'contactRole', label: 'Role', placeholder: 'e.g., VP Sales' },
            { key: 'vertical', label: 'Vertical', placeholder: 'e.g., IT Services' },
          ].map((field) => (
            <div key={field.key}>
              <label className="text-xs text-slate-500 mb-1 block">{field.label}</label>
              <input
                type="text"
                value={(form as any)[field.key]}
                onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                placeholder={field.placeholder}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:border-brand-coral/50 focus:ring-1 focus:ring-brand-coral/20"
              />
            </div>
          ))}
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Deal Value (INR)</label>
            <input
              type="number"
              value={form.dealValue}
              onChange={(e) => setForm({ ...form, dealValue: parseInt(e.target.value) || 0 })}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-brand-coral/50 focus:ring-1 focus:ring-brand-coral/20"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Source</label>
            <select
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900"
            >
              <option value="linkedin_content">LinkedIn Content</option>
              <option value="instagram">Instagram</option>
              <option value="referral">Referral</option>
              <option value="event">Event</option>
              <option value="direct">Direct</option>
              <option value="webinar">Webinar</option>
            </select>
          </div>
        </div>
        <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !form.companyName}
            className="px-6 py-2 bg-brand-coral text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-brand-coral/90 transition-colors shadow-sm"
          >
            {submitting ? 'Adding...' : 'Add Lead'}
          </button>
        </div>
      </div>
    </div>
  );
}
