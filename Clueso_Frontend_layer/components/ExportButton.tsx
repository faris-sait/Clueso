'use client';

import { useState, useRef } from 'react';
import { AudioData, VideoData } from '@/hooks/useWebSocketConnection';

interface ExportButtonProps {
    audioData: AudioData | null;
    videoData: VideoData | null;
    sessionId: string;
}

type ExportFormat = 'webm' | 'mp4';
type ExportStatus = 'idle' | 'preparing' | 'merging' | 'downloading' | 'success' | 'error';

export default function ExportButton({ audioData, videoData, sessionId }: ExportButtonProps) {
    const [status, setStatus] = useState<ExportStatus>('idle');
    const [format, setFormat] = useState<ExportFormat>('webm');
    const [progress, setProgress] = useState(0);
    const [showFormatMenu, setShowFormatMenu] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const canExport = audioData && videoData;

    const handleExport = async () => {
        if (!canExport) return;

        setStatus('preparing');
        setProgress(0);
        setErrorMessage('');

        try {
            // Fetch both video and audio
            setProgress(10);
            const [videoResponse, audioResponse] = await Promise.all([
                fetch(videoData.url),
                fetch(audioData.url)
            ]);

            if (!videoResponse.ok || !audioResponse.ok) {
                throw new Error('Failed to fetch media files');
            }

            setProgress(30);

            const [videoBlob, audioBlob] = await Promise.all([
                videoResponse.blob(),
                audioResponse.blob()
            ]);

            setProgress(50);
            setStatus('merging');

            // Browser-based merge (takes ~40s for 40s video)
            const mergedBlob = await mergeVideoAudio(videoBlob, audioBlob, (p) => {
                setProgress(50 + (p * 0.4)); // 50-90%
            });

            setProgress(90);
            setStatus('downloading');

            // Download the merged file
            const url = URL.createObjectURL(mergedBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `recording_${sessionId}.webm`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setTimeout(() => URL.revokeObjectURL(url), 100);

            setProgress(100);
            setStatus('success');

            setTimeout(() => {
                setStatus('idle');
                setProgress(0);
            }, 3000);

        } catch (error) {
            console.error('Export failed:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Export failed');
            setStatus('error');
            setTimeout(() => {
                setStatus('idle');
                setProgress(0);
                setErrorMessage('');
            }, 5000);
        }
    };

    // Helper function to merge video and audio
    const mergeVideoAudio = async (
        videoBlob: Blob,
        audioBlob: Blob,
        onProgress: (progress: number) => void
    ): Promise<Blob> => {
        return new Promise(async (resolve, reject) => {
            try {
                // Create video and audio elements
                const video = document.createElement('video');
                const audio = document.createElement('audio');

                video.src = URL.createObjectURL(videoBlob);
                audio.src = URL.createObjectURL(audioBlob);

                // Wait for metadata to load
                await Promise.all([
                    new Promise(res => video.onloadedmetadata = res),
                    new Promise(res => audio.onloadedmetadata = res)
                ]);

                onProgress(0.2);

                // Create canvas for video frames
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    throw new Error('Failed to get canvas context');
                }

                // Create MediaStream from canvas
                const canvasStream = canvas.captureStream(30); // 30 FPS

                // Get audio track from audio element
                const audioContext = new AudioContext();
                const audioSource = audioContext.createMediaElementSource(audio);
                const audioDestination = audioContext.createMediaStreamDestination();
                audioSource.connect(audioDestination);

                // Combine video and audio streams
                const combinedStream = new MediaStream([
                    ...canvasStream.getVideoTracks(),
                    ...audioDestination.stream.getAudioTracks()
                ]);

                onProgress(0.4);

                // Setup MediaRecorder
                const mediaRecorder = new MediaRecorder(combinedStream, {
                    mimeType: 'video/webm;codecs=vp9,opus'
                });

                const chunks: Blob[] = [];
                mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) {
                        chunks.push(e.data);
                    }
                };

                mediaRecorder.onstop = () => {
                    const mergedBlob = new Blob(chunks, { type: 'video/webm' });
                    
                    // Cleanup
                    URL.revokeObjectURL(video.src);
                    URL.revokeObjectURL(audio.src);
                    audioContext.close();
                    
                    onProgress(1);
                    resolve(mergedBlob);
                };

                mediaRecorder.onerror = (e) => {
                    reject(new Error('MediaRecorder error'));
                };

                // Start recording
                mediaRecorder.start();
                video.play();
                audio.play();

                // Draw video frames to canvas
                const drawFrame = () => {
                    if (!video.paused && !video.ended) {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        requestAnimationFrame(drawFrame);
                        
                        // Update progress based on video time
                        const progress = video.currentTime / video.duration;
                        onProgress(0.4 + (progress * 0.6));
                    }
                };
                drawFrame();

                // Stop recording when video ends
                video.onended = () => {
                    audio.pause();
                    mediaRecorder.stop();
                };

            } catch (error) {
                reject(error);
            }
        });
    };

    const getButtonContent = () => {
        switch (status) {
            case 'preparing':
                return (
                    <>
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Preparing...</span>
                    </>
                );
            case 'merging':
                return (
                    <>
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Merging... {Math.round(progress)}%</span>
                    </>
                );
            case 'downloading':
                return (
                    <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span>Downloading...</span>
                    </>
                );
            case 'success':
                return (
                    <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Exported!</span>
                    </>
                );
            case 'error':
                return (
                    <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>Failed</span>
                    </>
                );
            default:
                return (
                    <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span>Export Video</span>
                    </>
                );
        }
    };

    const getButtonColor = () => {
        switch (status) {
            case 'success':
                return 'bg-green-600 hover:bg-green-700';
            case 'error':
                return 'bg-red-600 hover:bg-red-700';
            default:
                return 'bg-gradient-to-r from-[var(--color-accent-primary)] to-[var(--color-accent-secondary)] hover:from-[var(--color-accent-hover)] hover:to-[var(--color-accent-primary)]';
        }
    };

    return (
        <div className="relative">
            {/* Main Export Button */}
            <button
                onClick={handleExport}
                disabled={!canExport || status === 'preparing' || status === 'merging' || status === 'downloading'}
                className={`
                    relative px-6 py-3 rounded-lg font-semibold text-white
                    flex items-center gap-2 transition-all duration-200
                    disabled:opacity-50 disabled:cursor-not-allowed
                    shadow-lg hover:shadow-xl
                    ${getButtonColor()}
                `}
            >
                {getButtonContent()}

                {/* Progress Bar */}
                {(status === 'preparing' || status === 'merging' || status === 'downloading') && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 rounded-b-lg overflow-hidden">
                        <div
                            className="h-full bg-white transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                )}
            </button>

            {/* Error Message */}
            {status === 'error' && errorMessage && (
                <div className="absolute top-full mt-2 right-0 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-400 whitespace-nowrap shadow-lg max-w-xs">
                    {errorMessage}
                </div>
            )}

            {/* Format Selector (Hidden for now, can be enabled later) */}
            {showFormatMenu && (
                <div className="absolute top-full mt-2 right-0 bg-[var(--color-bg-elevated)] border border-[var(--color-border-primary)] rounded-lg shadow-xl overflow-hidden z-10">
                    <div className="p-2 space-y-1">
                        <button
                            onClick={() => {
                                setFormat('webm');
                                setShowFormatMenu(false);
                            }}
                            className={`
                                w-full px-4 py-2 text-left text-sm rounded transition-colors
                                ${format === 'webm'
                                    ? 'bg-[var(--color-accent-primary)] text-white'
                                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                                }
                            `}
                        >
                            WebM (Original)
                        </button>
                        <button
                            onClick={() => {
                                setFormat('mp4');
                                setShowFormatMenu(false);
                            }}
                            className={`
                                w-full px-4 py-2 text-left text-sm rounded transition-colors
                                ${format === 'mp4'
                                    ? 'bg-[var(--color-accent-primary)] text-white'
                                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                                }
                            `}
                        >
                            MP4 (Converted)
                        </button>
                    </div>
                </div>
            )}

            {/* Tooltip for disabled state */}
            {!canExport && (
                <div className="absolute bottom-full mb-2 right-0 bg-[var(--color-bg-elevated)] border border-[var(--color-border-primary)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-secondary)] whitespace-nowrap shadow-lg pointer-events-none">
                    Waiting for video and audio data...
                </div>
            )}
        </div>
    );
}
