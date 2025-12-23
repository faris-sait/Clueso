'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface AISummaryProps {
  sessionId: string;
  transcript?: string;
}

interface Insight {
  id: string;
  sessionId: string;
  summaryText: string;
  createdAt: string;
}

export default function AISummary({ sessionId, transcript }: AISummaryProps) {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  // Fetch existing insight on mount
  useEffect(() => {
    fetchExistingInsight();
  }, [sessionId]);

  const fetchExistingInsight = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('recording_insights')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (data && !fetchError) {
        setInsight({
          id: data.id,
          sessionId: data.session_id,
          summaryText: data.summary_text,
          createdAt: data.created_at,
        });
      }
    } catch (err) {
      // No existing insight, that's fine
    } finally {
      setInitialLoading(false);
    }
  };

  const generateSummary = async (forceRegenerate = false) => {
    if (!transcript) {
      setError('No transcript available for this recording');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // If regenerating, delete existing first
      if (forceRegenerate && insight) {
        await supabase
          .from('recording_insights')
          .delete()
          .eq('session_id', sessionId);
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/v1/insights/${sessionId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to generate summary');
      }

      setInsight(data.insight);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate summary');
    } finally {
      setLoading(false);
    }
  };

  // Parse markdown-style summary into sections
  const parseSummary = (text: string) => {
    const sections: { title: string; items: string[] }[] = [];
    let currentSection: { title: string; items: string[] } | null = null;

    text.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('## ')) {
        if (currentSection) sections.push(currentSection);
        currentSection = { title: trimmed.replace('## ', ''), items: [] };
      } else if (trimmed.startsWith('- ') && currentSection) {
        currentSection.items.push(trimmed.replace('- ', ''));
      }
    });

    if (currentSection) sections.push(currentSection);
    return sections;
  };

  if (initialLoading) {
    return (
      <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-secondary)]">
        <div className="animate-pulse flex items-center gap-2">
          <div className="w-5 h-5 bg-[var(--color-bg-tertiary)] rounded"></div>
          <div className="h-4 bg-[var(--color-bg-tertiary)] rounded w-32"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-secondary)] overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--color-border-secondary)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h3 className="font-semibold text-base text-[var(--color-text-primary)]">Insights</h3>
        </div>
        
        {!insight && (
          <button
            onClick={() => generateSummary()}
            disabled={loading || !transcript}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${loading || !transcript
                ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white hover:from-indigo-700 hover:to-indigo-600'
              }
            `}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </span>
            ) : (
              'Generate Insights'
            )}
          </button>
        )}
      </div>

      {/* Content - Scrollable */}
      <div className="p-4 overflow-y-auto flex-1 min-h-0">
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {insight ? (
          <div className="space-y-4">
            {parseSummary(insight.summaryText).map((section, idx) => (
              <div key={idx}>
                <h4 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
                  {section.title}
                </h4>
                <ul className="space-y-2">
                  {section.items.map((item, itemIdx) => (
                    <li key={itemIdx} className="flex items-start gap-2 text-sm text-[var(--color-text-primary)]">
                      <span className="text-indigo-400 mt-1">•</span>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            
            <div className="pt-3 flex items-center justify-between text-xs text-[var(--color-text-muted)] border-t border-[var(--color-border-secondary)]">
              <span>Generated {new Date(insight.createdAt).toLocaleDateString()}</span>
              <button
                onClick={() => generateSummary(true)}
                disabled={loading || !transcript}
                className="text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50 text-sm font-medium"
              >
                {loading ? 'Regenerating...' : 'Regenerate'}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-5xl mb-3">✨</div>
            <p className="text-base text-[var(--color-text-secondary)] mb-2 font-medium">
              No insights generated yet
            </p>
            <p className="text-sm text-[var(--color-text-tertiary)]">
              {transcript 
                ? 'Click "Generate Insights" to create an AI-powered analysis'
                : 'Transcript not available for this recording'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
