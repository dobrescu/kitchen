# Kitchen CDK - Automated Microservices Deployment

Event-driven CI/CD infrastructure for Chef and Prepper microservices with automated Lambda deployments triggered by ECR image pushes.

## Architecture

**3-Stack Design:**
- `kitchen-infra`: ECR repositories + SSM exports
- `kitchen`: API Gateway + Lambda functions
- `kitchen-cicd`: CI/CD pipelines + EventBridge automation

**Automated Flow:**
```
GitHub Push (chef/prepper) → ECR Pipeline → Docker Build → ECR Push
                                                              ↓
                                                    EventBridge Rule
                                                              ↓
                                              Kitchen-Deploy Pipeline
                                                              ↓
                                    Tests → resolve-digests → Deploy kitchen
```

## Quick Start

### 1. Setup

Create `.env`:
```bash
AWS_PROFILE=personal
CDK_DEFAULT_ACCOUNT=123456789012
CDK_DEFAULT_REGION=eu-central-1
PREPPER_IMAGE_TAG=latest
CHEF_IMAGE_TAG=latest
```

### 2. Deploy (in order)

```bash
yarn install && yarn build

# 1. ECR repos
yarn cdk:deploy:kitchen:infra

# 2. Build & push initial images to ECR (use your existing scripts)

# 3. Resolve digests
yarn resolve-digests  # Generates image-manifest.json

# 4. API + Lambdas
yarn cdk:deploy:kitchen

# 5. CI/CD pipelines
yarn cdk:deploy:kitchen:cicd
```

## What Gets Deployed

### kitchen-infra
- ECR repos: `chef`, `prepper` (max 10 images, lifecycle policies)
- SSM parameters: repo ARNs, URIs, names

### kitchen
- API Gateway: `https://cook.hautomation.org`
  - `GET /fetch` → Prepper Lambda
  - `GET /loadRecipe` → Chef Lambda
- Lambda functions: Container-based from ECR with immutable digests
- Route53 + ACM: Custom domain with TLS

### kitchen-cicd
- **Chef-ECR Pipeline**: Builds chef Docker images on GitHub push
- **Prepper-ECR Pipeline**: Builds prepper Docker images on GitHub push
- **Kitchen-Deploy Pipeline**: Deploys kitchen stack on ECR push
- **EventBridge Rules**: Auto-trigger deployment when ECR images pushed

## Commands

```bash
# Development
yarn build              # Compile TypeScript
yarn test               # Run tests
yarn lint:fix           # Fix linting

# Image Management
yarn resolve-digests    # Resolve ECR tags → digests (generates manifest)

# Deployment
yarn cdk:deploy:kitchen:infra    # Deploy ECR
yarn cdk:deploy:kitchen          # Deploy API+Lambdas
yarn cdk:deploy:kitchen:cicd     # Deploy CI/CD
yarn cdk:deploy:all              # Deploy everything
```

## Image Manifest

`resolve-digests` generates `image-manifest.json`:
```json
{
  "prepper": { "tag": "latest", "digest": "sha256:..." },
  "chef": { "tag": "latest", "digest": "sha256:..." }
}
```

Lambda functions read from this manifest (fallback to `*_IMAGE_TAG` env vars if missing).

## Automated CI/CD

### ECR Builds
- Push to `chef`/`prepper` GitHub repo → Triggers ECR pipeline
- CodeBuild uses `buildspec.yml` from repo
- Builds Docker image with `IMAGE_TAG` env var
- Pushes to ECR

### Auto-Deployment
- ECR image push (SUCCESS) → EventBridge triggers Kitchen-Deploy
- Pipeline runs `buildspec-deploy.yml`:
  1. Tests (`yarn test`)
  2. Lint + typecheck
  3. Resolve digests (`yarn resolve-digests`)
  4. Build + deploy (`npx cdk deploy kitchen`)

## Configuration

### GitHub Connection
Add to `cdk.context.json`:
```json
{
  "github-connection-arn": "arn:aws:codeconnections:REGION:ACCOUNT:connection/ID"
}
```

### Environment Variables

**.env** (build time):
- `AWS_PROFILE`, `CDK_DEFAULT_ACCOUNT`, `CDK_DEFAULT_REGION`
- `PREPPER_IMAGE_TAG`, `CHEF_IMAGE_TAG`: Tags or digests

**CodeBuild** (auto-injected):
- `IMAGE_TAG`: Docker image tag (default: `latest`)
- `ECR_REPOSITORY_URI`, `AWS_ACCOUNT_ID`, `AWS_DEFAULT_REGION`

## Troubleshooting

**Lambda fails to deploy:**
```bash
yarn resolve-digests && cat image-manifest.json
```

**CI/CD not triggering:**
- Check EventBridge rules enabled
- Verify ECR push succeeded
- Check CloudWatch Events logs

**Missing SSM parameters:**
```bash
yarn cdk:deploy:kitchen:infra
```

## Stack Dependencies

```
kitchen-infra
    ├── kitchen
    └── kitchen-cicd (EventBridge → kitchen-deploy pipeline)
```

Deploy order: `kitchen-infra` → `kitchen` → `kitchen-cicd`
