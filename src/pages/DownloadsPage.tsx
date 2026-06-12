import { useEffect, useState } from 'react';
import { cancelDownloadJob, clearCompletedDownloads, listDownloads, type DownloadJob } from '../api/localAgentClient';

export function DownloadsPage() {
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [error, setError] = useState('');

  async function load() {
    try { setJobs(await listDownloads()); setError(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Local agent unavailable.'); }
  }
  useEffect(() => { load(); const id = window.setInterval(load, 2500); return () => window.clearInterval(id); }, []);
  async function cancel(id: string) { await cancelDownloadJob(id); await load(); }
  async function clearCompleted() { setJobs(await clearCompletedDownloads()); }
  const active = jobs.filter((job) => ['queued', 'running'].includes(job.status));
  const history = jobs.filter((job) => !['queued', 'running'].includes(job.status));

  return (
    <section className="downloads-page">
      <div className="detail-header"><div><span className="eyebrow">Install Queue</span><h1>Downloads</h1><p className="muted">Installs, updates, repairs, and uninstall jobs from the local agent.</p></div><div className="action-row"><button onClick={load}>Refresh</button><button onClick={clearCompleted}>Clear Completed</button></div></div>
      {error && <p className="error">{error}</p>}
      {jobs.length === 0 && <div className="panel"><h2>No active downloads</h2><p className="muted">Install, update, repair, and verify jobs will appear here.</p></div>}
      {active.length > 0 && <h2>Active Queue</h2>}
      {active.map((job) => <DownloadCard key={job.id} job={job} onCancel={() => cancel(job.id)} />)}
      {history.length > 0 && <h2>History</h2>}
      {history.map((job) => <DownloadCard key={job.id} job={job} />)}
    </section>
  );
}

function DownloadCard(props: { job: DownloadJob; onCancel?: () => void }) {
  const tone = props.job.status === 'succeeded' ? 'success' : props.job.status === 'failed' ? 'error' : props.job.status === 'cancelled' ? 'muted' : 'muted';
  return <div className={`panel download-card ${props.job.status}`}><div className="detail-header"><div><h2>{props.job.appId}</h2><p className="muted">{props.job.action} • {props.job.message}</p></div><strong className={tone}>{props.job.status}</strong></div><progress value={props.job.progress} max={100} /><div className="download-meta"><small>Started {new Date(props.job.createdAt).toLocaleString()}</small><small>Updated {new Date(props.job.updatedAt).toLocaleString()}</small>{props.onCancel && <button className="danger" onClick={props.onCancel}>Cancel</button>}</div></div>;
}
