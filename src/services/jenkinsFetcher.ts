import fs from 'fs';
import path from 'path';

function authHeader(): string {
  return 'Basic ' + Buffer.from(`${process.env.JENKINS_USER}:${process.env.JENKINS_TOKEN}`).toString('base64');
}

function jobUrl(jobName: string, ...segments: string[]): string {
  const base = process.env.JENKINS_URL!.replace(/\/$/, '');
  const jobPath = jobName.split('/').map(encodeURIComponent).join('/job/');
  return [base, 'job', jobPath, ...segments].join('/');
}

async function get(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Authorization: authHeader() } });
  if (!res.ok) throw new Error(`Jenkins ${res.status}: ${url}`);
  return res.json();
}

export async function fetchAndStore(jobName: string, buildNumber: number | string): Promise<string> {
  if (!process.env.JENKINS_URL || !process.env.JENKINS_USER || !process.env.JENKINS_TOKEN) {
    throw new Error('JENKINS_URL, JENKINS_USER, and JENKINS_TOKEN must be set');
  }

  const build = await get(jobUrl(jobName, String(buildNumber), 'api/json'));

  let testReport: unknown = null;
  try {
    testReport = await get(jobUrl(jobName, String(buildNumber), 'testReport', 'api/json'));
  } catch {
    // build has no test report — that is fine
  }

  const dir = path.join('reports', jobName.replace(/\//g, path.sep), String(buildNumber));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'build.json'), JSON.stringify(build, null, 2), 'utf-8');
  if (testReport !== null) {
    fs.writeFileSync(path.join(dir, 'test-report.json'), JSON.stringify(testReport, null, 2), 'utf-8');
  }

  return dir;
}
