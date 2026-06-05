import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Briefcase,
  Calendar as CalendarIcon,
  Edit2,
  Filter,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { Client, LaravelUser, Project, laravelApi } from '../lib/laravelApi';
import { avatarStyleForUser, userInitial } from '../lib/avatar';
import { cn, formatDate } from '../lib/utils';

interface ProjectsViewProps {
  forceShowModal?: boolean;
  onModalClose?: () => void;
  selectedProjectId?: string | null;
}

const emptyProject = {
  name: '',
  description: '',
  status: 'active',
  clientId: '',
  memberIds: [] as string[],
  type: 'ongoing_social_media',
  startsAt: '',
  endsAt: '',
  progress: 0,
};

export const ProjectsView: React.FC<ProjectsViewProps> = ({ forceShowModal, onModalClose, selectedProjectId }) => {
  const { isAdmin, isManager } = useAuth();
  const canManage = isAdmin || isManager;
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [team, setTeam] = useState<LaravelUser[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [newProject, setNewProject] = useState(emptyProject);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const loadData = async () => {
    setLoading(true);
    const workspace = await laravelApi.projectWorkspace();
    setProjects(workspace.projects);
    setClients(workspace.clients);
    setTasks(workspace.tasks);
    setTeam(canManage ? workspace.team : []);
    setLoading(false);
  };

  useEffect(() => {
    loadData().catch((err) => {
      setError(err.message);
      setLoading(false);
    });
  }, [canManage]);

  useEffect(() => {
    if (forceShowModal) setIsModalOpen(true);
  }, [forceShowModal]);

  useEffect(() => {
    if (!selectedProjectId) return;
    const match = projects.find((project) => String(project.id) === selectedProjectId);
    if (match) setSelectedProject(match);
  }, [projects, selectedProjectId]);

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProject(null);
    setError(null);
    onModalClose?.();
  };

  const formValue = editingProject
    ? {
      name: editingProject.name,
      description: editingProject.description || '',
      status: editingProject.status,
      clientId: String(editingProject.client_id),
      memberIds: editingProject.users?.map((member) => String(member.id)) || [],
      type: editingProject.type || 'ongoing_social_media',
      startsAt: editingProject.starts_at || '',
      endsAt: editingProject.ends_at || '',
      progress: editingProject.progress || 0,
    }
    : newProject;

  const updateForm = (patch: Partial<typeof emptyProject>) => {
    if (editingProject) {
      setEditingProject({
        ...editingProject,
        name: patch.name ?? editingProject.name,
        description: patch.description ?? editingProject.description,
        status: (patch.status as Project['status']) ?? editingProject.status,
        client_id: patch.clientId !== undefined ? Number(patch.clientId) : editingProject.client_id,
        users: patch.memberIds !== undefined ? team.filter((member) => patch.memberIds?.includes(String(member.id))) : editingProject.users,
        type: patch.type ?? editingProject.type,
        starts_at: patch.startsAt ?? editingProject.starts_at,
        ends_at: patch.endsAt ?? editingProject.ends_at,
        progress: patch.progress ?? editingProject.progress,
      });
    } else {
      setNewProject((current) => ({ ...current, ...patch }));
    }
  };

  const saveProject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage) return;
    if (!formValue.name.trim() || !formValue.clientId) {
      setError('Project name and client are required.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        name: formValue.name,
        description: formValue.description,
        status: formValue.status as Project['status'],
        client_id: Number(formValue.clientId),
        member_ids: formValue.memberIds.map((id) => Number(id)),
        type: formValue.type,
        starts_at: formValue.startsAt || null,
        ends_at: formValue.endsAt || null,
        progress: Number(formValue.progress) || 0,
      };

      if (editingProject) {
        const updated = await laravelApi.updateProject(editingProject.id, payload);
        setProjects((items) => items.map((item) => item.id === updated.id ? updated : item));
      } else {
        const created = await laravelApi.createProject(payload);
        setProjects((items) => [created, ...items]);
        setNewProject(emptyProject);
      }
      closeModal();
    } catch (err: any) {
      setError(err.message || 'Failed to save project.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteProject = async (project: Project) => {
    if (!canManage) return;
    if (!window.confirm('Delete this project? Tasks and files linked to it will remain but lose the project link.')) return;
    await laravelApi.deleteProject(project.id);
    setProjects((items) => items.filter((item) => item.id !== project.id));
    if (selectedProject?.id === project.id) setSelectedProject(null);
  };

  const filteredProjects = useMemo(() => projects.filter((project) => {
    const client = clients.find((item) => item.id === project.client_id);
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase())
      || project.description?.toLowerCase().includes(searchTerm.toLowerCase())
      || client?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !filterStatus || project.status === filterStatus;
    return matchesSearch && matchesStatus;
  }), [clients, filterStatus, projects, searchTerm]);

  const getClientName = (project: Project) => clients.find((client) => client.id === project.client_id)?.name || 'No client';
  const getProjectTeam = (project: Project) => project.users?.length
    ? project.users.map((member) => member.name).join(', ')
    : 'No team assigned';
  const projectTasks = selectedProject ? tasks.filter((task) => task.project_id === selectedProject.id) : [];
  const selectedProgress = selectedProject
    ? projectTasks.length
      ? Math.round((projectTasks.filter((task) => task.status === 'completed').length / projectTasks.length) * 100)
      : selectedProject.progress || 0
    : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-2xl font-serif font-bold text-gray-900 italic">Project Portfolio</h3>
          {canManage && (
            <button onClick={() => setIsModalOpen(true)} className="px-4 py-2 bg-[#FF6321] text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-orange-100 hover:bg-[#e5591e] transition-all flex items-center gap-2">
              <Plus size={14} /> New Project
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search projects..." className="w-full bg-white border border-gray-100 rounded-2xl py-2.5 pl-11 pr-4 outline-none focus:ring-2 focus:ring-gray-900 transition-all text-sm font-medium" />
          </div>
          <div className="relative">
            <button onClick={() => setIsFilterDropdownOpen((value) => !value)} className={cn('px-5 py-3 border rounded-2xl text-sm font-bold transition-all flex items-center gap-2', filterStatus ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-100 hover:text-gray-900')}>
              <Filter size={18} />
              {filterStatus ? filterStatus.replaceAll('_', ' ').toUpperCase() : 'Filter'}
            </button>
            <AnimatePresence>
              {isFilterDropdownOpen && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl z-20 overflow-hidden">
                  {[null, 'briefing', 'active', 'in_progress', 'on_hold', 'completed'].map((status) => (
                    <button key={status || 'all'} onClick={() => { setFilterStatus(status); setIsFilterDropdownOpen(false); }} className="w-full text-left px-5 py-3 text-xs font-bold uppercase tracking-widest hover:bg-gray-50 transition-all text-gray-500">
                      {status ? status.replaceAll('_', ' ') : 'All Projects'}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm border border-red-100">{error}</div>}

      {loading ? (
        <div className="py-20 text-center text-gray-400">Loading projects...</div>
      ) : filteredProjects.length === 0 ? (
        <div className="py-20 bg-white rounded-[3rem] border border-dashed border-gray-200 text-center flex flex-col items-center">
          <Briefcase size={40} className="text-gray-200 mb-6" />
          <h4 className="text-xl font-serif font-bold text-gray-900 mb-2">No projects found</h4>
          <p className="text-sm text-gray-400 mb-8 italic">Start organizing agency work by creating a project.</p>
          {canManage && <button onClick={() => setIsModalOpen(true)} className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold shadow-xl shadow-gray-200 flex items-center gap-2"><Plus size={20} /> Create New Project</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {filteredProjects.map((project, index) => (
            <motion.div key={project.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.03 }} className="bg-white rounded-[2.5rem] p-8 border border-gray-50 shadow-sm hover:shadow-xl hover:translate-y-[-5px] transition-all group">
              <div className="flex items-start justify-between mb-6">
                <button onClick={() => setSelectedProject(project)} className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-[#FF6321] group-hover:text-white transition-all">
                  <Briefcase size={28} />
                </button>
                <div className="flex items-center gap-2">
                  {canManage && (
                    <div className="flex items-center bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                      <button onClick={() => { setEditingProject(project); setIsModalOpen(true); }} className="p-2.5 text-gray-400 hover:text-gray-900 transition-all border-r border-gray-100"><Edit2 size={18} /></button>
                      <button onClick={() => deleteProject(project)} className="p-2.5 text-gray-400 hover:text-red-500 transition-all"><Trash2 size={18} /></button>
                    </div>
                  )}
                  <StatusPill status={project.status} />
                </div>
              </div>
              <button onClick={() => setSelectedProject(project)} className="block text-left w-full">
                <h3 className="text-2xl font-serif font-bold text-gray-900 mb-2 truncate group-hover:text-[#FF6321] transition-all">{project.name}</h3>
              </button>
              <p className="text-sm text-gray-400 font-medium mb-6 flex items-center gap-2 uppercase tracking-widest text-[10px]">
                <Users size={14} className="text-[#FF6321]" /> Client: {getClientName(project)}
              </p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6 line-clamp-1">Team: {getProjectTeam(project)}</p>
              <p className="text-sm text-gray-500 leading-relaxed line-clamp-3 mb-8 min-h-[4.5rem]">{project.description || 'No description provided.'}</p>
              <div className="pt-6 border-t border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-300 uppercase tracking-wider">
                  <CalendarIcon size={14} /> {formatDate(project.created_at)}
                </div>
                <button onClick={() => setSelectedProject(project)} className="text-gray-400 hover:text-gray-900 transition-all flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest">
                  Details <ArrowUpRight size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl">
              <div className="sticky top-0 z-10 flex items-start justify-between gap-6 border-b border-gray-50 bg-white p-8">
                <div>
                  <h3 className="text-2xl font-serif font-bold italic">{editingProject ? 'Edit Project' : 'Create Project'}</h3>
                  <p className="mt-2 text-xs font-bold uppercase tracking-widest text-gray-400">Client workstream and team assignment</p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-500 transition-all hover:bg-gray-900 hover:text-white disabled:opacity-50"
                  aria-label="Close project modal"
                  disabled={isSaving}
                >
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={saveProject} className="p-8 space-y-6">
                {error && <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-xs border border-red-100">{error}</div>}
                <Input label="Project Name" value={formValue.name} onChange={(value) => updateForm({ name: value })} disabled={isSaving} />
                <Textarea label="Description" value={formValue.description} onChange={(value) => updateForm({ description: value })} disabled={isSaving} />
                <Select label="Client" value={formValue.clientId} onChange={(value) => updateForm({ clientId: value })} disabled={isSaving} options={[{ value: '', label: clients.length === 0 ? 'Create a client first' : 'Select client' }, ...clients.map((client) => ({ value: String(client.id), label: client.name }))]} />
                <Select label="Workstream Type" value={formValue.type} onChange={(value) => updateForm({ type: value })} disabled={isSaving} options={[
                  { value: 'ongoing_social_media', label: 'Ongoing social media management' },
                  { value: 'campaign', label: 'Campaign' },
                  { value: 'website', label: 'Website' },
                  { value: 'branding', label: 'Branding' },
                  { value: 'video_ads', label: 'Video ads' },
                  { value: 'content_retainer', label: 'Content retainer' },
                ]} />
                <ProjectTeamPicker
                  team={team}
                  selectedIds={formValue.memberIds}
                  onChange={(memberIds) => updateForm({ memberIds })}
                  disabled={isSaving}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Select label="Status" value={formValue.status} onChange={(value) => updateForm({ status: value })} disabled={isSaving} options={['briefing', 'active', 'in_progress', 'on_hold', 'completed'].map((value) => ({ value, label: value.replaceAll('_', ' ') }))} />
                  <Input label="Progress" type="number" value={String(formValue.progress)} onChange={(value) => updateForm({ progress: Number(value) })} disabled={isSaving} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Start Date" type="date" value={formValue.startsAt} onChange={(value) => updateForm({ startsAt: value })} disabled={isSaving} />
                  <Input label="End Date" type="date" value={formValue.endsAt} onChange={(value) => updateForm({ endsAt: value })} disabled={isSaving} />
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={closeModal} className="flex-1 py-4 text-sm font-bold text-gray-400 hover:text-gray-900 transition-all" disabled={isSaving}>Cancel</button>
                  <button type="submit" disabled={isSaving} className="flex-1 py-4 bg-gray-900 text-white rounded-[1.25rem] font-bold text-sm hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 disabled:opacity-50">{isSaving ? 'Saving...' : editingProject ? 'Save Changes' : 'Start Project'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedProject && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2.5rem] w-full max-w-3xl overflow-hidden shadow-2xl">
              <div className="p-10">
                <div className="flex items-center justify-between mb-8">
                  <StatusPill status={selectedProject.status} />
                  <button onClick={() => setSelectedProject(null)} className="p-2 text-gray-400 hover:text-gray-900 transition-all bg-gray-50 rounded-xl"><X size={20} /></button>
                </div>
                <h2 className="text-4xl font-serif font-bold text-gray-900 mb-2">{selectedProject.name}</h2>
                <p className="text-sm font-bold text-[#FF6321] uppercase tracking-widest mb-8">Client: {getClientName(selectedProject)}</p>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Team: {getProjectTeam(selectedProject)}</p>
                <p className="text-gray-600 leading-relaxed italic border-l-2 border-gray-100 pl-6 text-sm mb-10">{selectedProject.description || 'No detailed description provided.'}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
                  <DetailCard label="Progress" value={`${selectedProgress}%`} />
                  <DetailCard label="Open Tasks" value={String(projectTasks.filter((task) => task.status !== 'completed').length)} />
                  <DetailCard label="Deadline" value={selectedProject.ends_at ? formatDate(selectedProject.ends_at) : 'Not set'} />
                </div>
                <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden mb-10">
                  <div className="h-full bg-gray-900 rounded-full" style={{ width: `${selectedProgress}%` }} />
                </div>
                <div className="flex gap-4">
                  {canManage && <button onClick={() => { setEditingProject(selectedProject); setSelectedProject(null); setIsModalOpen(true); }} className="flex-1 py-4 bg-gray-900 text-white rounded-2xl font-bold text-sm hover:bg-gray-800 transition-all flex items-center justify-center gap-2"><Edit2 size={18} /> Edit Details</button>}
                  <button onClick={() => setSelectedProject(null)} className="flex-1 py-4 bg-gray-50 text-gray-600 rounded-2xl font-bold text-sm hover:bg-gray-100 transition-all">Close</button>
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
  return (
    <div className={cn('px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest', status === 'completed' ? 'bg-blue-50 text-blue-500 border border-blue-100' : status === 'on_hold' ? 'bg-orange-50 text-orange-500 border border-orange-100' : 'bg-green-50 text-green-500 border border-green-100')}>
      {status.replaceAll('_', ' ')}
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-xl font-serif font-bold text-gray-900">{value}</p>
    </div>
  );
}

function ProjectTeamPicker({ team, selectedIds, onChange, disabled }: { team: LaravelUser[]; selectedIds: string[]; onChange: (ids: string[]) => void; disabled?: boolean }) {
  const toggle = (memberId: string) => {
    if (disabled) return;
    onChange(selectedIds.includes(memberId)
      ? selectedIds.filter((id) => id !== memberId)
      : [...selectedIds, memberId]);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Project Team</label>
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300">{selectedIds.length} selected</span>
      </div>
      {team.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-sm font-medium text-gray-400">
          Add agency team members first, then assign them to this client workstream.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {team.map((member) => {
            const selected = selectedIds.includes(String(member.id));
            return (
              <button
                type="button"
                key={member.id}
                onClick={() => toggle(String(member.id))}
                disabled={disabled}
                className={cn('flex items-center gap-3 rounded-2xl border p-4 text-left transition-all', selected ? 'border-gray-900 bg-gray-900 text-white shadow-lg shadow-gray-100' : 'border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-200 hover:bg-white')}
              >
                <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm', selected && 'ring-2 ring-white/20')} style={avatarStyleForUser(member)}>
                  {userInitial(member.name)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{member.name}</span>
                  <span className={cn('block truncate text-[10px] font-bold uppercase tracking-widest', selected ? 'text-white/60' : 'text-gray-400')}>{member.title || member.role}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
      <p className="mt-2 text-[11px] font-medium text-gray-400">For ongoing social media clients, assign the account lead plus the people doing design, copy, video, and development work.</p>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', disabled }: { label: string; value: string; onChange: (value: string) => void; type?: string; disabled?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{label}</label>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-medium placeholder:text-gray-300 focus:ring-2 focus:ring-gray-900 transition-all outline-none" disabled={disabled} />
    </div>
  );
}

function Textarea({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{label}</label>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} className="w-full bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-medium placeholder:text-gray-300 focus:ring-2 focus:ring-gray-900 transition-all outline-none h-24" disabled={disabled} />
    </div>
  );
}

function Select({ label, value, onChange, options, disabled }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; disabled?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="select-arrow h-14 w-full rounded-2xl border-none bg-gray-50 py-4 pl-4 font-medium capitalize text-gray-900 outline-none" disabled={disabled}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}
