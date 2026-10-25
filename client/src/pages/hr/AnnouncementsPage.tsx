import { useState, useEffect, FormEvent } from 'react';
import { apiFetch } from '../../api/client';
import {
  Megaphone,
  Pin,
  Plus,
  Trash2,
  X,
  Clock,
  User,
} from 'lucide-react';
import { Announcement } from '../../types';

interface AnnouncementsPageProps {
  userRole: string;
}

export default function AnnouncementsPage({ userRole }: AnnouncementsPageProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);

  // Form
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  async function fetchAnnouncements() {
    setLoading(true);
    try {
      const res = await apiFetch<Announcement[]>('/announcements');
      if (res.data) {
        setAnnouncements(res.data);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);

    try {
      const res = await apiFetch<Announcement>('/announcements', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          isPinned,
        }),
      });

      if (res.data) {
        setComposerOpen(false);
        setTitle('');
        setContent('');
        setIsPinned(false);
        fetchAnnouncements();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to publish announcement');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await apiFetch(`/announcements/${id}`, { method: 'DELETE' });
      fetchAnnouncements();
    } catch (err: any) {
      alert(err.message || 'Failed to delete announcement');
    }
  }

  const isHrOrAdmin = userRole === 'admin' || userRole === 'hr';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Company Announcements</h1>
          <p className="page-description">Broadcast official notices, policy updates, and event schedules to all staff.</p>
        </div>
        {isHrOrAdmin && (
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            className="btn btn-primary"
          >
            <Plus size={16} strokeWidth={1.75} />
            <span>Publish announcement</span>
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {announcements.length === 0 ? (
          <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No announcements published yet.
          </div>
        ) : (
          announcements.map((item) => (
            <div
              key={item._id}
              className="card"
              style={{
                padding: 20,
                borderLeft: item.isPinned ? '4px solid var(--color-accent)' : '1px solid var(--color-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {item.isPinned && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--color-accent)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      <Pin size={12} strokeWidth={2} />
                      Pinned
                    </span>
                  )}
                  <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{item.title}</h2>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                  {isHrOrAdmin && (
                    <button
                      type="button"
                      onClick={() => handleDelete(item._id)}
                      className="btn-ghost"
                      style={{ width: 28, height: 28, padding: 0, color: 'var(--color-danger)' }}
                      title="Delete notice"
                    >
                      <Trash2 size={14} strokeWidth={1.75} />
                    </button>
                  )}
                </div>
              </div>

              <p style={{ fontSize: 13.5, color: 'var(--color-text)', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-line' }}>
                {item.content}
              </p>

              <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <User size={12} strokeWidth={1.75} />
                <span>
                  By {typeof item.authorId === 'object' && item.authorId !== null ? (item.authorId as any).name : 'HR'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Composer Drawer */}
      {composerOpen && (
        <>
          <div className="overlay-backdrop" onClick={() => setComposerOpen(false)} />
          <aside className="drawer" style={{ maxWidth: 480 }}>
            <header className="drawer-header">
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>New Announcement</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Publish message to all staff workspaces</div>
              </div>
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                className="btn-ghost"
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </header>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="drawer-body">
                <div className="form-group">
                  <label className="form-label">Subject Title *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. Eid Holidays and Office Working Schedule"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Message Content *</label>
                  <textarea
                    required
                    className="form-control input-textarea"
                    rows={8}
                    placeholder="Write announcement body here..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                  />
                  <span>Pin to top of staff noticeboards</span>
                </label>
              </div>

              <div
                style={{
                  padding: 16,
                  borderTop: '1px solid var(--color-border)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 12,
                }}
              >
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                >
                  {submitting ? 'Publishing...' : 'Publish to staff'}
                </button>
              </div>
            </form>
          </aside>
        </>
      )}
    </div>
  );
}
