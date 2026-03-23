import React from 'react';

interface Props {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {icon && <div className="text-slate-200 mb-4">{icon}</div>}
      <h3 className="text-lg font-semibold text-slate-700 mb-2">{title}</h3>
      <p className="text-sm text-slate-400 max-w-md mb-6">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-2.5 bg-brand-coral text-white rounded-lg text-sm font-medium hover:bg-brand-coral/90 transition-colors shadow-sm"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
