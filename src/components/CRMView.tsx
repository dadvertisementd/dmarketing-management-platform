import React, { useEffect, useMemo, useState } from 'react';
import { Clock, DollarSign, MoreVertical, Plus, Target, TrendingUp, User } from 'lucide-react';
import { motion } from 'motion/react';
import { Client, Project, laravelApi } from '../lib/laravelApi';
import { cn } from '../lib/utils';

const PIPELINE_STAGES = [
  { id: 'inbound', label: 'Incoming', color: 'bg-blue-500' },
  { id: 'qualified', label: 'Qualified', color: 'bg-purple-500' },
  { id: 'proposal', label: 'Proposal', color: 'bg-orange-500' },
  { id: 'negotiation', label: 'Negotiation', color: 'bg-amber-500' },
  { id: 'closed', label: 'Won', color: 'bg-green-500' },
];

export const CRMView: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    Promise.all([laravelApi.clients(), laravelApi.projects()]).then(([clientList, projectList]) => {
      setClients(clientList);
      setProjects(projectList);
    });
  }, []);

  const leads = useMemo(() => {
    const stageByStatus: Record<string, string> = {
      briefing: 'qualified',
      active: 'closed',
      in_progress: 'closed',
      on_hold: 'negotiation',
      completed: 'closed',
    };

    const projectLeads = projects.map((project) => {
      const client = clients.find((item) => item.id === project.client_id);
      return {
        id: `project-${project.id}`,
        company: client?.name || project.name,
        contact: client?.contact_name || client?.contact_email || 'Client contact',
        value: `$${((project.progress || 20) * 300).toLocaleString()}`,
        stage: stageByStatus[project.status] || 'proposal',
        probability: project.status === 'completed' ? 100 : Math.max(project.progress || 30, 20),
        source: project.type || 'Marketing',
        lastActive: 'SQL workspace',
      };
    });

    const clientLeads = clients
      .filter((client) => !projects.some((project) => project.client_id === client.id))
      .map((client) => ({
        id: `client-${client.id}`,
        company: client.name,
        contact: client.contact_name || client.contact_email || 'Client contact',
        value: '$5,000',
        stage: client.status === 'active' ? 'qualified' : 'inbound',
        probability: client.status === 'active' ? 40 : 20,
        source: client.industry || 'Website',
        lastActive: 'Client record',
      }));

    return [...projectLeads, ...clientLeads];
  }, [clients, projects]);

  const totalValue = leads.reduce((acc, lead) => acc + Number(lead.value.replace(/[^0-9]/g, '')), 0);

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 bg-[#FF6321] rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-[#FF6321] uppercase tracking-[0.2em]">Sales Pipeline</span>
          </div>
          <h1 className="text-4xl font-serif font-bold italic text-gray-900 tracking-tight">Business Development</h1>
          <p className="text-gray-500 mt-2 text-sm max-w-xl">Track client opportunities and active marketing work from Laravel SQL records.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-white px-6 py-3 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Pipeline Value</p>
              <p className="text-xl font-serif font-bold text-gray-900 italic">${totalValue.toLocaleString()}</p>
            </div>
            <TrendingUp size={24} className="text-green-500" />
          </div>
          <button className="bg-gray-900 text-white px-6 py-3 rounded-2xl flex items-center gap-2 hover:bg-gray-800 transition-all font-bold text-sm shadow-xl shadow-gray-200 active:scale-95">
            <Plus size={18} /> Add Opportunity
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {PIPELINE_STAGES.map((stage) => (
          <div key={stage.id} className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <div className={cn('w-1.5 h-1.5 rounded-full', stage.color)} />
                {stage.label}
              </h3>
              <span className="text-[10px] font-bold text-gray-300">{leads.filter((lead) => lead.stage === stage.id).length}</span>
            </div>
            <div className="space-y-4 min-h-[400px] p-2 bg-gray-50/50 rounded-[2rem] border border-dashed border-gray-100">
              {leads.filter((lead) => lead.stage === stage.id).map((lead) => (
                <motion.div key={lead.id} layoutId={lead.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-[#FF6321]/30 transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-3">
                    <div className="bg-gray-50 text-[10px] font-bold text-gray-500 px-2 py-1 rounded tracking-wider">{lead.source}</div>
                    <button className="text-gray-200 hover:text-gray-900 transition-colors"><MoreVertical size={14} /></button>
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 group-hover:text-[#FF6321] transition-colors mb-1">{lead.company}</h4>
                  <p className="text-[10px] text-gray-400 font-medium mb-4 flex items-center gap-1"><User size={10} /> {lead.contact}</p>
                  <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                    <div className="flex items-center gap-1 text-[#FF6321]"><DollarSign size={14} /><span className="text-xs font-bold">{lead.value}</span></div>
                    <div className="flex items-center gap-1 text-gray-400"><Clock size={10} /><span className="text-[10px]">{lead.lastActive}</span></div>
                  </div>
                  <div className="mt-4 bg-gray-50 h-1 rounded-full overflow-hidden">
                    <div className={stage.color + ' h-full transition-all duration-500'} style={{ width: `${lead.probability}%` }} />
                  </div>
                </motion.div>
              ))}
              {leads.filter((lead) => lead.stage === stage.id).length === 0 && <div className="py-10 text-center text-gray-300 text-xs font-bold uppercase tracking-widest">Empty</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
