'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { apiFetch } from '@/lib/api';
import { useRouter } from 'next/navigation';

type TaskAttachment = {
  id: string;
  filename: string;
  url: string;
};

type TaskActivity = {
  id: string;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  user: { email: string } | null;
};

type Task = {
  id: string;
  title: string;
  description: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate: string | null;
  createdAt: string;
  attachments?: TaskAttachment[];
  activities?: TaskActivity[];
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'attachments' | 'activity'>('details');
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'TODO',
    priority: 'MEDIUM',
    dueDate: '',
  });

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        sortBy,
        sortOrder,
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
      });

      const res = await apiFetch(`/tasks?${query.toString()}`);
      setTasks(res.data);
      setTotalPages(res.meta.totalPages || 1);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortOrder, search, statusFilter]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      fetchTasks();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [user, fetchTasks, router]);

  // Setup SSE for real-time updates
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    
    // In a real app we'd proxy the SSE through a fetch wrapper or add token in query.
    // For simplicity, we just use EventSource. If CORS is strict, we might need a custom hook.
    // Assuming EventSource sends cookies automatically if same-origin or configured.
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const sse = new EventSource(`${baseUrl}/tasks/stream?token=${token}`, { withCredentials: true });

    sse.onmessage = (event) => {
      // In a robust implementation, we'd inspect event.type. 
      // We'll just refetch for simplicity and guaranteed consistency,
      // or we can optimistically merge if we parse the data.
      fetchTasks(); 
    };

    return () => sse.close();
  }, [user, fetchTasks]);

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const body = {
        ...formData,
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
      };

      if (editingTask) {
        // Optimistic UI for Update
        setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...body } as Task : t));
        
        await apiFetch(`/tasks/${editingTask.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch('/tasks', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }
      setIsModalOpen(false);
      setEditingTask(null);
      setFormData({ title: '', description: '', status: 'TODO', priority: 'MEDIUM', dueDate: '' });
      fetchTasks();
    } catch (error) {
      alert('Failed to save task');
      fetchTasks(); // rollback on failure
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    // Optimistic Delete
    setTasks(prev => prev.filter(t => t.id !== id));
    
    try {
      await apiFetch(`/tasks/${id}`, { method: 'DELETE' });
    } catch (error) {
      alert('Failed to delete task');
      fetchTasks(); // rollback
    }
  };

  const openEditModal = async (task: Task) => {
    // Fetch full details including activities
    const fullTask = await apiFetch(`/tasks/${task.id}`);
    setEditingTask(fullTask);
    setFormData({
      title: fullTask.title,
      description: fullTask.description || '',
      status: fullTask.status,
      priority: fullTask.priority,
      dueDate: fullTask.dueDate ? new Date(fullTask.dueDate).toISOString().split('T')[0] : '',
    });
    setActiveTab('details');
    setIsModalOpen(true);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    // Optimistic Update
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus as any } : t));
    
    try {
      await apiFetch(`/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (error) {
      alert('Failed to update status');
      fetchTasks(); // rollback
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !editingTask) return;
    const file = e.target.files[0];
    
    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      
      const response = await fetch(`${baseUrl}/tasks/${editingTask.id}/attachments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });
      
      if (!response.ok) throw new Error('Upload failed');
      
      const newAttachment = await response.json();
      setEditingTask(prev => prev ? {
        ...prev,
        attachments: [...(prev.attachments || []), newAttachment]
      } : null);
      
    } catch (error) {
      alert('File upload failed');
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-8">
      <header className="flex flex-row justify-between items-center mb-6 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Task Management</h1>
        <div className="flex items-center gap-4 relative">
          
          <button onClick={toggleTheme} className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {user.role === 'ADMIN' && (
            <button onClick={() => router.push('/admin')} className="hidden sm:block px-4 py-2 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg text-sm font-bold transition-colors">
              Admin Panel
            </button>
          )}

          <div className="relative">
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center font-bold text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:ring-offset-gray-900 transition-all shadow-sm"
            >
              {user.email.charAt(0).toUpperCase()}
            </button>
            
            {isProfileOpen && (
              <div className="absolute right-0 sm:right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 py-1 z-10">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Signed in as</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.email}</p>
                  {user.role === 'ADMIN' && <span className="inline-block mt-1 px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded font-bold">Admin</span>}
                </div>
                {user.role === 'ADMIN' && (
                  <div className="py-1 sm:hidden">
                    <button onClick={() => router.push('/admin')} className="w-full text-left px-4 py-2 text-sm text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 font-medium">
                      Admin Panel
                    </button>
                  </div>
                )}
                <div className="py-1">
                  <button onClick={logout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium">
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 flex-1">
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 text-gray-900 dark:text-white rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
            />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-4 py-2 border border-gray-300 text-gray-900 dark:text-white rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500">
              <option value="">All Statuses</option>
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="DONE">Done</option>
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full px-4 py-2 border border-gray-300 text-gray-900 dark:text-white rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500">
              <option value="createdAt">Created Date</option>
              <option value="dueDate">Due Date</option>
              <option value="priority">Priority</option>
            </select>
            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="w-full px-4 py-2 border border-gray-300 text-gray-900 dark:text-white rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500">
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
          <button
            onClick={() => {
              setEditingTask(null);
              setFormData({ title: '', description: '', status: 'TODO', priority: 'MEDIUM', dueDate: '' });
              setActiveTab('details');
              setIsModalOpen(true);
            }}
            className="w-full lg:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow transition-colors"
          >
            + New Task
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">No tasks found</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2">Try adjusting your filters or create a new task.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tasks.map((task) => (
              <div key={task.id} className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-white line-clamp-1">{task.title}</h3>
                  <span className={`px-2 py-1 text-xs font-bold rounded-full ${task.priority === 'HIGH' ? 'bg-red-100 text-red-700' : task.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                    {task.priority}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2 flex-grow">{task.description || 'No description provided.'}</p>
                
                {task.attachments && task.attachments.length > 0 && (
                  <div className="mt-2 mb-4 space-y-1">
                    <div className="flex flex-wrap gap-2">
                      {task.attachments.map(att => (
                        <a 
                          key={att.id} 
                          href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3001'}${att.url}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded hover:underline truncate max-w-[200px]"
                        >
                          📎 {att.filename}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100 dark:border-gray-700">
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusChange(task.id, e.target.value)}
                    className="text-sm text-gray-900 bg-transparent font-medium focus:outline-none dark:text-gray-300"
                  >
                    <option value="TODO" className="dark:bg-gray-800 dark:text-white">To Do</option>
                    <option value="IN_PROGRESS" className="dark:bg-gray-800 dark:text-white">In Progress</option>
                    <option value="DONE" className="dark:bg-gray-800 dark:text-white">Done</option>
                  </select>
                  
                  <div className="flex gap-2">
                    <button onClick={() => openEditModal(task)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Edit</button>
                    <button onClick={() => handleDelete(task.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 border rounded-lg disabled:opacity-50 dark:border-gray-700 dark:text-white">
              Previous
            </button>
            <span className="px-4 py-2 text-gray-700 dark:text-gray-300">Page {page} of {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-4 py-2 border rounded-lg disabled:opacity-50 dark:border-gray-700 dark:text-white">
              Next
            </button>
          </div>
        )}
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
            
            <div className="px-6 py-4 border-b dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold dark:text-white">{editingTask ? 'Edit Task' : 'Create Task'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white text-xl font-bold">&times;</button>
            </div>

            {editingTask && (
              <div className="flex border-b dark:border-gray-700 px-6 pt-2">
                <button onClick={() => setActiveTab('details')} className={`pb-2 px-4 text-sm font-medium ${activeTab === 'details' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 dark:text-gray-400'}`}>Details</button>
                <button onClick={() => setActiveTab('attachments')} className={`pb-2 px-4 text-sm font-medium ${activeTab === 'attachments' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 dark:text-gray-400'}`}>Attachments ({editingTask.attachments?.length || 0})</button>
                <button onClick={() => setActiveTab('activity')} className={`pb-2 px-4 text-sm font-medium ${activeTab === 'activity' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 dark:text-gray-400'}`}>Activity</button>
              </div>
            )}

            <div className="p-6 overflow-y-auto flex-1">
              {activeTab === 'details' && (
                <form id="task-form" onSubmit={handleCreateOrUpdate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-300 mb-1">Title</label>
                    <input required type="text" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="w-full px-3 py-2 border border-gray-300 text-gray-900 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-300 mb-1">Description</label>
                    <textarea rows={3} value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full px-3 py-2 border border-gray-300 text-gray-900 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white rounded-lg" />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-900 dark:text-gray-300 mb-1">Status</label>
                      <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})} className="w-full px-3 py-2 border border-gray-300 text-gray-900 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white rounded-lg">
                        <option value="TODO">To Do</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="DONE">Done</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-900 dark:text-gray-300 mb-1">Priority</label>
                      <select value={formData.priority} onChange={(e) => setFormData({...formData, priority: e.target.value})} className="w-full px-3 py-2 border border-gray-300 text-gray-900 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white rounded-lg">
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-300 mb-1">Due Date</label>
                    <input type="date" value={formData.dueDate} onChange={(e) => setFormData({...formData, dueDate: e.target.value})} className="w-full px-3 py-2 border border-gray-300 text-gray-900 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white rounded-lg" />
                  </div>
                </form>
              )}

              {activeTab === 'attachments' && editingTask && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center relative hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <input type="file" onChange={handleFileUpload} disabled={uploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {uploading ? 'Uploading...' : 'Click or drag file to this area to attach'}
                    </p>
                  </div>
                  {editingTask.attachments && editingTask.attachments.length > 0 ? (
                    <ul className="space-y-2 mt-4">
                      {editingTask.attachments.map(att => (
                        <li key={att.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <span className="text-sm truncate dark:text-gray-200">{att.filename}</span>
                          <a href={`http://localhost:3001${att.url}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 text-sm font-medium px-2">Download</a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500 text-center mt-4">No attachments yet.</p>
                  )}
                </div>
              )}

              {activeTab === 'activity' && editingTask && (
                <div className="space-y-4">
                  {editingTask.activities && editingTask.activities.length > 0 ? (
                    <ul className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                      {editingTask.activities.map(act => (
                        <li key={act.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-100 dark:bg-gray-700 text-slate-500 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow">
                            ⚡
                          </div>
                          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-gray-50 dark:bg-gray-700 p-4 rounded border border-slate-200 dark:border-gray-600 shadow-sm">
                            <div className="flex items-center justify-between mb-1">
                              <div className="font-bold text-slate-900 dark:text-white text-sm">{act.action}</div>
                              <time className="font-caveat font-medium text-xs text-indigo-500">{new Date(act.createdAt).toLocaleString()}</time>
                            </div>
                            <div className="text-slate-500 dark:text-gray-400 text-xs">
                              by {act.user?.email || 'Unknown'}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500 text-center mt-4">No activity logged.</p>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800 rounded-b-xl">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg dark:text-gray-300 dark:hover:bg-gray-700 transition-colors">Close</button>
              {activeTab === 'details' && (
                <button type="submit" form="task-form" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Save Task</button>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
