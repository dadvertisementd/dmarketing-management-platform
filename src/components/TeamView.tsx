import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Mail, Plus, ShieldCheck, Trash2, UserCog, Users, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { LaravelUser, UserRole, laravelApi } from '../lib/laravelApi';
import { cn } from '../lib/utils';

const defaultMember = {
  name: '',
  email: '',
  password: 'ChangeMe123!',
  role: 'worker' as UserRole,
  title: '',
  weekly_capacity: 40,
};

const permissionRoles: UserRole[] = ['worker', 'manager', 'admin'];

const teamPositions = [
  'Graphic Designer',
  'Social Media Manager',
  'Video Editor',
  'Developer',
  'Account Manager',
  'Project Manager',
  'Copywriter',
  'Brand Strategist',
  'Web Designer',
  'Performance Marketer',
];

interface TeamViewProps {
  forceShowModal?: boolean;
  onModalClose?: () => void;
}

export const TeamView: React.FC<TeamViewProps> = ({ forceShowModal, onModalClose }) => {
  const { isAdmin, isManager, userProfile } = useAuth();
  const [members, setMembers] = useState<LaravelUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [newMember, setNewMember] = useState(defaultMember);
  const [error, setError] = useState<string | null>(null);

  const loadMembers = async () => {
    setLoading(true);
    const data = await laravelApi.teamMembers();
    setMembers(data);
    setLoading(false);
  };

  useEffect(() => {
    if (!isManager) {
      setLoading(false);
      return;
    }

    loadMembers().catch((err) => {
      setError(err.message || 'Failed to load team members.');
      setLoading(false);
    });
  }, [isManager]);

  useEffect(() => {
    if (forceShowModal && isAdmin) setIsModalOpen(true);
  }, [forceShowModal, isAdmin]);

  const closeModal = () => {
    setIsModalOpen(false);
    setNewMember(defaultMember);
    setError(null);
    onModalClose?.();
  };

  const stats = useMemo(() => ({
    total: members.length,
    active: members.filter((member) => member.is_active !== false).length,
    managers: members.filter((member) => member.role === 'admin' || member.role === 'manager').length,
    capacity: members.reduce((total, member) => total + (member.weekly_capacity || 0), 0),
  }), [members]);

  const createMember = async () => {
    if (!isAdmin || !newMember.name.trim() || !newMember.email.trim()) return;
    setIsSaving(true);
    setError(null);

    try {
      const created = await laravelApi.createUser(newMember);
      setMembers((items) => [...items, created].sort((a, b) => a.name.localeCompare(b.name)));
      closeModal();
    } catch (err: any) {
      setError(err.message || 'Failed to create team member.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateMember = async (member: LaravelUser, payload: Partial<LaravelUser>) => {
    if (!isAdmin) return;
    setUpdatingUserId(member.id);
    setError(null);

    try {
      const updated = await laravelApi.updateUser(member.id, payload);
      setMembers((items) => items.map((item) => item.id === updated.id ? updated : item));
    } catch (err: any) {
      setError(err.message || 'Failed to update team member.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const deleteMember = async (member: LaravelUser) => {
    if (!isAdmin) return;

    if (member.id === userProfile?.id) {
      setError('You cannot delete your own account while signed in.');
      return;
    }

    if (!window.confirm(`Permanently remove ${member.name}? Their task assignments and uploaded files will remain in the workspace, but the user account will be deleted.`)) {
      return;
    }

    setUpdatingUserId(member.id);
    setError(null);

    try {
      await laravelApi.deleteUser(member.id);
      setMembers((items) => items.filter((item) => item.id !== member.id));
    } catch (err: any) {
      setError(err.message || 'Failed to delete team member.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  if (!isManager) {
    return (
      <div className="bg-white rounded-[2.5rem] p-10 border border-gray-50 shadow-sm text-center">
        <h3 className="text-3xl font-serif font-bold italic text-gray-900 mb-2">Team</h3>
        <p className="text-gray-400">Only admins and managers can view agency team management.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <section className="bg-gray-900 rounded-[3rem] p-10 overflow-hidden text-white relative shadow-2xl">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-[#FF6321] rounded-xl"><Users size={24} /></div>
              <h3 className="text-3xl font-serif font-bold italic">Team Command</h3>
            </div>
            <p className="text-gray-300 max-w-xl">Manage agency users, access roles, team positions, workload capacity, and account access from the Laravel user system.</p>
          </div>
          {isAdmin && (
            <button onClick={() => setIsModalOpen(true)} className="bg-white text-gray-900 px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-100 transition-all">
              <Plus size={18} className="text-[#FF6321]" /> Add Team Member
            </button>
          )}
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF6321]/20 blur-[100px] rounded-full pointer-events-none" />
      </section>

      {error && <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm border border-red-100">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <TeamMetric label="Team Members" value={stats.total} />
        <TeamMetric label="Active Accounts" value={stats.active} />
        <TeamMetric label="Leadership" value={stats.managers} />
        <TeamMetric label="Weekly Capacity" value={stats.capacity} />
      </div>

      <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-50">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-2xl font-serif font-bold text-gray-900 italic">Members</h3>
            <p className="text-sm text-gray-400 mt-1">{isAdmin ? 'Admins can edit access roles, team positions, capacity, and active status.' : 'Managers can review team assignments and access levels.'}</p>
          </div>
          <ShieldCheck className="text-gray-300" size={26} />
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-400">Loading team...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="border-b border-gray-100 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  <th className="px-4 pb-4">Member</th>
                  <th className="px-4 pb-4">Access Role</th>
                  <th className="px-4 pb-4">Team Position</th>
                  <th className="px-4 pb-4">Capacity</th>
                  <th className="px-4 pb-4">Status</th>
                  <th className="px-4 pb-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {members.map((member) => {
                  const disabled = !isAdmin || updatingUserId === member.id;
                  return (
                    <tr key={member.id} className="group hover:bg-gray-50/70 transition-all">
                      <td className="px-4 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-gray-900 text-white flex items-center justify-center font-serif italic font-bold">
                            {member.name[0]}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{member.name}</p>
                            <p className="text-xs text-gray-400">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-5">
                        <select disabled={disabled} value={member.role} onChange={(event) => updateMember(member, { role: event.target.value as UserRole })} className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-widest text-gray-600 outline-none disabled:opacity-60">
                          {permissionRoles.map((role) => <option key={role} value={role}>{role}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-5">
                        <select disabled={disabled} value={member.title || ''} onChange={(event) => updateMember(member, { title: event.target.value })} className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-sm text-gray-700 outline-none disabled:opacity-60">
                          <option value="">Select position</option>
                          {teamPositions.map((position) => <option key={position} value={position}>{position}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-5">
                        <input disabled={disabled} type="number" min={1} max={80} value={member.weekly_capacity || 40} onChange={(event) => updateMember(member, { weekly_capacity: Number(event.target.value) })} className="w-24 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-sm text-gray-700 outline-none disabled:opacity-60" />
                      </td>
                      <td className="px-4 py-5">
                        <span className={cn('px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest', member.is_active !== false ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600')}>
                          {member.is_active !== false ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-4 py-5 text-right">
                        {isAdmin ? (
                          <div className="flex items-center justify-end gap-3">
                            <button disabled={updatingUserId === member.id} onClick={() => updateMember(member, { is_active: member.is_active === false })} className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-900 disabled:opacity-50">
                              {member.is_active === false ? 'Enable' : 'Disable'}
                            </button>
                            <button
                              disabled={updatingUserId === member.id || member.id === userProfile?.id}
                              onClick={() => deleteMember(member)}
                              title={member.id === userProfile?.id ? 'You cannot delete your own account' : `Delete ${member.name}`}
                              className="p-2 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-300"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300">Read only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gray-900 text-white">
                <div>
                  <h3 className="text-2xl font-serif font-bold italic">Create Team Member</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Email/password account</p>
                </div>
                <button onClick={closeModal} className="p-2 bg-white/10 rounded-xl text-white/60 hover:text-white"><X size={20} /></button>
              </div>
              <div className="p-8 space-y-5">
                {error && <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm border border-red-100">{error}</div>}
                <Input label="Name" value={newMember.name} onChange={(value) => setNewMember({ ...newMember, name: value })} />
                <Input label="Email" type="email" value={newMember.email} onChange={(value) => setNewMember({ ...newMember, email: value })} icon={Mail} />
                <Input label="Temporary Password" value={newMember.password} onChange={(value) => setNewMember({ ...newMember, password: value })} />
                <div className="grid grid-cols-2 gap-4">
                  <Select label="Access Role" value={newMember.role} onChange={(value) => setNewMember({ ...newMember, role: value as UserRole })} options={permissionRoles} />
                  <Input label="Capacity" type="number" value={String(newMember.weekly_capacity)} onChange={(value) => setNewMember({ ...newMember, weekly_capacity: Number(value) })} />
                </div>
                <Select label="Team Position" value={newMember.title} onChange={(value) => setNewMember({ ...newMember, title: value })} options={teamPositions} placeholder="Select position" />
                <div className="rounded-2xl bg-gray-50 p-4 text-xs leading-relaxed text-gray-500">
                  <strong className="text-gray-900">Access Role</strong> controls permissions. <strong className="text-gray-900">Team Position</strong> describes their work, for example Graphic Designer, Social Media Manager, Video Editor, or Developer.
                </div>
              </div>
              <div className="p-8 bg-gray-50 flex gap-3">
                <button onClick={closeModal} disabled={isSaving} className="flex-1 py-4 bg-white border border-gray-100 text-gray-500 rounded-2xl font-bold text-sm hover:bg-gray-100 disabled:opacity-50">Cancel</button>
                <button onClick={createMember} disabled={isSaving} className="flex-[2] py-4 bg-[#FF6321] text-white rounded-2xl font-bold text-sm shadow-lg shadow-orange-200 hover:bg-[#e5591e] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {isSaving ? 'Creating...' : <><Plus size={16} /> Create Account</>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

function TeamMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-[2rem] p-6 border border-gray-50 shadow-sm">
      <div className="w-12 h-12 rounded-2xl bg-gray-50 text-[#FF6321] flex items-center justify-center mb-4">
        <UserCog size={20} />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{label}</p>
      <p className="text-3xl font-serif font-bold text-gray-900">{value}</p>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', icon: Icon }: { label: string; value: string; onChange: (value: string) => void; type?: string; icon?: React.ElementType }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">{label}</label>
      <div className="relative">
        {Icon && <Icon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />}
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className={cn('w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 pr-4 text-sm font-medium focus:outline-none focus:border-[#FF6321] transition-all', Icon ? 'pl-12' : 'pl-4')} />
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (value: string) => void; options: string[]; placeholder?: string }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 px-4 text-sm font-medium focus:outline-none focus:border-[#FF6321] capitalize">
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  );
}
