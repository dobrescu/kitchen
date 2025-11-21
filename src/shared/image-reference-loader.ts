import * as fs from 'fs';
import * as path from 'path';

interface ImageManifest {
  [repo: string]: {
    tag: string;
    digest: string;
  };
}

/**
 * Load image reference (digest or tag) from image-manifest.json
 * Falls back to environment variable or 'latest' if not found
 *
 * @param repoName - Repository name (e.g., 'chef', 'prepper')
 * @returns Image digest or tag to use for Docker image
 */
export function loadImageReference(repoName: string): string {
  const manifestPath = path.join(process.cwd(), 'image-manifest.json');

  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as ImageManifest;
      const digest = manifest[repoName]?.digest;

      if (digest) {
        return digest;
      }
    } catch (err) {
      console.warn(`Warning: Failed to parse image-manifest.json: ${err}`);
    }
  }

  // Fallback to environment variable or 'latest'
  const envVarName = `${repoName.toUpperCase()}_IMAGE_TAG`;
  return process.env[envVarName] || 'latest';
}
