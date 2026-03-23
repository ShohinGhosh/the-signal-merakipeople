import React, { useState, useEffect } from 'react';
import { Users, Plus, X, MessageSquare, Download } from 'lucide-react';
import { pipelineAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import EmptyState from '../components/shared/EmptyState';
import type { Lead } from '../types';

// Simplified stage grouping
const STAGE_GROUP: Record<string, { label: string; color: string }> = {
  RADAR: { label: 'New', color: '#3B82F6' },
  CONTACTED: { label: 'New', color: '#3B82F6' },
  CONVERSATION: { label: 'In Progress', color: '#F59E0B' },
  DEMO_DONE: { label: 'In Progress', color: '#F59E0B' },
  PROPOSAL: { label: 'In Progress', color: '#F59E0B' },
  NEGOTIATING: { label: 'In Progress', color: '#F59E0B' },
  SIGNED: { label: 'Won', color: '#10B981' },
  LOST: { label: 'Lost', color: '#EF4444' },
};

const FILTER_OPTIONS = ['All', 'New', 'In Progress', 'Won', 'Lost'] as const;

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('All');
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
      console.error('Failed to load leads:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = filter === 'All'
    ? leads
    : leads.filter((l) => STAGE_GROUP[l.stage]?.label === filter);

  const totalValue = leads
    .filter((l) => l.stage !== 'LOST')
    .reduce((sum, l) => sum + (l.dealValue || 0), 0);

  const wonValue = leads
    .filter((l) => l.stage === 'SIGNED')
    .reduce((sum, l) => sum + (l.dealValue || 0), 0);

  const exportCSV = () => {
    const headers = ['Company', 'Contact', 'Role', 'Stage', 'Value', 'Source', 'Owner', 'Next Action'];
    const rows = leads.map((l) => [
      l.companyName,
      l.contactName,
      l.contactRole,
      STAGE_GROUP[l.stage]?.label || l.stage,
      l.dealValue.toString(),
      l.source,
      l.owner,
      l.nextAction || '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!loading && leads.length === 0 && !showAddForm) {
    return (
      <EmptyState
        icon={<Users size={48} />}
        title="No leads tracked"
        description="Add your first lead to start tracking your pipeline."
        action={{ label: 'Add a Lead', onClick: () => setShowAddForm(true) }}
      />
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-sm hover:bg-slate-200 transition-colors"
          >
            <Download size={14} />
            Export CSV
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-coral text-white rounded-lg text-sm font-medium hover:bg-brand-coral/90 transition-colors shadow-sm"
          >
            <Plus size={14} />
            Add Lead
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-5 mb-8">
        <div className="bg-white border border-slate-200/60 rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-400 mb-1">Total Leads</div>
          <div className="text-xl font-bold font-mono text-slate-900">{leads.length}</div>
        </div>
        <div className="bg-white border border-slate-200/60 rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-400 mb-1">Pipeline Value</div>
          <div className="text-xl font-bold font-mono text-slate-900">
            {totalValue > 0 ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(totalValue) : '—'}
          </div>
        </div>
        <div className="bg-white border border-slate-200/60 rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-400 mb-1">Won Value</div>
          <div className="text-xl font-bold font-mono text-green-600">
            {wonValue > 0 ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(wonValue) : '—'}
          </div>
        </div>
        <div className="bg-white border border-slate-200/60 rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-400 mb-1">Active</div>
          <div className="text-xl font-bold font-mono text-slate-900">
            {leads.filter((l) => !['SIGNED', 'LOST'].includes(l.stage)).length}
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-4 bg-slate-100 rounded-lg p-1 w-fit">
        {FILTER_OPTIONS.map((f) => {
          const count = f === 'All' ? leads.length : leads.filter((l) => STAGE_GROUP[l.stage]?.label === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                filter === f ? 'bg-brand-coral text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {f} <span className="text-slate-300 ml-1">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Leads table */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : (
        <div className="bg-white border border-slate-200/60 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 text-xs uppercase tracking-wider">
                <th className="text-left p-3">Company</th>
                <th className="text-left p-3">Contact</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Value</th>
                <th className="text-left p-3">Source</th>
                <th className="text-left p-3">Owner</th>
                <th className="text-left p-3">Next Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => {
                const group = STAGE_GROUP[lead.stage] || { label: lead.stage, color: '#6B7280' };
                return (
                  <tr
                    key={lead._id}
                    onClick={() => setSelectedLead(lead)}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="p-3 font-medium text-slate-900">{lead.companyName}</td>
                    <td className="p-3 text-slate-500">
                      <div>{lead.contactName}</div>
                      {lead.contactRole && <div className="text-xs text-slate-300">{lead.contactRole}</div>}
                    </td>
                    <td className="p-3">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: `${group.color}20`, color: group.color }}
                      >
                        {group.label}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-xs text-slate-700">
                      {lead.dealValue > 0
                        ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(lead.dealValue)
                        : '—'}
                    </td>
                    <td className="p-3 text-slate-500 capitalize text-xs">{lead.source?.replace('_', ' ')}</td>
                    <td className="p-3 capitalize text-slate-700">{lead.owner}</td>
                    <td className="p-3 text-slate-500 text-xs max-w-[200px] truncate">{lead.nextAction || '—'}</td>
                  </tr>
                );
              })}
              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-300">
                    No leads in this category.
                  </td>
                </tr>
              )}
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
  const group = STAGE_GROUP[lead.stage] || { label: lead.stage, color: '#6B7280' };

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
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-2xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-slate-900">{lead.companyName || 'Lead Details'}</h3>
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: `${group.color}20`, color: group.color }}
            >
              {group.label}
            </span>
          </div>
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
            <div>
              <span className="text-slate-400 text-xs">Source</span>
              <p className="capitalize text-slate-900">{lead.source?.replace('_', ' ') || '—'}</p>
            </div>
            <div>
              <span className="text-slate-400 text-xs">Owner</span>
              <p className="capitalize text-slate-900">{lead.owner}</p>
            </div>
          </div>

          {lead.nextAction && (
            <div>
              <span className="text-slate-400 text-xs">Next Action</span>
              <p className="text-sm mt-0.5 text-slate-700">{lead.nextAction}</p>
            </div>
          )}

          {/* Draft Outreach */}
          <div>
            <p className="text-xs text-slate-400 mb-2">AI Outreach Draft</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleDraftOutreach('linkedin_dm')}
                disabled={draftingOutreach}
                className="px-3 py-1.5 bg-slate-100 text-slate-500 rounded text-xs hover:bg-slate-200 flex items-center gap-1 disabled:opacity-40 transition-colors"
              >
                <MessageSquare size={12} /> LinkedIn DM
              </button>
              <button
                onClick={() => handleDraftOutreach('email')}
                disabled={draftingOutreach}
                className="px-3 py-1.5 bg-slate-100 text-slate-500 rounded text-xs hover:bg-slate-200 flex items-center gap-1 disabled:opacity-40 transition-colors"
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
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
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
