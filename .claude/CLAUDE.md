# Claude Code Configuration - Kitchen

## Quick Overview

**Kitchen** is an AWS CDK infrastructure-as-code project that automates deployment of containerized microservices (Chef and Prepper) using event-driven CI/CD. It orchestrates Docker builds, ECR pushes, and Lambda deployments with zero manual intervention after initial setup.

**Tech Stack:**
- AWS CDK v2.220.0 (Infrastructure as Code)
- TypeScript 5.6+ with ESM (strict mode)
- AWS Services: Lambda, ECR, API Gateway v2, CodePipeline, EventBridge
- Yarn 4.8.1+ package manager
- Jest 29.7.0 for testing

**Architecture:**
- 3-stack design: `kitchen-infra` (ECR) → `kitchen` (API+Lambda) → `kitchen-cicd` (pipelines)
- Event-driven: ECR push → EventBridge → auto-deploy Lambda
- Container-based Lambda functions with immutable image references

---

## Critical Rules

### 1. Type Safety
- ALWAYS use strict TypeScript mode
- ESM imports with `.js` extension for local files
- Named exports only (no defaults)
- Readonly props interfaces

### 2. Stack Architecture
- Use 3-stack separation: infra → service → cicd
- SSM Parameter Store for inter-stack communication (not cross-stack refs)
- Deploy stacks independently

### 3. Immutable Deployments
- Use SHA256 digests for Lambda images (not tags)
- Run `yarn resolve-digests` before deploying service stack
- Never deploy with `latest` tag in production

### 4. Testing
- Test all infrastructure changes with `yarn test`
- Use CDK assertions library for resource validation
- Verify stack synthesis before deployment

### 5. Code Organization
- Constructs extend `Construct`, stacks extend `cdk.Stack`
- Shared utilities in `src/shared/`
- Follow existing naming conventions (see `cdk-development-guidelines` skill)

---

## Quick Commands

```bash
# Development
yarn dev                           # Run CDK app with tsx
yarn typecheck                     # TypeScript type checking
yarn lint                          # ESLint check
yarn lint:fix                      # Auto-fix linting issues
yarn test                          # Run Jest tests
yarn build                         # Compile TypeScript

# Deployment
yarn resolve-digests               # Resolve ECR image digests
yarn cdk:deploy:all                # Deploy all 3 stacks
yarn cdk:deploy:kitchen:infra      # Deploy infra stack only
yarn cdk:deploy:kitchen            # Deploy service stack only
yarn cdk:deploy:kitchen:cicd       # Deploy CICD stack only

# CDK
yarn synth                         # Synthesize CloudFormation
cdk diff                           # Show deployment changes
cdk list                           # List stacks
```

---

## Project Structure

```
src/
├── bin/
│   └── kitchen.ts                # CDK app entry point (creates 3 stacks)
├── infra/                        # Infrastructure stack (ECR)
│   ├── kitchen-infra-stack.ts
│   ├── ecr-repositories.ts       # Chef and Prepper ECR repos
│   ├── kitchen-exports.ts        # Export to SSM Parameter Store
│   └── kitchen-imports.ts        # Import from SSM Parameter Store
├── service/                      # Service stack (API + Lambda)
│   ├── kitchen-service-stack.ts
│   ├── kitchen-api.ts            # HTTP API v2 + custom domain
│   └── lambdas/
│       ├── chef-lambda.ts        # Chef Lambda (512MB)
│       └── prepper-lambda.ts     # Prepper Lambda (4096MB)
├── cicd/                         # CICD stack (pipelines)
│   ├── cicd-stack.ts
│   ├── pipeline/
│   │   ├── kitchen-ecr-pipeline.ts      # ECR build pipelines
│   │   └── kitchen-deploy-pipeline.ts   # CDK deployment pipeline
│   └── codebuild/
│       └── kitchen-build-ecr.ts         # Docker build projects
└── shared/                       # Shared utilities
    ├── image-reference-loader.ts        # Load digest from manifest
    └── lambda-role.ts                   # IAM role factory

test/
├── stacks.test.ts                # Comprehensive stack tests
└── infra-stack.test.ts           # Additional infra tests

scripts/
└── resolve-image-digests.sh      # Query ECR for SHA256 digests
```

---

## Key Concepts

### 3-Stack Design

```
KitchenInfraStack
  └─ Creates ECR repos (chef, prepper)
  └─ Exports to SSM: /kitchen/ecr/{repo}/{arn,uri,name}

KitchenServiceStack (depends on infra)
  └─ Imports from SSM
  └─ Creates Chef Lambda (512MB, 30s timeout)
  └─ Creates Prepper Lambda (4096MB, 30s timeout)
  └─ Creates HTTP API v2 with custom domain
  └─ Routes: GET /fetch, GET /loadRecipe

CicdStack (depends on infra)
  └─ Creates 3 CodePipelines:
     ├─ Chef-ECR: GitHub → Docker → ECR
     ├─ Prepper-ECR: GitHub → Docker → ECR
     └─ Kitchen-Deploy: GitHub → Test → CDK Deploy
  └─ EventBridge rules trigger Kitchen-Deploy on ECR push
```

**Why 3 stacks:**
- Deploy ECR once, update services frequently
- Independent deployment and rollback
- Clear separation of concerns

### SSM Parameter Store Pattern

