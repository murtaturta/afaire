"use client";

import React, { useState } from 'react';
import { useAllTasks } from '@/hooks/useData';
import { generateIcsCalendar, downloadIcsFile } from '@/lib/calendar/ics';
import { downloadBackupJson, importBackupData } from '@/lib/db/backup';
import {
  Calendar,
  Download,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Clock,
  Sparkles,
  Key,
  Database,
  Upload,
  FileJson
} from 'lucide-react';

const DEFAULT_GIST_ID = '4a5ce16179357ead77fe22325d59b20e';
const DEFAULT_FEED_URL = `https://gist.githubusercontent.com/murtaturta/${DEFAULT_GIST_ID}/raw`;

export default function SettingsPage() {
  const tasks = useAllTasks() || [];

  const [feedUrl, setFeedUrl] = useState(DEFAULT_FEED_URL);
  const [gistId, setGistId] = useState(DEFAULT_GIST_ID);
  const [githubToken, setGithubToken] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('afaire_github_pat') || '';
    }
    return '';
  });

  const [copied, setCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const [includeCompleted, setIncludeCompleted] = useState(true);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleDownloadIcs = () => {
    downloadIcsFile(tasks, 'afaire-tasks.ics');
  };

  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleExportJson = async () => {
    try {
      await downloadBackupJson();
      setBackupStatus('✓ Backup downloaded successfully!');
      setTimeout(() => setBackupStatus(null), 3000);
    } catch (err: any) {
      setBackupStatus(`Export failed: ${err.message}`);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = await importBackupData(text);
      setBackupStatus(`✓ Restored ${result.tasksCount} tasks and ${result.sessionsCount} sessions!`);
      setTimeout(() => setBackupStatus(null), 4000);
    } catch (err: any) {
      setBackupStatus(`Import failed: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveToken = (val: string) => {
    setGithubToken(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('afaire_github_pat', val);
    }
  };

  const handlePublishToGist = async () => {
    if (!githubToken.trim()) {
      setSyncStatus('Please enter a GitHub Personal Access Token (PAT) with "gist" permission below.');
      return;
    }

    setIsSyncing(true);
    setSyncStatus(null);

    try {
      const icsContent = generateIcsCalendar(tasks, { includeCompleted });
      const targetGistId = gistId.trim() || DEFAULT_GIST_ID;

      const res = await fetch(`https://api.github.com/gists/${targetGistId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${githubToken.trim()}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: `afaire Tasks — updated ${new Date().toLocaleDateString()}`,
          files: {
            'afaire-tasks.ics': {
              content: icsContent,
            },
          },
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${res.status}`);
      }

      setSyncStatus('✓ Successfully published latest tasks to your Google Calendar feed!');
    } catch (err: any) {
      setSyncStatus(`Sync failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage calendar feeds, data exports, and preferences
        </p>
      </header>

      {/* Google Calendar Integration Card */}
      <div className="p-6 rounded-2xl border border-border bg-card text-card-foreground shadow-xs space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Google Calendar Feed (Method 1)</h2>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                100% Private · Zero Account Access
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Subscribe to your tasks in Google Calendar via your private, unlisted feed URL. Google Calendar reads your tasks into a dedicated calendar without accessing your Google account.
            </p>
          </div>
        </div>

        {/* Feed URL Box */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Your Private Subscription URL
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={feedUrl}
              className="flex-1 font-mono text-xs px-3 py-2.5 rounded-lg border border-border bg-muted/50 text-foreground select-all outline-none"
            />
            <button
              type="button"
              onClick={handleCopyUrl}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90 transition-all cursor-pointer shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy URL</span>
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            This is an unlisted secret feed hosted in your GitHub account. Only someone with this exact URL can read it.
          </p>
        </div>

        {/* How to Add to Google Calendar Accordion */}
        <div className="p-4 rounded-xl border border-border/80 bg-muted/30 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
            How to add to Google Calendar (Takes 30 seconds):
          </h3>
          <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside leading-relaxed">
            <li>
              Open <a href="https://calendar.google.com" target="_blank" rel="noreferrer" className="text-primary underline inline-flex items-center gap-0.5">Google Calendar <ExternalLink className="w-3 h-3" /></a> on your computer.
            </li>
            <li>In the left sidebar, look for <strong>Other calendars</strong> and click the <strong>+</strong> button.</li>
            <li>Click <strong>From URL</strong>.</li>
            <li>Paste your copied URL above and click <strong>Add calendar</strong>.</li>
            <li>Google Calendar will create a dedicated <em>afaire</em> calendar that you can toggle on or off anytime!</li>
          </ol>
        </div>

        {/* Publish & Sync Controls */}
        <div className="pt-4 border-t border-border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium text-foreground">Update & Publish Tasks to Feed</h3>
              <p className="text-xs text-muted-foreground">
                Currently contains {tasks.length} task{tasks.length === 1 ? '' : 's'}. Click to update your online feed with latest scheduled dates and subtasks.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePublishToGist}
                disabled={isSyncing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary font-medium text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Publishing...' : 'Publish to Feed'}</span>
              </button>
            </div>
          </div>

          {syncStatus && (
            <div className={`p-3 rounded-lg text-xs font-medium ${
              syncStatus.startsWith('✓')
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-destructive/10 text-destructive border border-destructive/20'
            }`}>
              {syncStatus}
            </div>
          )}

          {/* GitHub PAT input for in-browser 1-click publishing */}
          <div className="p-3.5 rounded-lg border border-border bg-card/60 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-muted-foreground" />
                <span>GitHub Personal Access Token (for 1-click publishing from browser)</span>
              </label>
              <a
                href="https://github.com/settings/tokens/new?scopes=gist&description=afaire+Calendar+Sync"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-primary hover:underline flex items-center gap-1"
              >
                <span>Create a token with gist scope</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="password"
              value={githubToken}
              onChange={(e) => handleSaveToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx (saved only in your browser's local storage)"
              className="w-full text-xs font-mono px-3 py-2 rounded-md border border-border bg-muted/40 text-foreground outline-none focus:border-primary"
            />
            <p className="text-[11px] text-muted-foreground">
              Required only if you want to click "Publish to Feed" directly from the browser. Alternatively, you can use the direct download below.
            </p>
          </div>
        </div>

        {/* Offline .ics Download */}
        <div className="pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-medium text-foreground">Direct Calendar Download (.ics)</h3>
            <p className="text-xs text-muted-foreground">
              Don't want to use GitHub? Download an <code>.ics</code> file right now and import it into Google Calendar, Apple Calendar, or Outlook.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadIcs}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 font-medium text-xs transition-colors cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .ics File</span>
          </button>
        </div>
      </div>

      {/* Backup & Cross-Device Transfer Card */}
      <div className="p-6 rounded-2xl border border-border bg-card text-card-foreground shadow-xs space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Data Backup & Device Transfer (JSON)</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Move your tasks, checklists, and history between different computers or save an offline backup.
          </p>
        </div>

        {backupStatus && (
          <div className={`p-3 rounded-lg text-xs font-medium ${
            backupStatus.startsWith('✓')
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              : 'bg-destructive/10 text-destructive border border-destructive/20'
          }`}>
            {backupStatus}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Export Button */}
          <div className="p-4 rounded-xl border border-border/80 bg-muted/20 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <FileJson className="w-4 h-4 text-primary" />
                <span>Export Backup</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Save all tasks, subtasks, and completion logs to a <code>.json</code> file.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportJson}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export All Data (JSON)</span>
            </button>
          </div>

          {/* Import Button */}
          <div className="p-4 rounded-xl border border-border/80 bg-muted/20 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Upload className="w-4 h-4 text-primary" />
                <span>Import Backup</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Restore a backup file from another PC. Tasks and sessions will be safely imported into your browser.
              </p>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImportFile}
                className="hidden"
                id="import-backup-input"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 font-medium text-xs transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Select & Restore File</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
