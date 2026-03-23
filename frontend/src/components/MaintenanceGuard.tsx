import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import packageJson from '../../package.json';


interface SystemStatus {
    maintenance: boolean;
    min_version: string;
}

const APP_VERSION = packageJson.version;

export default function MaintenanceGuard({ children }: { children: React.ReactNode }) {
    const [status, setStatus] = useState<SystemStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [updateProgress, setUpdateProgress] = useState<number | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await api.get('/api/status');
                setStatus(res.data);
            } catch (err) {
                // Silently fail to let the app continue if the backend is down
            } finally {
                setLoading(false);
            }
        };

        checkStatus();
        const interval = setInterval(checkStatus, 60000); // Check every minute
        return () => clearInterval(interval);
    }, []);

    const startUpdate = async () => {
        try {
            setIsUpdating(true);
            setUpdateProgress(0);
            const { check } = await import('@tauri-apps/plugin-updater');
            const { relaunch } = await import('@tauri-apps/plugin-process');
            
            console.log("Checking for updates...");
            const update = await check();
            console.log("Update check result:", update);

            if (update) {
                console.log("Update available, downloading...");
                let downloaded = 0;
                let contentLength = 0;
                
                await update.downloadAndInstall((event) => {
                    if (event.event === 'Started') {
                        contentLength = event.data?.contentLength || 0;
                        console.log("Download started, size:", contentLength);
                    } else if (event.event === 'Progress') {
                        downloaded += event.data?.chunkLength || 0;
                        if (contentLength > 0) {
                            setUpdateProgress(Math.round((downloaded / contentLength) * 100));
                        }
                    } else if (event.event === 'Finished') {
                        setUpdateProgress(100);
                        console.log("Download finished, installing...");
                    }
                });
                
                console.log("Installation complete, relaunching in 2 seconds...");
                await new Promise(resolve => setTimeout(resolve, 2000));
                await relaunch();
            } else {
                console.log("No update available, restarting app...");
                const { relaunch: relaunchFn } = await import('@tauri-apps/plugin-process');
                await new Promise(resolve => setTimeout(resolve, 1000));
                await relaunchFn();
            }
        } catch (e) {
            console.error("Update failed:", e);
            setTimeout(() => window.location.reload(), 1500);
        } finally {
            setIsUpdating(false);
        }
    };

    if (loading) return (
        <div className="fixed inset-0 bg-gray-50 flex items-center justify-center z-[99999]">
            <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        </div>
    );

    if (!status) return <>{children}</>;

    const isVersionTooOld = (current: string, min: string) => {
        const c = current.split('.').map(Number);
        const m = min.split('.').map(Number);
        for (let i = 0; i < 3; i++) {
            if (c[i] < m[i]) return true;
            if (c[i] > m[i]) return false;
        }
        return false;
    };

    const needsUpdate = isVersionTooOld(APP_VERSION, status.min_version);

    if (status.maintenance || needsUpdate) {
        return (
            <div className="fixed inset-0 z-[99999] min-h-screen flex items-center justify-center bg-gray-50 px-4 font-sans select-none">
                <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-xl">
                    <div className="mx-auto mb-6 flex justify-center">
                        <img src="/logo.png" alt="SMSystem Logo" className="w-20 h-20 object-contain drop-shadow-sm" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        {status.maintenance ? "System Maintenance" : "Update Required"}
                    </h1>
                    <p className="text-gray-500 mb-8 leading-relaxed text-sm">
                        {status.maintenance
                            ? "We are currently optimizing the SMSystem database. Access is temporarily suspended to ensure data integrity."
                            : `A mandatory update (v${status.min_version}) is required to continue using the system and prevent data conflicts.`}
                    </p>

                    <div className="space-y-3">
                        {status.maintenance ? (
                            <div className="p-4 bg-gray-50 rounded-xl text-sm text-gray-600 border border-gray-100 italic">
                                "Please check back shortly or contact the administrator."
                            </div>
                        ) : (
                            <button
                                onClick={startUpdate}
                                disabled={isUpdating}
                                className={`w-full py-3 px-4 rounded-xl text-sm font-bold transition-colors shadow-lg uppercase tracking-widest ${isUpdating
                                    ? 'bg-gray-100 text-gray-400 cursor-wait shadow-none'
                                    : 'bg-gray-900 text-white hover:bg-gray-800 shadow-gray-200'
                                    }`}
                            >
                                {isUpdating
                                    ? (updateProgress !== null ? `DOWNLOADING ${updateProgress}%` : 'PREPARING UPDATE...')
                                    : 'DOWNLOAD UPDATE'}
                            </button>
                        )}
                    </div>

                    <div className="mt-8 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                        SMSystem Control v{APP_VERSION}
                    </div>

                    {/* Developer Bypass (Only visible during npm run tauri dev) */}
                    {import.meta.env.DEV && (
                        <button
                            onClick={() => {
                                setStatus(null); // Bypass the guard
                            }}
                            className="mt-6 w-full py-2 px-4 bg-red-100/50 text-red-600 border border-red-200 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors uppercase tracking-widest"
                        >
                            Dev Preview
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
