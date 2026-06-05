import React, { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Building2,
  Edit2,
  FileText,
  Instagram,
  Mail,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { Client, Project, SharedFile, SocialPost, Task, laravelApi } from '../lib/laravelApi';
import { cn, formatDate } from '../lib/utils';

interface ClientsViewProps {
  forceShowModal?: boolean;
  onModalClose?: () => void;
}

const emptyClient = {
  name: '',
  industry: '',
  contactName: '',
  contactEmail: '',
  status: 'active',
};

export const ClientsView: React.FC<ClientsViewProps> = ({ forceShowModal, onModalClose }) => {
  const { isAdmin, isManager } = useAuth();
  const canManage = isAdmin || isManager;
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeStatus, setActiveStatus] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newClient, setNewClient] = useState(emptyClient);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [clientList, projectList, taskList, postList, fileList] = await Promise.all([
      laravelApi.clients(),
      laravelApi.projects(),
      laravelApi.tasks(),
      laravelApi.socialPosts(),
      laravelApi.files().catch(() => []),
    ]);
    setClients(clientList);
    setProjects(projectList);
    setTasks(taskList);
    setPosts(postList);
    setFiles(fileList);
    setLoading(false);
  };

  useEffect(() => {
    loadData().catch((err) => {
      setError(err.message || 'Failed to load clients.');
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (forceShowModal) setIsModalOpen(true);
  }, [forceShowModal]);

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingClient(null);
    setError(null);
    onModalClose?.();
  };

  const formValue = editingClient
    ? {
      name: editingClient.name,
      industry: editingClient.industry || '',
      contactName: editingClient.contact_name || '',
      contactEmail: editingClient.contact_email || '',
      status: editingClient.status || 'active',
    }
    : newClient;

  const updateForm = (patch: Partial<typeof emptyClient>) => {
    if (editingClient) {
      setEditingClient({
        ...editingClient,
        name: patch.name ?? editingClient.name,
        industry: patch.industry ?? editingClient.industry,
        contact_name: patch.contactName ?? editingClient.contact_name,
        contact_email: patch.contactEmail ?? editingClient.contact_email,
        status: patch.status ?? editingClient.status,
      });
    } else {
      setNewClient((current) => ({ ...current, ...patch }));
    }
  };

  const saveClient = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage) return;
    if (!formValue.name.trim()) {
      setError('Client name is required.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        name: formValue.name.trim(),
        industry: formValue.industry || null,
        contact_name: formValue.contactName || null,
        contact_email: formValue.contactEmail || null,
        status: formValue.status,
      };

      if (editingClient) {
        const updated = await laravelApi.updateClient(editingClient.id, payload);
        setClients((items) => items.map((item) => item.id === updated.id ? updated : item));
        setSelectedClient((current) => current?.id === updated.id ? updated : current);
      } else {
        const created = await laravelApi.createClient(payload);
        setClients((items) => [created, ...items]);
        setNewClient(emptyClient);
      }

      closeModal();
    } catch (err: any) {
      setError(err.message || 'Failed to save client.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteClient = async (client: Client) => {
    if (!canManage) return;
    if (!window.confirm(`Delete ${client.name}? Clients with linked work should be set inactive instead.`)) return;

    try {
      await laravelApi.deleteClient(client.id);
      setClients((items) => items.filter((item) => item.id !== client.id));
      if (selectedClient?.id === client.id) setSelectedClient(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete client.');
    }
  };

  const clientStats = (clientId: number) => ({
    projects: projects.filter((project) => project.client_id === clientId).length,
    openTasks: tasks.filter((task) => task.client_id === clientId && task.status !== 'completed').length,
    posts: posts.filter((post) => post.client_id === clientId).length,
    files: files.filter((file) => file.client_id === clientId).length,
  });

  const filteredClients = useMemo(() => clients.filter((client) => {
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch = !query
      || client.name.toLowerCase().includes(query)
      || client.industry?.toLowerCase().includes(query)
      || client.contact_name?.toLowerCase().includes(query)
      || client.contact_email?.toLowerCase().includes(query);
    const matchesStatus = activeStatus === 'all' || client.status === activeStatus;
    return matchesSearch && matchesStatus;
  }), [activeStatus, clients, searchTerm]);

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-2xl font-serif font-bold text-gray-900 italic">Client Accounts</h3>
          <p className="mt-2 max-w-xl text-sm text-gray-400">Use clients as the source of truth for retainers, social content, brand work, websites, ads, files, and reporting.</p>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search clients..." className="w-full rounded-2xl border border-gray-100 bg-white py-3 pl-11 pr-4 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-gray-900" />
          </div>
          {canManage && (
            <button onClick={() => setIsModalOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gray-900 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-gray-100 transition-all hover:bg-gray-800">
              <Plus size={18} />
              New Client
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {['all', 'active', 'onboarding', 'paused', 'inactive'].map((status) => (
          <button
            key={status}
            onClick={() => setActiveStatus(status)}
            className={cn('rounded-2xl border px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all', activeStatus === status ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-100 bg-white text-gray-400 hover:text-gray-900')}
          >
            {status}
          </button>
        ))}
      </div>

      {error && <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">{error}</div>}

      {loading ? (
        <div className="py-20 text-center text-gray-400">Loading clients...</div>
      ) : filteredClients.length === 0 ? (
        <div className="flex flex-col items-center rounded-[3rem] border border-dashed border-gray-200 bg-white py-20 text-center">
          <Building2 size={40} className="mb-6 text-gray-200" />
          <h4 className="mb-2 text-xl font-serif font-bold text-gray-900">No clients found</h4>
          <p className="mb-8 max-w-md text-sm text-gray-400 italic">Create the client account first, then attach projects, tasks, posts, files, and reports to it.</p>
          {canManage && <button onClick={() => setIsModalOpen(true)} className="inline-flex items-center gap-2 rounded-2xl bg-gray-900 px-8 py-4 text-sm font-bold text-white shadow-xl shadow-gray-200"><Plus size={20} /> Create Client</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-7 lg:grid-cols-2 xl:grid-cols-3">
          {filteredClients.map((client, index) => {
            const stats = clientStats(client.id);
            return (
              <motion.div key={client.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.03 }} className="group rounded-[2.5rem] border border-gray-50 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl">
                <div className="mb-8 flex items-start justify-between">
                  <button onClick={() => setSelectedClient(client)} className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 transition-all group-hover:bg-[#FF6321] group-hover:text-white">
                    <Building2 size={28} />
                  </button>
                  <div className="flex items-center gap-2">
                    <StatusPill status={client.status} />
                    {canManage && (
                      <div className="flex overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                        <button onClick={() => { setEditingClient(client); setIsModalOpen(true); }} className="border-r border-gray-100 p-2.5 text-gray-400 transition-all hover:text-gray-900"><Edit2 size={17} /></button>
                        <button onClick={() => deleteClient(client)} className="p-2.5 text-gray-400 transition-all hover:text-red-500"><Trash2 size={17} /></button>
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelectedClient(client)} className="block w-full text-left">
                  <h3 className="mb-2 truncate text-2xl font-serif font-bold text-gray-900 transition-all group-hover:text-[#FF6321]">{client.name}</h3>
                </button>
                <p className="mb-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  <Briefcase size={14} className="text-[#FF6321]" />
                  {client.industry || 'Marketing client'}
                </p>
                <div className="mb-8 space-y-2 text-sm font-medium text-gray-500">
                  <p className="flex items-center gap-2"><UserRound size={15} className="text-gray-300" /> {client.contact_name || 'No contact person yet'}</p>
                  <p className="flex items-center gap-2 truncate"><Mail size={15} className="text-gray-300" /> {client.contact_email || 'No contact email yet'}</p>
                </div>
                <div className="grid grid-cols-4 gap-2 border-t border-gray-50 pt-6">
                  <MiniMetric label="Projects" value={stats.projects} />
                  <MiniMetric label="Tasks" value={stats.openTasks} />
                  <MiniMetric label="Posts" value={stats.posts} />
                  <MiniMetric label="Files" value={stats.files} />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-xl overflow-hidden rounded-[2.5rem] bg-white shadow-2xl">
              <div className="border-b border-gray-50 p-8">
                <h3 className="text-2xl font-serif font-bold italic">{editingClient ? 'Edit Client' : 'Create Client'}</h3>
                <p className="mt-2 text-xs font-bold uppercase tracking-widest text-gray-400">Account profile</p>
              </div>
              <form onSubmit={saveClient} className="space-y-6 p-8">
                {error && <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-xs text-red-600">{error}</div>}
                <Input label="Client Name" value={formValue.name} onChange={(value) => updateForm({ name: value })} disabled={isSaving} />
                <Input label="Industry / Work Type" value={formValue.industry} onChange={(value) => updateForm({ industry: value })} disabled={isSaving} placeholder="Restaurant, construction, ecommerce..." />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Input label="Contact Person" value={formValue.contactName} onChange={(value) => updateForm({ contactName: value })} disabled={isSaving} />
                  <Input label="Contact Email" type="email" value={formValue.contactEmail} onChange={(value) => updateForm({ contactEmail: value })} disabled={isSaving} />
                </div>
                <Select label="Status" value={formValue.status} onChange={(value) => updateForm({ status: value })} disabled={isSaving} options={['active', 'onboarding', 'paused', 'inactive'].map((value) => ({ value, label: value }))} />
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={closeModal} className="flex-1 py-4 text-sm font-bold text-gray-400 transition-all hover:text-gray-900" disabled={isSaving}>Cancel</button>
                  <button type="submit" disabled={isSaving} className="flex-1 rounded-[1.25rem] bg-gray-900 py-4 text-sm font-bold text-white shadow-lg shadow-gray-200 transition-all hover:bg-gray-800 disabled:opacity-50">{isSaving ? 'Saving...' : editingClient ? 'Save Changes' : 'Create Client'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedClient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-4xl overflow-hidden rounded-[2.5rem] bg-white shadow-2xl">
              <div className="p-10">
                <div className="mb-8 flex items-center justify-between">
                  <StatusPill status={selectedClient.status} />
                  <button onClick={() => setSelectedClient(null)} className="rounded-xl bg-gray-50 p-2 text-gray-400 transition-all hover:text-gray-900"><X size={20} /></button>
                </div>
                <h2 className="mb-2 text-4xl font-serif font-bold text-gray-900">{selectedClient.name}</h2>
                <p className="mb-10 text-sm font-bold uppercase tracking-widest text-[#FF6321]">{selectedClient.industry || 'Client account'}</p>
                <div className="mb-10 grid grid-cols-1 gap-5 md:grid-cols-4">
                  <DetailCard label="Projects" value={String(clientStats(selectedClient.id).projects)} icon={Briefcase} />
                  <DetailCard label="Open Tasks" value={String(clientStats(selectedClient.id).openTasks)} icon={FileText} />
                  <DetailCard label="Social Posts" value={String(clientStats(selectedClient.id).posts)} icon={Instagram} />
                  <DetailCard label="Files" value={String(clientStats(selectedClient.id).files)} icon={FileText} />
                </div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <InfoBlock label="Contact person" value={selectedClient.contact_name || 'Not set'} />
                  <InfoBlock label="Contact email" value={selectedClient.contact_email || 'Not set'} />
                  <InfoBlock label="Created" value={selectedClient.created_at ? formatDate(selectedClient.created_at) : 'Not available'} />
                  <InfoBlock label="Recommended workflow" value="Client > ongoing project/campaign > daily tasks and social posts" />
                </div>
                <div className="mt-10 flex gap-4">
                  {canManage && <button onClick={() => { setEditingClient(selectedClient); setSelectedClient(null); setIsModalOpen(true); }} className="flex-1 rounded-2xl bg-gray-900 py-4 text-sm font-bold text-white transition-all hover:bg-gray-800"><Edit2 className="mr-2 inline" size={18} /> Edit Client</button>}
                  <button onClick={() => setSelectedClient(null)} className="flex-1 rounded-2xl bg-gray-50 py-4 text-sm font-bold text-gray-600 transition-all hover:bg-gray-100">Close</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-50 text-green-600 border-green-100',
    onboarding: 'bg-blue-50 text-blue-600 border-blue-100',
    paused: 'bg-orange-50 text-orange-600 border-orange-100',
    inactive: 'bg-gray-100 text-gray-500 border-gray-200',
  };

  return (
    <span className={cn('rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest', styles[status] || styles.active)}>
      {status}
    </span>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-300">{label}</p>
      <p className="text-lg font-serif font-bold text-gray-900">{value}</p>
    </div>
  );
}

function DetailCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="rounded-[2rem] border border-gray-100 bg-gray-50 p-6">
      <Icon size={20} className="mb-4 text-gray-400" />
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="text-2xl font-serif font-bold text-gray-900">{value}</p>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 p-5">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="text-sm font-bold text-gray-700">{value}</p>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', disabled, placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; disabled?: boolean; placeholder?: string }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-400">{label}</label>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-2xl border-none bg-gray-50 p-4 font-medium text-gray-900 outline-none transition-all placeholder:text-gray-300 focus:ring-2 focus:ring-gray-900" disabled={disabled} />
    </div>
  );
}

function Select({ label, value, onChange, options, disabled }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; disabled?: boolean }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-400">{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-14 w-full rounded-2xl border-none bg-gray-50 p-4 font-medium capitalize text-gray-900 outline-none" disabled={disabled}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}
