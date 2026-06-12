import { useEffect, useState } from 'react';
import { listDownloads, type DownloadJob } from '../api/localAgentClient';

export function DownloadsPage() {
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [error, setError] = useState('');

  function load() { listDownloads().then(setJobs).catch((err) => setError(err instanceof Error ? err.message : 'Local agent unavailable.')); }
  useEffect(() => { load(); const id = window.setInterval(load, 2500); return () => window.clearInterval(id); }, []);

  return (
    <section>
      <h1>Downloads</h1>
      {error && <p className="error">{error}</p>}
      {jobs.length === 0 && <div className="panel"><h2>No active downloads</h2><p className="muted">Installs, updates, repairs, and uninstall jobs will appear here.</p></div>}
      {jobs.map((job) => (
        <div className="panel" key={job.id}>
          <div className="detail-header"><h2>{job.appId}</h2><strong>{job.status}</strong></div>
          <p className="muted">{job.action} • {job.message}</p>
          <progress value={job.progress} max={100} />
        </div>
      ))}
    </section>
  );
}
