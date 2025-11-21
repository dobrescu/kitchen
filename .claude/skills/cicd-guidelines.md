---
name: cicd-guidelines
description: CI/CD automation patterns for Kitchen - CodePipeline, EventBridge triggers, CodeBuild, image digest resolution. Use when working with pipelines, build specs, or deployment automation.
---

# CI/CD Guidelines

## When this skill should be used

Auto-activates when Claude is:

- Creating or modifying CodePipeline pipelines
- Working with EventBridge rules and triggers
- Writing or updating CodeBuild specs
- Configuring automated deployments
- Working with image digest resolution

Behavioral rules:

- 3 pipelines: Chef-ECR, Prepper-ECR, Kitchen-Deploy
- EventBridge triggers Kitchen-Deploy on ECR push
- Resolve image digests before CDK deployment
- CodeConnections for GitHub (not webhooks)
- Immutable image references for Lambda

---

## Pipeline architecture

```
Chef-ECR Pipeline:    GitHub (dobrescu/chef) → CodeBuild → ECR
Prepper-ECR Pipeline: GitHub (dobrescu/prepper) → CodeBuild → ECR
                           ↓ (EventBridge trigger on ECR push)
Kitchen-Deploy:       GitHub (dobrescu/kitchen) → Test → Resolve Digests → CDK Deploy
```

**Event-driven:** ECR push → EventBridge → Kitchen-Deploy → Lambda update.

---

## ECR build pipeline

**File:** `src/cicd/pipeline/kitchen-ecr-pipeline.ts`

```typescript
this.pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
  pipelineName: `${props.serviceName}-ECR`,
  pipelineType: codepipeline.PipelineType.V2,
  restartExecutionOnUpdate: true
});

// Source: GitHub via CodeConnections
this.pipeline.addStage({
  stageName: 'Source',
  actions: [
    new codepipeline_actions.CodeStarConnectionsSourceAction({
      actionName: 'GitHub',
      owner: 'dobrescu',
      repo: props.githubRepo,
      branch: 'main',
      connectionArn: props.githubConnectionArn,
      output: sourceArtifact
    })
  ]
});

// Build: Docker → ECR
this.pipeline.addStage({
  stageName: 'Build',
  actions: [
    new codepipeline_actions.CodeBuildAction({
      actionName: 'DockerBuild',
      project: buildProject.project,
      input: sourceArtifact
    })
  ]
});
```

---

## CodeBuild for Docker

**File:** `src/cicd/codebuild/kitchen-build-ecr.ts`

```typescript
this.project = new codebuild.Project(this, 'Project', {
  projectName: `Kitchen-${props.serviceName}-Build`,
  environment: {
    buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
    computeType: codebuild.ComputeType.SMALL,
    privileged: true  // Required for Docker
  },
  environmentVariables: {
    ECR_REPOSITORY_URI: { value: props.ecrRepositoryUri },
    IMAGE_TAG: { value: 'latest' }
  },
  buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yml')
});

// Grant ECR push permissions
this.project.addToRolePolicy(new iam.PolicyStatement({
  actions: ['ecr:GetAuthorizationToken', 'ecr:PutImage'],
  resources: ['*']
}));
```

---

## EventBridge triggers

**File:** `src/cicd/cicd-stack.ts`

```typescript
const chefRule = new events.Rule(this, 'ChefEcrPushRule', {
  ruleName: 'Kitchen-Chef-ECR-Push-Trigger',
  eventPattern: {
    source: ['aws.ecr'],
    detailType: ['ECR Image Action'],
    detail: {
      'action-type': ['PUSH'],
      'result': ['SUCCESS'],
      'repository-name': ['chef']
    }
  }
});

chefRule.addTarget(new events_targets.CodePipeline(kitchenDeployPipeline.pipeline));
```

**Pattern:** ECR push event → trigger Kitchen-Deploy pipeline.

---

## Image digest resolution

**Script:** `scripts/resolve-image-digests.sh`

Queries ECR for SHA256 digests and generates `image-manifest.json`:

```json
{
  "chef": {
    "tag": "latest",
    "digest": "sha256:abc123..."
  },
  "prepper": {
    "tag": "latest",
    "digest": "sha256:def456..."
  }
}
```

**Run before deployment:** `yarn resolve-digests`

**Why:** Lambda deployed with digest (not tag) for immutable deployments.

---

## Deployment pipeline

**File:** `src/cicd/pipeline/kitchen-deploy-pipeline.ts`

**Buildspec:** `buildspec.deploy.yml`

```yaml
version: 0.2
phases:
  install:
    commands:
      - yarn install --immutable
  pre_build:
    commands:
      - yarn test --watchAll=false
      - yarn lint
      - yarn typecheck
  build:
    commands:
      - yarn resolve-digests
      - yarn build
  post_build:
    commands:
      - npx cdk deploy kitchen --require-approval never
```

**Workflow:** Test → Lint → Resolve Digests → Build → Deploy.

---

## Deployment workflow

**Initial setup:**
```bash
yarn cdk:deploy:kitchen:infra    # ECR repos
# Build and push images (triggers ECR pipelines)
yarn resolve-digests
yarn cdk:deploy:kitchen          # Lambda + API
yarn cdk:deploy:kitchen:cicd     # Pipelines
```

**Automated (after setup):**
```
Git push to chef/prepper → ECR pipeline → Image push → EventBridge → Kitchen-Deploy → Lambda update
```

---

Related skills: `cdk-development-guidelines`, `infrastructure-guidelines`, `testing-guidelines`

Last updated: 2025-11-21
