'use client';

import { useState } from 'react';
import AISummary from '@/components/AISummary';

/**
 * Test page for AI Insights feature
 * Use this to test the summary generation without recording new videos
 */
export default function InsightsTestPage() {
  const [recordingId, setRecordingId] = useState('test-recording-123');
  const [transcript, setTranscript] = useState(
    `Welcome to this product demo. Today I'll show you how to use our dashboard.
First, click on the settings icon in the top right corner.
Then navigate to the user preferences section.
You can customize your notification settings here.
Make sure to save your changes before leaving the page.
The dashboard also includes analytics features.
You can view your usage statistics in the reports tab.
That concludes our quick tour of the main features.`
  );
  const [showComponent, setShowComponent] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6">
          AI Insights Test Page
        </h1>

        <div className="space-y-4 mb-8">
          {/* Recording ID Input */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Recording ID (for storage)
            </label>
            <input
              type="text"
              value={recordingId}
              onChange={(e) => setRecordingId(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-secondary)] text-[var(--color-text-primary)]"
              placeholder="Enter a recording ID"
            />
          </div>

          {/* Transcript Input */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Transcript Text
            </label>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={8}
              className="w-full px-4 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-secondary)] text-[var(--color-text-primary)] resize-y"
              placeholder="Paste or type a transcript here..."
            />
          </div>

          {/* Load Component Button */}
          <button
            onClick={() => setShowComponent(true)}
            className="px-6 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-purple-500 text-white font-medium hover:from-purple-700 hover:to-purple-600"
          >
            Load AI Summary Component
          </button>
        </div>

        {/* AI Summary Component */}
        {showComponent && (
          <div className="border-t border-[var(--color-border-secondary)] pt-6">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
              Component Preview
            </h2>
            <AISummary sessionId={recordingId} transcript={transcript} />
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
          <h3 className="font-semibold text-[var(--color-text-primary)] mb-2">How to test:</h3>
          <ol className="list-decimal list-inside text-sm text-[var(--color-text-secondary)] space-y-1">
            <li>Enter any recording ID (or use the default)</li>
            <li>Paste a transcript or use the sample text</li>
            <li>Click "Load AI Summary Component"</li>
            <li>Click "Generate Summary" in the component</li>
            <li>The summary will be generated and stored in the database</li>
          </ol>
          <p className="mt-3 text-xs text-[var(--color-text-muted)]">
            Note: Without a GEMINI_API_KEY, a mock summary will be generated.
          </p>
        </div>
      </div>
    </div>
  );
}