**Export (infra stack):**
```typescript
new ssm.StringParameter(this, 'ChefRepoArn', {
  parameterName: '/kitchen/ecr/chef/arn',
  stringValue: repo.repositoryArn
});
```

**Import (service/cicd stacks):**
```typescript
const arn = ssm.StringParameter.valueForStringParameter(this, '/kitchen/ecr/chef/arn');
```

**Benefits:** Stacks can deploy independently, no CloudFormation cross-stack limits.

### Immutable Image Deployments

1. **Resolve Digests:** `scripts/resolve-image-digests.sh` queries ECR and generates `image-manifest.json`
2. **Load Digest:** `loadImageReference('chef')` reads manifest and returns SHA256 digest
3. **Deploy Lambda:** Lambda deployed with digest (e.g., `sha256:abc123...`) instead of `latest` tag

**Why:** Prevents unexpected Lambda updates when new images are pushed to ECR.

### Event-Driven Automation

```
Chef/Prepper code push → GitHub
  ↓
Chef-ECR/Prepper-ECR pipeline builds Docker image
  ↓
Image pushed to ECR
  ↓
EventBridge detects ECR PUSH event
  ↓
Kitchen-Deploy pipeline triggered
  ↓
Resolves digests → Tests → Deploys updated Lambda
```

---

## Development Workflow

### Initial Deployment

```bash
# 1. Deploy infrastructure (creates ECR repos)
yarn cdk:deploy:kitchen:infra

# 2. Build and push initial images (from chef/prepper repos)
# This triggers Chef-ECR and Prepper-ECR pipelines

# 3. Resolve image digests
yarn resolve-digests

# 4. Deploy service stack (API + Lambda)
yarn cdk:deploy:kitchen

# 5. Deploy CICD stack (pipelines + EventBridge)
yarn cdk:deploy:kitchen:cicd
```

### Automated Workflow (After Setup)

```
1. Push code to chef/prepper repo
2. Pipeline builds and pushes Docker image
3. EventBridge triggers Kitchen-Deploy
4. Lambda auto-updates with new image
```

### Making Infrastructure Changes

```bash
# 1. Edit CDK code
# 2. Run tests
yarn test

# 3. Check changes
cdk diff

# 4. Deploy
yarn cdk:deploy:kitchen

# 5. Verify in AWS Console
```

### Pre-Commit Checklist

```bash
yarn lint:fix      # Fix code style
yarn typecheck     # TypeScript validation
yarn test          # Run all tests
yarn build         # Compile to dist/
```

---

## Common Patterns

### Creating a New Construct

```typescript
import { Construct } from 'constructs';

export interface MyConstructProps {
  readonly prop: string;
}

export class MyConstruct extends Construct {
  public readonly resource: Type;

  constructor(scope: Construct, id: string, props: MyConstructProps) {
    super(scope, id);
    // Implementation
  }
}
```

See `cdk-development-guidelines` skill for detailed patterns.

### Adding a Lambda Function

See `infrastructure-guidelines` skill for Lambda patterns.

### Creating a Pipeline

See `cicd-guidelines` skill for CodePipeline patterns.

### Writing Tests

See `testing-guidelines` skill for Jest + CDK assertions patterns.

---

## Troubleshooting

### TypeScript Build Errors
```bash
yarn typecheck  # Check for type errors
yarn build      # Compile and catch errors
```

### CDK Deployment Issues
```bash
cdk diff        # Preview changes
yarn synth      # Generate CloudFormation
cdk list        # Verify stack names
```

### Image Digest Problems
```bash
yarn resolve-digests && cat image-manifest.json   # Debug manifest
```

### Test Failures
```bash
yarn test --verbose     # Detailed output
yarn test stacks.test.ts  # Run specific file
```

---

## Environment Variables

Required in `.env`:
```
CDK_DEFAULT_ACCOUNT=123456789012
CDK_DEFAULT_REGION=eu-central-1
CHEF_IMAGE_TAG=latest
PREPPER_IMAGE_TAG=latest
AWS_PROFILE=personal
```

Required in `cdk.context.json`:
```json
{
  "github-connection-arn": "arn:aws:codeconnections:...",
  "domainName": "cook.hautomation.org",
  "hostedZoneName": "hautomation.org",
  "openAiApiKey": "/kitchen/chef/api/open-ai",
  "s3CookbooksBucket": "bucket-name",
  "dynamoCookbooksTable": "table-name"
}
```

---

## Skills System

Skills are automatically activated based on work context:

- **cdk-development-guidelines** - Stack/construct patterns, ESM imports, SSM communication
- **infrastructure-guidelines** - Lambda, API Gateway, ECR, IAM patterns
- **cicd-guidelines** - CodePipeline, EventBridge, digest resolution
- **testing-guidelines** - Jest + CDK assertions patterns

Skills auto-activate via hooks - no need to invoke manually.

---

## Notes

- **Container-based Lambdas:** Both Chef and Prepper use Docker images from ECR (not zip files)
- **HTTP API v2:** 70% cheaper than REST API, sufficient for GET endpoints
- **CodeConnections:** GitHub integration without managing webhooks
- **Custom Domain:** TLS certificate via ACM with DNS validation
- **Lifecycle Policies:** Keep max 10 images, delete untagged after 1 day

---

Last updated: 2025-11-21
