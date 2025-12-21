'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';

interface Feedback {
  id: string;
  message: string;
  created_at: string;
  users: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
}

interface RecordingFeedbackProps {
  sessionId: string;
}

export default function RecordingFeedback({ sessionId }: RecordingFeedbackProps) {
  const { getToken } = useAuth();
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

  useEffect(() => {
    fetchFeedback();
  }, [sessionId]);

  const fetchFeedback = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/v1/feedback/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setFeedback(data.data);
      } else {
        setError(data.error || 'Failed to load feedback');
      }
    } catch (err) {
      setError('Failed to load feedback');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/v1/feedback`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recordingId: sessionId,
          message: message.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage('');
        fetchFeedback();
      } else {
        setError(data.error || 'Failed to submit feedback');
      }
    } catch (err) {
      setError('Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getUserName = (user: Feedback['users']) => {
    if (user.first_name || user.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim();
    }
    return user.email;
  };

  return (
    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] rounded-lg p-4">
      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
        Feedback
      </h3>

      {/* Submit Form */}
      <form onSubmit={handleSubmit} className="mb-4">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Add feedback about this recording..."
          className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border-secondary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent-primary)] resize-none"
          rows={3}
        />
        <div className="flex justify-end mt-2">
          <button
            type="submit"
            disabled={submitting || !message.trim()}
            className="px-4 py-2 rounded-lg bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </form>

      {error && (
        <div className="text-red-400 text-sm mb-4">{error}</div>
      )}

      {/* Feedback List */}
      {loading ? (
        <div className="text-[var(--color-text-tertiary)] text-sm">Loading...</div>
      ) : feedback.length === 0 ? (
        <div className="text-[var(--color-text-tertiary)] text-sm">No feedback yet</div>
      ) : (
        <div className="space-y-3">
          {feedback.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border-secondary)]"
            >
              <p className="text-[var(--color-text-primary)] text-sm whitespace-pre-wrap">
                {item.message}
              </p>
              <div className="flex items-center justify-between mt-2 text-xs text-[var(--color-text-muted)]">
                <span>{getUserName(item.users)}</span>
                <span>{formatDate(item.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
