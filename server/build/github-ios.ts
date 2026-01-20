/**
 * GitHub Actions iOS Build Trigger
 * Triggers iOS builds on GitHub Actions macOS runners
 */

export interface GitHubIOSBuildConfig {
  appId: string;
  appName: string;
  bundleId: string;
  websiteUrl: string;
  versionCode?: number;
}

interface GitHubConfig {
  owner: string;      // GitHub username or org
  repo: string;       // Repository name
  token: string;      // GitHub Personal Access Token with workflow permissions
  callbackUrl: string; // URL to receive build completion webhook
}

function getGitHubConfig(): GitHubConfig | null {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  const callbackUrl = process.env.IOS_BUILD_CALLBACK_URL;

  if (!owner || !repo || !token || !callbackUrl) {
    return null;
  }

  return { owner, repo, token, callbackUrl };
}

/**
 * Triggers an iOS build on GitHub Actions
 * Returns the workflow run ID if successful
 */
export async function triggerIOSBuild(config: GitHubIOSBuildConfig): Promise<{
  success: boolean;
  runId?: string;
  error?: string;
}> {
  const gh = getGitHubConfig();
  
  if (!gh) {
    return {
      success: false,
      error: 'GitHub Actions not configured. Set GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN, and IOS_BUILD_CALLBACK_URL environment variables.'
    };
  }

  const url = `https://api.github.com/repos/${gh.owner}/${gh.repo}/actions/workflows/ios-build.yml/dispatches`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${gh.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'main', // or your default branch
        inputs: {
          app_id: config.appId,
          app_name: config.appName,
          bundle_id: config.bundleId,
          website_url: config.websiteUrl,
          version_code: String(config.versionCode || 1),
          callback_url: gh.callbackUrl,
        },
      }),
    });

    if (response.status === 204) {
      // Workflow dispatch returns 204 No Content on success
      // We need to fetch the run ID separately
      const runId = await getLatestWorkflowRunId(gh, config.appId);
      return { success: true, runId };
    }

    const errorBody = await response.text();
    return {
      success: false,
      error: `GitHub API error: ${response.status} - ${errorBody}`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Failed to trigger build: ${err?.message || String(err)}`,
    };
  }
}

/**
 * Gets the latest workflow run ID (called right after triggering)
 */
async function getLatestWorkflowRunId(gh: GitHubConfig, appId: string): Promise<string | undefined> {
  // Small delay to let the run start
  await new Promise(r => setTimeout(r, 2000));

  try {
    const url = `https://api.github.com/repos/${gh.owner}/${gh.repo}/actions/workflows/ios-build.yml/runs?per_page=1`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${gh.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.workflow_runs && data.workflow_runs.length > 0) {
        return String(data.workflow_runs[0].id);
      }
    }
  } catch {
    // Best effort
  }

  return undefined;
}

/**
 * Checks the status of a workflow run
 */
export async function checkIOSBuildStatus(runId: string): Promise<{
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'cancelled' | string;
  artifactsUrl?: string;
}> {
  const gh = getGitHubConfig();
  if (!gh) {
    return { status: 'completed', conclusion: 'failure' };
  }

  try {
    const url = `https://api.github.com/repos/${gh.owner}/${gh.repo}/actions/runs/${runId}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${gh.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return {
        status: data.status,
        conclusion: data.conclusion,
        artifactsUrl: data.artifacts_url,
      };
    }
  } catch {
    // Best effort
  }

  return { status: 'completed', conclusion: 'failure' };
}

/**
 * Downloads build artifacts from a completed workflow run
 */
export async function downloadIOSArtifact(runId: string, destPath: string): Promise<boolean> {
  const gh = getGitHubConfig();
  if (!gh) return false;

  try {
    // Get artifacts list
    const listUrl = `https://api.github.com/repos/${gh.owner}/${gh.repo}/actions/runs/${runId}/artifacts`;
    
    const listResponse = await fetch(listUrl, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${gh.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!listResponse.ok) return false;

    const artifacts = await listResponse.json();
    if (!artifacts.artifacts || artifacts.artifacts.length === 0) return false;

    // Download the first artifact
    const artifact = artifacts.artifacts[0];
    const downloadUrl = artifact.archive_download_url;

    const downloadResponse = await fetch(downloadUrl, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${gh.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!downloadResponse.ok) return false;

    // Write to file
    const fs = await import('fs/promises');
    const buffer = await downloadResponse.arrayBuffer();
    await fs.writeFile(destPath, Buffer.from(buffer));

    return true;
  } catch {
    return false;
  }
}
