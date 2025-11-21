import * as fs from 'fs';
import * as path from 'path';

interface ImageManifest {
  [repo: string]: {
    tag: string;
    digest: string;
  };
}

/**
 * Load image reference (digest or tag) from image-manifest.json for container-based Lambda functions.
 *
 * Resolution order:
 * 1. Digest from image-manifest.json (preferred for immutable deployments)
 * 2. Environment variable {REPO_NAME}_IMAGE_TAG (e.g., CHEF_IMAGE_TAG, PREPPER_IMAGE_TAG)
 * 3. Default to 'latest' tag
 *
 * @param repoName - Repository name (e.g., 'chef', 'prepper')
 * @returns Image digest (sha256:...) or tag to use for Docker image
 *
 * @example
 * ```typescript
 * // With manifest file containing { "chef": { "digest": "sha256:abc..." } }
 * loadImageReference('chef') // Returns 'sha256:abc...'
 *
 * // Without manifest but with env var CHEF_IMAGE_TAG=v1.0.0
 * loadImageReference('chef') // Returns 'v1.0.0'
 *
 * // Without manifest or env var
 * loadImageReference('chef') // Returns 'latest'
 * ```
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
