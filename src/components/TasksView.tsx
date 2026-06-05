import React, { useEffect, useId, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  FileText,
  Filter,
  Film,
  Image as ImageIcon,
  ListChecks,
  MessageSquare,
  MoreVertical,
  Paperclip,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import {
  Client,
  LaravelUser,
  Project,
  Task,
  apiTaskPriority,
  apiTaskStatus,
  laravelApi,
  taskAttachmentDownloadUrl,
  uiTaskPriority,
  uiTaskStatus,
} from '../lib/laravelApi';
import { avatarStyleForUser, userInitial } from '../lib/avatar';
import { cn, formatDate } from '../lib/utils';

interface TasksViewProps {
  forceShowModal?: boolean;
  onModalClose?: () => void;
}

const emptyTask = {
  title: '',
  description: '',
  priority: 'medium',
  status: 'todo',
  projectId: '',
  clientId: '',
  assigneeId: '',
  dueDate: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
};

export const TasksView: React.FC<TasksViewProps> = ({ forceShowModal, onModalClose }) => {
  const { user, isAdmin, isManager } = useAuth();
  const canManage = isAdmin || isManager;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [workers, setWorkers] = useState<LaravelUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [activeBoard, setActiveBoard] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [newTask, setNewTask] = useState(emptyTask);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newCommentBody, setNewCommentBody] = useState('');
  const [collaborationSaving, setCollaborationSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [taskList, projectList, clientList, teamList] = await Promise.all([
      laravelApi.tasks(),
      laravelApi.projects(),
      laravelApi.clients(),
      canManage ? laravelApi.teamMembers().catch(() => []) : Promise.resolve([]),
    ]);
    setTasks(taskList);
    setProjects(projectList);
    setClients(clientList);
    setWorkers(teamList);
    setLoading(false);
  };

  useEffect(() => {
    loadData().catch((err) => {
      setError(err.message);
      setLoading(false);
    });
  }, [canManage]);

  useEffect(() => {
    if (forceShowModal) setIsAddTaskOpen(true);
  }, [forceShowModal]);

  const handleCloseModal = () => {
    setIsAddTaskOpen(false);
    setSelectedFiles([]);
    setNewSubtaskTitle('');
    setNewCommentBody('');
    setError(null);
    onModalClose?.();
  };

  const closeEditingTask = () => {
    setEditingTask(null);
    setSelectedFiles([]);
    setNewSubtaskTitle('');
    setNewCommentBody('');
    setCollaborationSaving(false);
    setError(null);
  };

  const taskFormValue = editingTask
    ? {
      title: editingTask.title,
      description: editingTask.description || '',
      priority: uiTaskPriority(editingTask.priority),
      status: uiTaskStatus(editingTask.status),
      projectId: editingTask.project_id ? String(editingTask.project_id) : '',
      clientId: editingTask.client_id ? String(editingTask.client_id) : '',
      assigneeId: editingTask.assigned_to ? String(editingTask.assigned_to) : '',
      dueDate: editingTask.due_at ? editingTask.due_at.slice(0, 10) : '',
    }
    : newTask;

  const updateTaskForm = (patch: Partial<typeof emptyTask>) => {
    if (editingTask) {
      setEditingTask({
        ...editingTask,
        title: patch.title ?? editingTask.title,
        description: patch.description ?? editingTask.description,
        priority: patch.priority ? apiTaskPriority(patch.priority) : editingTask.priority,
        status: patch.status ? apiTaskStatus(patch.status) : editingTask.status,
        project_id: patch.projectId !== undefined ? Number(patch.projectId) || null : editingTask.project_id,
        client_id: patch.clientId !== undefined ? Number(patch.clientId) || null : editingTask.client_id,
        assigned_to: patch.assigneeId !== undefined ? Number(patch.assigneeId) || null : editingTask.assigned_to,
        due_at: patch.dueDate !== undefined ? patch.dueDate || null : editingTask.due_at,
      });
    } else {
      setNewTask((current) => ({ ...current, ...patch }));
    }
  };

  const selectedProject = projects.find((project) => String(project.id) === taskFormValue.projectId);
  const selectedClientId = Number(taskFormValue.clientId) || undefined;
  const defaultClientId = selectedProject?.client_id ?? selectedClientId ?? clients[0]?.id;

  const saveTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!taskFormValue.title.trim()) return;
    if (!defaultClientId && !editingTask) {
      setError('Choose a client before creating this task.');
      return;
    }
    if (!canManage && !editingTask) {
      setError('Only managers and admins can create tasks.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (editingTask) {
        const updatePayload: Partial<Task> = {
          status: apiTaskStatus(taskFormValue.status),
        };

        if (canManage) {
          updatePayload.title = taskFormValue.title;
          updatePayload.description = taskFormValue.description;
          updatePayload.priority = apiTaskPriority(taskFormValue.priority);
          updatePayload.due_at = taskFormValue.dueDate || null;
          updatePayload.assigned_to = taskFormValue.assigneeId ? Number(taskFormValue.assigneeId) : null;
        }

        let updated = await laravelApi.updateTask(editingTask.id, updatePayload);
        if (selectedFiles.length > 0) {
          const attachments = await laravelApi.uploadTaskAttachments(editingTask.id, selectedFiles);
          updated = { ...updated, attachments };
        }
        syncTask(updated);
        closeEditingTask();
      } else {
        const created = await laravelApi.createTask({
          title: taskFormValue.title,
          description: taskFormValue.description,
          status: apiTaskStatus(taskFormValue.status),
          priority: apiTaskPriority(taskFormValue.priority),
          project_id: taskFormValue.projectId ? Number(taskFormValue.projectId) : null,
          client_id: defaultClientId,
          assigned_to: taskFormValue.assigneeId ? Number(taskFormValue.assigneeId) : null,
          due_at: taskFormValue.dueDate || null,
        }, selectedFiles);
        setTasks((items) => [created, ...items]);
        setNewTask(emptyTask);
        setSelectedFiles([]);
        handleCloseModal();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save task.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateStatus = async (task: Task, nextStatus: string) => {
    const updated = await laravelApi.updateTask(task.id, { status: apiTaskStatus(nextStatus) });
    setTasks((items) => items.map((item) => item.id === task.id ? updated : item));
  };

  const cycleStatus = (task: Task) => {
    const statuses = ['todo', 'in-progress', 'review', 'done'];
    const current = uiTaskStatus(task.status);
    const next = statuses[(statuses.indexOf(current) + 1) % statuses.length];
    return updateStatus(task, next);
  };

  const deleteTask = async (task: Task) => {
    if (!canManage) return;
    if (!window.confirm('Delete this task?')) return;
    await laravelApi.deleteTask(task.id);
    setTasks((items) => items.filter((item) => item.id !== task.id));
  };

  const openTaskDetails = (task: Task) => {
    setEditingTask(task);
    setSelectedFiles([]);
    setNewSubtaskTitle('');
    setNewCommentBody('');
    setError(null);
  };

  const syncTask = (task: Task) => {
    setTasks((items) => items.map((item) => item.id === task.id ? task : item));
    setEditingTask((current) => current?.id === task.id ? task : current);
  };

  const addSubtask = async () => {
    if (!editingTask || !newSubtaskTitle.trim()) return;
    setCollaborationSaving(true);
    setError(null);

    try {
      const subtask = await laravelApi.createTaskSubtask(editingTask.id, { title: newSubtaskTitle.trim() });
      syncTask({ ...editingTask, subtasks: [...(editingTask.subtasks || []), subtask] });
      setNewSubtaskTitle('');
    } catch (err: any) {
      setError(err.message || 'Failed to add checklist item.');
    } finally {
      setCollaborationSaving(false);
    }
  };

  const toggleSubtask = async (subtaskId: number, isCompleted: boolean) => {
    if (!editingTask) return;
    setCollaborationSaving(true);
    setError(null);

    try {
      const subtask = await laravelApi.updateTaskSubtask(editingTask.id, subtaskId, { is_completed: isCompleted });
      syncTask({
        ...editingTask,
        subtasks: (editingTask.subtasks || []).map((item) => item.id === subtask.id ? subtask : item),
      });
    } catch (err: any) {
      setError(err.message || 'Failed to update checklist item.');
    } finally {
      setCollaborationSaving(false);
    }
  };

  const deleteSubtask = async (subtaskId: number) => {
    if (!editingTask) return;
    setCollaborationSaving(true);
    setError(null);

    try {
      await laravelApi.deleteTaskSubtask(editingTask.id, subtaskId);
      syncTask({
        ...editingTask,
        subtasks: (editingTask.subtasks || []).filter((item) => item.id !== subtaskId),
      });
    } catch (err: any) {
      setError(err.message || 'Failed to delete checklist item.');
    } finally {
      setCollaborationSaving(false);
    }
  };

  const addComment = async () => {
    if (!editingTask || !newCommentBody.trim()) return;
    setCollaborationSaving(true);
    setError(null);

    try {
      const comment = await laravelApi.createTaskComment(editingTask.id, { body: newCommentBody.trim() });
      syncTask({ ...editingTask, comments: [comment, ...(editingTask.comments || [])] });
      setNewCommentBody('');
    } catch (err: any) {
      setError(err.message || 'Failed to add comment.');
    } finally {
      setCollaborationSaving(false);
    }
  };

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const uiStatus = uiTaskStatus(task.status);
    const uiPriority = uiTaskPriority(task.priority);
    const matchesBoard = activeBoard === 'all' || uiStatus === activeBoard;
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) || task.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPriority = !filterPriority || uiPriority === filterPriority;
    return matchesBoard && matchesSearch && matchesPriority;
  }), [activeBoard, filterPriority, searchTerm, tasks]);

  const counts = {
    total: tasks.length,
    todo: tasks.filter((task) => task.status === 'todo').length,
    inProgress: tasks.filter((task) => task.status === 'in_progress').length,
    review: tasks.filter((task) => task.status === 'review').length,
    done: tasks.filter((task) => task.status === 'completed').length,
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-wrap items-center gap-4">
        {[
          { id: 'all', label: 'All Tasks', count: counts.total },
          { id: 'todo', label: 'To Do', count: counts.todo },
          { id: 'in-progress', label: 'In Progress', count: counts.inProgress },
          { id: 'review', label: 'Review', count: counts.review },
          { id: 'done', label: 'Completed', count: counts.done },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveBoard(tab.id)}
            className={cn('px-5 py-2.5 rounded-2xl flex items-center gap-3 font-medium transition-all text-sm border', activeBoard === tab.id ? 'bg-gray-900 text-white border-gray-900 shadow-lg shadow-gray-200' : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50')}
          >
            {tab.label}
            <span className={cn('px-2 py-0.5 rounded-lg text-[10px] font-bold', activeBoard === tab.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400')}>{tab.count}</span>
          </button>
        ))}

        {canManage && (
          <button onClick={() => setIsAddTaskOpen(true)} className="ml-auto bg-gray-900 text-white px-5 py-2.5 rounded-2xl flex items-center gap-2 text-sm font-bold shadow-lg shadow-gray-100 hover:bg-gray-800 transition-all">
            <Plus size={18} />
            Create Task
          </button>
        )}

        <div className="flex bg-white p-1 rounded-2xl border border-gray-100 shadow-sm">
          {(['table', 'kanban'] as const).map((mode) => (
            <button key={mode} onClick={() => setViewMode(mode)} className={cn('px-4 py-2 rounded-xl text-xs font-bold transition-all capitalize', viewMode === mode ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-900')}>
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-50">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-serif font-bold text-gray-900 italic">Work Stream</h3>
          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder="Find task..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-xs font-medium outline-none focus:ring-1 focus:ring-gray-900 w-40 md:w-60"
            />
            <div className="relative">
              <button onClick={() => setIsFilterDropdownOpen((value) => !value)} className={cn('p-2 transition-all border rounded-xl flex items-center gap-2 text-xs font-bold', filterPriority ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-400 hover:text-gray-900 border-gray-100')}>
                <Filter size={18} />
                {filterPriority || 'Priority'}
              </button>
              <AnimatePresence>
                {isFilterDropdownOpen && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 top-full mt-2 w-40 bg-white border border-gray-100 rounded-2xl shadow-xl z-20 overflow-hidden">
                    {[null, 'low', 'medium', 'high', 'urgent'].map((priority) => (
                      <button key={priority || 'all'} onClick={() => { setFilterPriority(priority); setIsFilterDropdownOpen(false); }} className="w-full text-left px-5 py-3 text-xs font-bold uppercase tracking-widest hover:bg-gray-50 transition-all text-gray-500">
                        {priority || 'All'}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {error && <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-sm border border-red-100">{error}</div>}
        {loading ? (
          <div className="py-20 text-center text-gray-400">Loading tasks...</div>
        ) : viewMode === 'kanban' ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {['todo', 'in-progress', 'review', 'done'].map((status) => (
              <div key={status} className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400">{status.replace('-', ' ')}</h4>
                <div className="space-y-4 min-h-[420px]">
                  {filteredTasks.filter((task) => uiTaskStatus(task.status) === status).map((task) => <TaskCard key={task.id} task={task} projects={projects} workers={workers} onCycle={() => cycleStatus(task)} onEdit={() => openTaskDetails(task)} onDelete={() => deleteTask(task)} canManage={canManage} />)}
                </div>
              </div>
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <EmptyTasks onCreate={canManage ? () => setIsAddTaskOpen(true) : undefined} />
        ) : (
          <div className="space-y-4">
            {filteredTasks.map((task, index) => (
              <motion.div
                key={task.id}
                role="button"
                tabIndex={0}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => openTaskDetails(task)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openTaskDetails(task);
                  }
                }}
                className={cn('group cursor-pointer rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm transition-all hover:border-gray-200 hover:bg-gray-50/70 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#FF6321]/30', task.status === 'completed' && 'opacity-60')}
              >
                <div className="flex items-start gap-5">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    cycleStatus(task);
                  }}
                  className={cn('mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border-2 transition-all', task.status === 'completed' ? 'bg-[#00c875] border-[#00c875] text-white' : 'border-gray-100 text-transparent hover:border-gray-900 hover:text-gray-900')}
                  title="Move task to next status"
                >
                  <CheckCircle2 size={20} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h4 className={cn('text-lg font-bold text-gray-900 group-hover:text-[#FF6321] transition-all truncate', task.status === 'completed' && 'line-through text-gray-400')}>{task.title}</h4>
                    {task.project_id && <div className="px-2 py-0.5 bg-gray-100 text-gray-400 rounded-lg text-[10px] font-bold uppercase tracking-wider">{projects.find((project) => project.id === task.project_id)?.name || 'Project'}</div>}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 font-medium">
                    <span className="flex items-center gap-1.5"><Clock size={14} /> {task.due_at ? formatDate(task.due_at) : 'No deadline'}</span>
                    <span>{workers.find((worker) => worker.id === task.assigned_to)?.name || 'Unassigned'}</span>
                  </div>
                  {task.description ? (
                    <p className="mt-4 max-w-3xl whitespace-pre-line text-sm font-medium leading-relaxed text-gray-500 line-clamp-3">{task.description}</p>
                  ) : (
                    <p className="mt-4 text-sm font-medium italic text-gray-300">No description added yet.</p>
                  )}
                  <TaskAttachmentPreviewStrip task={task} />
                  <TaskSignals task={task} />
                </div>
                <div className="flex shrink-0 flex-col items-end gap-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Badge value={uiTaskPriority(task.priority)} type="priority" />
                    <Badge value={uiTaskStatus(task.status)} type="status" />
                  </div>
                  <div className="flex items-center overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      openTaskDetails(task);
                    }}
                    className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-gray-400 transition-all hover:text-gray-900"
                    title="Open task details"
                  >
                    Open details
                  </button>
                  {canManage && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteTask(task);
                      }}
                      className="p-3 text-gray-400 hover:text-red-500 transition-all"
                      title="Delete task"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                  </div>
                </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {(isAddTaskOpen || editingTask) && (
          <div className={cn(
            'fixed inset-0 z-50 bg-black/40 backdrop-blur-sm',
            editingTask ? 'flex justify-end p-0' : 'flex items-center justify-center p-4',
          )}>
            {editingTask && (
              <button
                type="button"
                aria-label="Close task details"
                className="absolute inset-0 cursor-default"
                onClick={closeEditingTask}
                disabled={isSaving}
              />
            )}
            <motion.div
              key={editingTask ? 'task-detail-drawer' : 'create-task-modal'}
              initial={editingTask ? { x: '100%' } : { scale: 0.9, opacity: 0 }}
              animate={editingTask ? { x: 0 } : { scale: 1, opacity: 1 }}
              exit={editingTask ? { x: '100%' } : { scale: 0.9, opacity: 0 }}
              transition={editingTask ? { type: 'spring', stiffness: 300, damping: 34 } : undefined}
              className={cn(
                'relative z-10 bg-white shadow-2xl',
                editingTask
                  ? 'h-full w-full max-w-3xl overflow-y-auto border-l border-gray-100'
                  : 'w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-[2.5rem]',
              )}
            >
              <div className={cn(
                'sticky top-0 z-10 flex items-start justify-between gap-6 border-b bg-white',
                editingTask ? 'border-gray-100 p-6' : 'border-gray-50 p-8',
              )}>
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">
                    {editingTask ? 'Task detail' : 'New work item'}
                  </p>
                  <h3 className="text-2xl font-serif font-bold italic">{editingTask ? taskFormValue.title || 'Edit Task' : 'Create New Task'}</h3>
                  {editingTask && (
                    <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-widest text-gray-400">
                      <span className="rounded-full bg-gray-900 px-3 py-1 text-white">Details</span>
                      <span className="rounded-full bg-gray-100 px-3 py-1">Files</span>
                      <span className="rounded-full bg-gray-100 px-3 py-1">Activity</span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => editingTask ? closeEditingTask() : handleCloseModal()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-500 transition-all hover:bg-gray-900 hover:text-white"
                  aria-label="Close task modal"
                  disabled={isSaving}
                >
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={saveTask} className={cn('space-y-6', editingTask ? 'p-6 pb-0' : 'p-8')}>
                {error && <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm border border-red-100">{error}</div>}
                <Input label="Title" value={taskFormValue.title} onChange={(value) => updateTaskForm({ title: value })} disabled={isSaving || (!!editingTask && !canManage)} />
                <Textarea label="Description" value={taskFormValue.description} onChange={(value) => updateTaskForm({ description: value })} disabled={isSaving || (!!editingTask && !canManage)} />
                <div className="grid grid-cols-2 gap-4">
                  <Select label="Assign To" value={taskFormValue.assigneeId} onChange={(value) => updateTaskForm({ assigneeId: value })} disabled={isSaving || !canManage} options={[{ value: '', label: 'Unassigned' }, ...workers.map((worker) => ({ value: String(worker.id), label: worker.name }))]} />
                  <Select label="Project / Workstream" value={taskFormValue.projectId} onChange={(value) => updateTaskForm({ projectId: value, clientId: '' })} disabled={isSaving || !!editingTask} options={[{ value: '', label: 'No project / daily client task' }, ...projects.map((project) => ({ value: String(project.id), label: project.name }))]} />
                </div>
                {!selectedProject && !editingTask && (
                  <Select label="Client" value={taskFormValue.clientId} onChange={(value) => updateTaskForm({ clientId: value })} disabled={isSaving} options={[{ value: '', label: clients.length === 0 ? 'Create a client first' : 'Select client' }, ...clients.map((client) => ({ value: String(client.id), label: client.name }))]} />
                )}
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Due Date" type="date" value={taskFormValue.dueDate} onChange={(value) => updateTaskForm({ dueDate: value })} disabled={isSaving || (!!editingTask && !canManage)} />
                  <Select label="Priority" value={taskFormValue.priority} onChange={(value) => updateTaskForm({ priority: value })} disabled={isSaving || !canManage} options={['low', 'medium', 'high', 'urgent'].map((value) => ({ value, label: value }))} />
                </div>
                <Select label="Status" value={taskFormValue.status} onChange={(value) => updateTaskForm({ status: value })} disabled={isSaving} options={[{ value: 'todo', label: 'To Do' }, { value: 'in-progress', label: 'In Progress' }, { value: 'review', label: 'Review' }, { value: 'done', label: 'Done' }]} />
                {editingTask && <AttachmentLinks task={editingTask} compact={false} />}
                <FilePicker selectedFiles={selectedFiles} onChange={setSelectedFiles} onError={setError} disabled={isSaving} />
                {editingTask && (
                  <TaskCollaborationPanel
                    task={editingTask}
                    currentUserName={user?.displayName || 'You'}
                    currentUserAvatar={user ? { id: user.id, name: user.displayName, email: user.email, avatar_color: user.avatarColor } : null}
                    subtaskTitle={newSubtaskTitle}
                    commentBody={newCommentBody}
                    onSubtaskTitleChange={setNewSubtaskTitle}
                    onCommentBodyChange={setNewCommentBody}
                    onAddSubtask={addSubtask}
                    onToggleSubtask={toggleSubtask}
                    onDeleteSubtask={deleteSubtask}
                    onAddComment={addComment}
                    isSaving={collaborationSaving}
                  />
                )}
                <div className={cn(
                  'flex gap-4 pt-4',
                  editingTask && 'sticky bottom-0 -mx-6 mt-8 border-t border-gray-100 bg-white/95 p-6 backdrop-blur',
                )}>
                  <button type="button" onClick={() => editingTask ? closeEditingTask() : handleCloseModal()} className="flex-1 py-4 text-sm font-bold text-gray-400 hover:text-gray-900 transition-all" disabled={isSaving}>Cancel</button>
                  <button type="submit" disabled={isSaving} className="flex-1 py-4 bg-gray-900 text-white rounded-[1.25rem] font-bold text-sm hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 disabled:opacity-50">{isSaving ? 'Saving...' : editingTask ? 'Save Changes' : 'Create Task'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

function TaskCard({ task, projects, workers, onCycle, onEdit, onDelete, canManage }: { task: Task; projects: Project[]; workers: LaravelUser[]; onCycle: () => void; onEdit: () => void; onDelete: () => void; canManage: boolean }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onEdit();
        }
      }}
      className="group cursor-pointer rounded-3xl border border-gray-100 bg-gray-50 p-5 transition-all hover:border-[#FF6321] hover:bg-white hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#FF6321]/30"
    >
      <div className="flex justify-between items-start mb-3">
        <Badge value={uiTaskPriority(task.priority)} type="priority" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300 transition-all group-hover:text-[#FF6321]">Open</span>
      </div>
      <h5 className="text-sm font-bold text-gray-900 mb-2">{task.title}</h5>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{projects.find((project) => project.id === task.project_id)?.name || 'General'}</p>
      {task.description && <p className="mt-3 line-clamp-3 text-xs font-medium leading-relaxed text-gray-500">{task.description}</p>}
      <TaskAttachmentPreviewStrip task={task} compact />
      <TaskSignals task={task} />
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200/50">
        <span className="text-[10px] font-bold text-gray-400">{workers.find((worker) => worker.id === task.assigned_to)?.name || 'Unassigned'}</span>
        <span className="text-[10px] font-bold text-gray-400">{task.due_at ? formatDate(task.due_at) : 'No date'}</span>
      </div>
      <div className="flex gap-2 mt-4">
        <button
          onClick={(event) => {
            event.stopPropagation();
            onCycle();
          }}
          className="flex-1 py-2 bg-white rounded-xl text-[10px] font-bold text-gray-500 hover:text-gray-900"
        >
          Next Status
        </button>
        {canManage && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="px-3 py-2 bg-white rounded-xl text-red-400 hover:text-red-600"
            title="Delete task"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function TaskAttachmentPreviewStrip({ task, compact = false }: { task: Task; compact?: boolean }) {
  const attachments = task.attachments || [];

  if (attachments.length === 0) return null;

  const visibleAttachments = attachments.slice(0, compact ? 2 : 4);
  const extraCount = attachments.length - visibleAttachments.length;

  return (
    <div className={cn('mt-4 flex flex-wrap gap-3', compact && 'gap-2')}>
      {visibleAttachments.map((attachment) => {
        const isImage = attachment.mime_type?.startsWith('image/');
        return (
          <a
            key={attachment.id}
            href={taskAttachmentDownloadUrl(task.id, attachment.id)}
            className={cn(
              'group/attachment overflow-hidden rounded-2xl border border-gray-100 bg-white text-left shadow-sm transition-all hover:border-gray-300 hover:shadow-md',
              isImage ? (compact ? 'h-24 w-full' : 'h-28 w-44') : 'inline-flex max-w-full items-center gap-2 px-3 py-2',
            )}
            title={attachment.name}
          >
            {isImage ? (
              <TaskImagePreview taskId={task.id} attachmentId={attachment.id} name={attachment.name} />
            ) : (
              <>
                <FileIcon mime={attachment.mime_type} />
                <span className="min-w-0 truncate text-[11px] font-bold text-gray-500 group-hover/attachment:text-gray-900">{attachment.name}</span>
              </>
            )}
          </a>
        );
      })}
      {extraCount > 0 && (
        <span className="rounded-2xl bg-gray-100 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
          +{extraCount} more
        </span>
      )}
    </div>
  );
}

function TaskImagePreview({ taskId, attachmentId, name }: { taskId: number | string; attachmentId: number | string; name: string }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    fetch(taskAttachmentDownloadUrl(taskId, attachmentId), {
      credentials: 'include',
      headers: { Accept: 'image/*,*/*' },
    })
      .then((response) => response.ok ? response.blob() : Promise.reject(new Error('Preview failed')))
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (active) setPreviewUrl(null);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachmentId, taskId]);

  if (!previewUrl) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-50 text-gray-300">
        <ImageIcon size={24} />
      </div>
    );
  }

  return <img src={previewUrl} alt={name} className="h-full w-full object-cover transition-transform duration-300 group-hover/attachment:scale-105" />;
}

function FileIcon({ mime }: { mime?: string | null }) {
  if (mime?.startsWith('image/')) return <ImageIcon size={14} />;
  if (mime?.startsWith('video/')) return <Film size={14} />;
  return <FileText size={14} />;
}

function TaskSignals({ task }: { task: Task }) {
  const totalSubtasks = task.subtasks?.length || 0;
  const completedSubtasks = task.subtasks?.filter((subtask) => subtask.is_completed).length || 0;
  const commentCount = task.comments?.length || 0;
  const attachmentCount = task.attachments?.length || 0;
  const signals = [
    totalSubtasks > 0 ? { icon: ListChecks, label: `${completedSubtasks}/${totalSubtasks} subtasks` } : null,
    commentCount > 0 ? { icon: MessageSquare, label: `${commentCount} comment${commentCount === 1 ? '' : 's'}` } : null,
    attachmentCount > 0 ? { icon: Paperclip, label: `${attachmentCount} file${attachmentCount === 1 ? '' : 's'}` } : null,
  ].filter(Boolean) as Array<{ icon: typeof ListChecks; label: string }>;

  if (signals.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {signals.map((signal) => {
        const Icon = signal.icon;
        return (
          <span key={signal.label} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <Icon size={12} />
            {signal.label}
          </span>
        );
      })}
    </div>
  );
}

function TaskCollaborationPanel({
  task,
  currentUserName,
  currentUserAvatar,
  subtaskTitle,
  commentBody,
  onSubtaskTitleChange,
  onCommentBodyChange,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onAddComment,
  isSaving,
}: {
  task: Task;
  currentUserName: string;
  currentUserAvatar: Pick<LaravelUser, 'id' | 'name' | 'email' | 'avatar_color'> | null;
  subtaskTitle: string;
  commentBody: string;
  onSubtaskTitleChange: (value: string) => void;
  onCommentBodyChange: (value: string) => void;
  onAddSubtask: () => void;
  onToggleSubtask: (subtaskId: number, isCompleted: boolean) => void;
  onDeleteSubtask: (subtaskId: number) => void;
  onAddComment: () => void;
  isSaving: boolean;
}) {
  const subtasks = task.subtasks || [];
  const comments = task.comments || [];
  const completedSubtasks = subtasks.filter((subtask) => subtask.is_completed).length;
  const progress = subtasks.length > 0 ? Math.round((completedSubtasks / subtasks.length) * 100) : 0;
  const canAddSubtask = subtaskTitle.trim().length > 0 && !isSaving;
  const canAddComment = commentBody.trim().length > 0 && !isSaving;

  return (
    <div className="space-y-6 rounded-[2rem] border border-gray-100 bg-gray-50/60 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-gray-900">Task progress</h4>
          <p className="text-xs font-medium text-gray-400">{completedSubtasks} of {subtasks.length} subtasks complete</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-gray-500 shadow-sm">{progress}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-[#00c875] transition-all" style={{ width: `${progress}%` }} />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900"><ListChecks size={16} /> Subtasks</h4>
        </div>
        <div className="space-y-2">
          {subtasks.map((subtask) => (
            <div key={subtask.id} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-gray-100">
              <button
                type="button"
                onClick={() => onToggleSubtask(subtask.id, !subtask.is_completed)}
                disabled={isSaving}
                className={cn('flex h-6 w-6 items-center justify-center rounded-lg border text-white transition-all', subtask.is_completed ? 'border-[#00c875] bg-[#00c875]' : 'border-gray-200 bg-white text-transparent hover:border-gray-900 hover:text-gray-900')}
              >
                <CheckCircle2 size={15} />
              </button>
              <span className={cn('flex-1 text-sm font-bold text-gray-700', subtask.is_completed && 'text-gray-400 line-through')}>{subtask.title}</span>
              <button type="button" onClick={() => onDeleteSubtask(subtask.id)} disabled={isSaving} className="text-gray-300 transition-all hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {subtasks.length === 0 && <p className="rounded-2xl bg-white px-4 py-3 text-xs font-medium text-gray-400">No subtasks yet. Add checklist steps for design, copy, approval, publishing, or reporting.</p>}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={subtaskTitle}
            onChange={(event) => onSubtaskTitleChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && canAddSubtask) {
                event.preventDefault();
                onAddSubtask();
              }
            }}
            placeholder="Type to add a subtask..."
            disabled={isSaving}
            className="min-w-0 flex-1 rounded-2xl border border-gray-100 bg-white px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-gray-900"
          />
          <button type="button" onClick={onAddSubtask} disabled={!canAddSubtask} className="rounded-2xl bg-gray-900 px-4 py-3 text-sm font-bold text-white transition-all disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400">
            <Plus size={16} />
          </button>
        </div>
      </section>

      <section>
        <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900"><MessageSquare size={16} /> Comments & activity</h4>
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={avatarStyleForUser(currentUserAvatar)}>
              {userInitial(currentUserName)}
            </div>
            <div className="flex-1">
              <textarea
                value={commentBody}
                onChange={(event) => onCommentBodyChange(event.target.value)}
                placeholder="Add a comment or update..."
                disabled={isSaving}
                className="h-20 w-full rounded-2xl border border-gray-100 bg-white px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-gray-900"
              />
              <div className="mt-2 flex justify-end">
                <button type="button" onClick={onAddComment} disabled={!canAddComment} className="inline-flex items-center gap-2 rounded-2xl bg-[#FF6321] px-4 py-2 text-xs font-bold text-white shadow-lg shadow-orange-100 transition-all disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none">
                  <Send size={14} />
                  Comment
                </button>
              </div>
            </div>
          </div>
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 rounded-2xl bg-white p-4 ring-1 ring-gray-100">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={avatarStyleForUser(comment.user)}>
                {userInitial(comment.user?.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">{comment.user?.name || 'Unknown user'}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300">{comment.created_at ? formatDate(comment.created_at) : 'Just now'}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-gray-500">{comment.body}</p>
              </div>
            </div>
          ))}
          {comments.length === 0 && <p className="rounded-2xl bg-white px-4 py-3 text-xs font-medium text-gray-400">No comments yet. Keep decisions and updates tied to this task.</p>}
        </div>
      </section>
    </div>
  );
}

function FilePicker({ selectedFiles, onChange, onError, disabled }: { selectedFiles: File[]; onChange: (files: File[]) => void; onError: (message: string | null) => void; disabled?: boolean }) {
  const inputId = useId();

  const addFiles = (files: File[]) => {
    onError(null);

    const validFiles = files.filter((file) => file.size <= 20 * 1024 * 1024);
    if (validFiles.length !== files.length) {
      onError('Each attachment must be 20MB or smaller.');
    }

    const nextFiles = [...selectedFiles, ...validFiles].slice(0, 5);
    if (selectedFiles.length + validFiles.length > 5) {
      onError('You can attach up to 5 files per task.');
    }

    onChange(nextFiles);
  };

  const removeFile = (index: number) => {
    onChange(selectedFiles.filter((_, fileIndex) => fileIndex !== index));
  };

  return (
    <div>
      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Attachments</label>
      <input
        id={inputId}
        aria-label="Task attachments"
        type="file"
        multiple
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          const files = Array.from(event.target.files || []);
          addFiles(files);
          event.target.value = '';
        }}
      />
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (disabled) return;
          addFiles(Array.from(event.dataTransfer.files || []));
        }}
        className={cn(
          'relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5 text-center transition-all hover:border-gray-900 hover:bg-white',
          disabled && 'pointer-events-none opacity-60',
        )}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-gray-900 shadow-sm">
          <Paperclip size={18} />
        </span>
        <span className="text-sm font-bold text-gray-900">Attach files to this task</span>
        <span className="text-[11px] font-medium text-gray-400">Click here or drag files into this box.</span>
      </label>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium text-gray-400">Up to 5 files, 20MB each. Use this for briefs, images, ad scripts, PDFs, or brand assets.</p>
        <label htmlFor={inputId} className={cn('shrink-0 cursor-pointer text-[11px] font-bold uppercase tracking-widest text-gray-900 hover:text-[#FF6321]', disabled && 'pointer-events-none opacity-60')}>
          Add file
        </label>
      </div>
      {selectedFiles.length > 0 && (
        <div className="mt-3 space-y-2">
          {selectedFiles.map((file, index) => (
            <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-xs font-bold text-gray-600 shadow-sm ring-1 ring-gray-100">
              <span className="min-w-0 truncate">{file.name}</span>
              <div className="ml-3 flex items-center gap-3 text-gray-400">
                <span>{formatFileSize(file.size)}</span>
                <button type="button" onClick={() => removeFile(index)} className="hover:text-red-500" disabled={disabled}>
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AttachmentLinks({ task, compact = true }: { task: Task; compact?: boolean }) {
  const attachments = task.attachments || [];

  if (attachments.length === 0) {
    return compact ? null : <p className="text-xs font-medium text-gray-400">No attachments on this task.</p>;
  }

  return (
    <div className={cn('flex flex-wrap gap-2', compact ? 'mt-3' : 'rounded-2xl bg-gray-50 p-4')}>
      {attachments.map((attachment) => (
        <a
          key={attachment.id}
          href={taskAttachmentDownloadUrl(task.id, attachment.id)}
          className="inline-flex max-w-full items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-[11px] font-bold text-gray-500 transition-all hover:bg-gray-900 hover:text-white"
        >
          <Paperclip size={13} />
          <span className="truncate">{attachment.name}</span>
          {!compact && <span className="text-current/60">{formatFileSize(attachment.size)}</span>}
        </a>
      ))}
    </div>
  );
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function Badge({ value, type }: { value?: string | null; type: 'status' | 'priority' }) {
  const normalizedValue = value || (type === 'priority' ? 'medium' : 'todo');
  const map: Record<string, string> = {
    done: 'bg-[#00c875] text-white',
    'in-progress': 'bg-[#ffcb00] text-gray-900',
    review: 'bg-[#579bfc] text-white',
    todo: 'bg-[#c4c4c4] text-white',
    urgent: 'bg-[#df2f4a] text-white',
    high: 'bg-[#ff642e] text-white',
    medium: 'bg-[#579bfc] text-white',
    low: 'bg-[#784bd1] text-white',
  };
  return <div className={cn('px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest min-w-[80px] text-center', map[normalizedValue] || 'bg-gray-100 text-gray-400')}>{normalizedValue.replace('-', ' ')}</div>;
}

function EmptyTasks({ onCreate }: { onCreate?: () => void }) {
  return (
    <div className="py-20 text-center">
      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle2 size={32} className="text-gray-200" />
      </div>
      <p className="text-gray-400 font-medium italic mb-6">No matching tasks.</p>
      {onCreate && <button onClick={onCreate} className="px-5 py-3 bg-gray-900 text-white rounded-2xl text-sm font-bold">Create Task</button>}
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
