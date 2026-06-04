import React, { useState } from 'react';
import {
  Zap,
  Settings,
  Bell,
  Mail,
  MessageSquare,
  Plus,
  ArrowRight,
  Sparkles,
  ToggleLeft as Toggle,
  Clock
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export const AutomationCenter: React.FC = () => {
  const [automations, setAutomations] = useState([
    { id: '1', name: 'Status Reminder', trigger: 'Status is stuck', action: 'Notify Manager', active: true, icon: Bell, color: 'text-orange-500 bg-orange-50' },
    { id: '2', name: 'Auto-Assign Briefs', trigger: 'Brief is created', action: 'Assign to Sarah', active: true, icon: Mail, color: 'text-blue-500 bg-blue-50' },
    { id: '3', name: 'AI Optimization', trigger: 'Scheduled at night', action: 'Optimize hashtags', active: false, icon: Sparkles, color: 'text-purple-500 bg-purple-50' },
    { id: '4', name: 'Weekly Progress', trigger: 'Every Friday', action: 'Email Client Report', active: true, icon: Clock, color: 'text-indigo-500 bg-indigo-50' },
  ]);

  const toggleAutomation = (id: string) => {
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
  };

  return (
    <div className="space-y-10 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-serif font-bold text-gray-900 mb-2 italic flex items-center gap-4">
            Custom Workflows
            <div className="bg-orange-100 text-[#FF6321] px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-widest border border-orange-200">Agency Pro</div>
          </h1>
          <p className="text-gray-400 text-sm max-w-lg">
            Create "If-This-Then-That" logic to eliminate manual agency tasks and boost operational efficiency.
          </p>
        </div>

        <button className="bg-gray-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-xl shadow-gray-200 hover:bg-gray-800 transition-all active:scale-95">
          <Plus size={20} />
          Create Automation
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-[2.5rem] p-10 text-white relative overflow-hidden group">
          <div className="relative z-10">
            <Zap size={40} className="text-[#FF6321] mb-6 animate-pulse" />
            <h3 className="text-2xl font-serif font-bold italic mb-4">Monday.com <br/> Logic Sync</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-8">Connect your board triggers to automated agency responses.</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs font-bold uppercase tracking-widest">Board Sync Active</span>
              </div>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF6321]/20 blur-[60px] rounded-full group-hover:bg-[#FF6321]/30 transition-all"></div>
        </div>

        {automations.map((auto) => (
          <motion.div
            key={auto.id}
            whileHover={{ y: -5 }}
            className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all"
          >
            <div className="flex items-center justify-between mb-8">
              <div className={cn("p-4 rounded-2xl", auto.color)}>
                <auto.icon size={28} />
              </div>
              <div className="flex flex-col items-end">
                <span className={cn("text-[10px] font-bold uppercase tracking-widest mb-1", auto.active ? 'text-green-500' : 'text-gray-300')}>
                  {auto.active ? 'Active' : 'Paused'}
                </span>
                <button
                  onClick={() => toggleAutomation(auto.id)}
                  className={cn("transition-all", auto.active ? 'text-green-500' : 'text-gray-300')}
                >
                  <Toggle size={32} />
                </button>
              </div>
            </div>

            <h4 className="text-xl font-serif font-bold text-gray-900 mb-6">{auto.name}</h4>

            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Trigger</p>
                  <p className="text-sm font-bold text-gray-900">{auto.trigger}</p>
                </div>
                <ArrowRight size={16} className="text-gray-300" />
                <div className="text-right">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Action</p>
                  <p className="text-sm font-bold text-gray-900">{auto.action}</p>
                </div>
              </div>
            </div>

            <button className="w-full mt-8 flex items-center justify-center gap-2 py-3 text-xs font-bold text-gray-400 hover:text-gray-900 transition-all">
              <Settings size={14} /> Configure Logic
            </button>
          </motion.div>
        ))}

        <button className="bg-white border-2 border-dashed border-gray-100 rounded-[2.5rem] p-8 flex flex-col items-center justify-center gap-4 text-gray-300 hover:border-[#FF6321] hover:text-[#FF6321] transition-all min-h-[300px]">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
            <Plus size={32} />
          </div>
          <span className="font-bold text-lg">Add Logic Recipe</span>
        </button>
      </div>

      <section className="bg-blue-600 rounded-[3rem] p-12 text-white overflow-hidden relative shadow-2xl">
        <div className="relative z-10">
          <h3 className="text-3xl font-serif font-bold italic mb-6">Need a custom bot?</h3>
          <p className="text-blue-100 max-w-xl mb-8 leading-relaxed">Describe a workflow, and our AI will attempt to build the recipe for you instantly.</p>
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-2 flex gap-2 border border-white/20">
            <input
              className="flex-1 bg-transparent border-none px-6 py-4 text-white placeholder:text-blue-200 outline-none"
              placeholder="e.g. 'Every Wednesday morning, notify Alex to check on the SEO Project'"
            />
            <button className="bg-white text-blue-600 px-8 py-4 rounded-2xl font-bold hover:bg-blue-50 transition-all flex items-center gap-2">
              <Sparkles size={20} />
              Draft Logic
            </button>
          </div>
        </div>
        <div className="absolute bottom-[-50px] right-[-50px] w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
      </section>
    </div>
  );
};
