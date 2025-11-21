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

## 1. Pipeline architecture

Kitchen uses 3 CodePipelines:

```
Chef-ECR Pipeline
  GitHub (dobrescu/chef) → CodeBuild → ECR push
    ↓ (EventBridge trigger)

Prepper-ECR Pipeline
  GitHub (dobrescu/prepper) → CodeBuild → ECR push
    ↓ (EventBridge trigger)

Kitchen-Deploy Pipeline
  GitHub (dobrescu/kitchen) → Test → Resolve Digests → CDK Deploy
```

**Event-driven automation:**
- Chef or Prepper image pushed to ECR
- EventBridge detects push event
- Triggers Kitchen-Deploy pipeline
- Updates Lambda functions with new images

---

## 2. ECR build pipeline

**File:** `src/cicd/pipeline/kitchen-ecr-pipeline.ts`

```typescript
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';

export class KitchenEcrPipeline extends Construct {
	public readonly pipeline: codepipeline.Pipeline;

	constructor(scope: Construct, id: string, props: KitchenEcrPipelineProps) {
		super(scope, id);

		const sourceArtifact = new codepipeline.Artifact('SourceArtifact');

		this.pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
			pipelineName: `${props.serviceName}-ECR`,
			pipelineType: codepipeline.PipelineType.V2,
			restartExecutionOnUpdate: true
		});

		// Source stage: GitHub via CodeConnections
		this.pipeline.addStage({
			stageName: 'Source',
			actions: [
				new codepipeline_actions.CodeStarConnectionsSourceAction({
					actionName: 'GitHub',
					owner: props.githubOwner,
					repo: props.githubRepo,
					branch: 'main',
					connectionArn: props.githubConnectionArn,
					output: sourceArtifact
				})
			]
		});

		// Build stage: Docker build and push to ECR
		const buildProject = new KitchenBuildEcr(this, 'BuildProject', {
			serviceName: props.serviceName,
			ecrRepositoryUri: props.ecrRepositoryUri
		});

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
	}
}
```

**Usage:**

```typescript
const chefPipeline = new KitchenEcrPipeline(this, 'ChefEcrPipeline', {
	serviceName: 'Chef',
	githubOwner: 'dobrescu',
	githubRepo: 'chef',
	githubConnectionArn: context.githubConnectionArn,
	ecrRepositoryUri: imports.chef.uri
});
```

---

## 3. CodeBuild for Docker

**File:** `src/cicd/codebuild/kitchen-build-ecr.ts`

```typescript
import * as codebuild from 'aws-cdk-lib/aws-codebuild';

export class KitchenBuildEcr extends Construct {
	public readonly project: codebuild.Project;

	constructor(scope: Construct, id: string, props: KitchenBuildEcrProps) {
		super(scope, id);

		this.project = new codebuild.Project(this, 'Project', {
			projectName: `Kitchen-${props.serviceName}-Build`,
			environment: {
				buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
				computeType: codebuild.ComputeType.SMALL,
				privileged: true // Required for Docker builds
			},
			environmentVariables: {
				AWS_DEFAULT_REGION: { value: cdk.Aws.REGION },
				AWS_ACCOUNT_ID: { value: cdk.Aws.ACCOUNT_ID },
				IMAGE_REPO_NAME: { value: props.serviceName.toLowerCase() },
				IMAGE_TAG: { value: 'latest' },
				ECR_REPOSITORY_URI: { value: props.ecrRepositoryUri }
			},
			buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yml')
		});

		// Grant ECR push permissions
		this.project.addToRolePolicy(new iam.PolicyStatement({
			actions: [
				'ecr:GetAuthorizationToken',
				'ecr:BatchCheckLayerAvailability',
				'ecr:InitiateLayerUpload',
				'ecr:UploadLayerPart',
				'ecr:CompleteLayerUpload',
				'ecr:PutImage'
			],
			resources: ['*']
		}));
	}
}
```

**Buildspec (in chef/prepper repos):**

```yaml
version: 0.2
phases:
  pre_build:
    commands:
      - echo Logging in to Amazon ECR...
      - aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $ECR_REPOSITORY_URI
  build:
    commands:
      - echo Building Docker image...
      - docker build -t $IMAGE_REPO_NAME:$IMAGE_TAG .
      - docker tag $IMAGE_REPO_NAME:$IMAGE_TAG $ECR_REPOSITORY_URI:$IMAGE_TAG
  post_build:
    commands:
      - echo Pushing Docker image...
      - docker push $ECR_REPOSITORY_URI:$IMAGE_TAG
```

---

## 4. Deployment pipeline

**File:** `src/cicd/pipeline/kitchen-deploy-pipeline.ts`

```typescript
export class KitchenDeployPipeline extends Construct {
	public readonly pipeline: codepipeline.Pipeline;

	constructor(scope: Construct, id: string, props: KitchenDeployPipelineProps) {
		super(scope, id);

		const sourceArtifact = new codepipeline.Artifact('SourceArtifact');

		this.pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
			pipelineName: 'Kitchen-Deploy',
			pipelineType: codepipeline.PipelineType.V2,
			restartExecutionOnUpdate: true
		});

		// Source: GitHub
		this.pipeline.addStage({
			stageName: 'Source',
			actions: [
				new codepipeline_actions.CodeStarConnectionsSourceAction({
					actionName: 'GitHub',
					owner: 'dobrescu',
					repo: 'kitchen',
					branch: 'main',
					connectionArn: props.githubConnectionArn,
					output: sourceArtifact
				})
			]
		});

		// Build: Test, lint, resolve digests, deploy
		const deployProject = new codebuild.Project(this, 'DeployProject', {
			projectName: 'Kitchen-Deploy',
			environment: {
				buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
				computeType: codebuild.ComputeType.SMALL
			},
			buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.deploy.yml')
		});

		this.pipeline.addStage({
			stageName: 'Deploy',
			actions: [
				new codepipeline_actions.CodeBuildAction({
					actionName: 'CDK-Deploy',
					project: deployProject,
					input: sourceArtifact
				})
			]
		});
	}
}
```

**Deployment buildspec:** `buildspec.deploy.yml`

```yaml
version: 0.2
phases:
  install:
    commands:
      - echo Installing dependencies...
      - yarn install --immutable
  pre_build:
    commands:
      - echo Running tests...
      - yarn test --watchAll=false
      - yarn lint
      - yarn typecheck
  build:
    commands:
      - echo Resolving image digests...
      - yarn resolve-digests
      - echo Compiling TypeScript...
      - yarn build
  post_build:
    commands:
      - echo Deploying with CDK...
      - npx cdk deploy kitchen --require-approval never
```

---

## 5. EventBridge triggers

**File:** `src/cicd/cicd-stack.ts`

```typescript
import * as events from 'aws-cdk-lib/aws-events';
import * as events_targets from 'aws-cdk-lib/aws-events-targets';

// Rule: Trigger on Chef ECR push
const chefRule = new events.Rule(this, 'ChefEcrPushRule', {
	ruleName: 'Kitchen-Chef-ECR-Push-Trigger',
	eventPattern: {
		source: ['aws.ecr'],
		detailType: ['ECR Image Action'],
		detail: {
			'action-type': ['PUSH'],
			'result': ['SUCCESS'],
			'repository-name': [ecr.chef.name]
		}
	}
});

chefRule.addTarget(new events_targets.CodePipeline(kitchenDeployPipeline.pipeline));

// Rule: Trigger on Prepper ECR push
const prepperRule = new events.Rule(this, 'PrepperEcrPushRule', {
	ruleName: 'Kitchen-Prepper-ECR-Push-Trigger',
	eventPattern: {
		source: ['aws.ecr'],
		detailType: ['ECR Image Action'],
		detail: {
			'action-type': ['PUSH'],
			'result': ['SUCCESS'],
			'repository-name': [ecr.prepper.name]
		}
	}
});

prepperRule.addTarget(new events_targets.CodePipeline(kitchenDeployPipeline.pipeline));
```

**Event pattern:**
- Source: `aws.ecr`
- Detail type: `ECR Image Action`
- Action: `PUSH`
- Result: `SUCCESS`
- Repository name: `chef` or `prepper`

---

## 6. Image digest resolution

**Script:** `scripts/resolve-image-digests.sh`

```bash
#!/bin/bash

# Load environment variables
source .env

# Resolve Chef image
CHEF_TAG=${CHEF_IMAGE_TAG:-latest}
if [[ $CHEF_TAG == sha256:* ]]; then
  CHEF_DIGEST=$CHEF_TAG
else
  CHEF_DIGEST=$(aws ecr describe-images \
    --repository-name chef \
    --image-ids imageTag=$CHEF_TAG \
    --query 'imageDetails[0].imageDigest' \
    --output text)
fi

# Resolve Prepper image
PREPPER_TAG=${PREPPER_IMAGE_TAG:-latest}
if [[ $PREPPER_TAG == sha256:* ]]; then
  PREPPER_DIGEST=$PREPPER_TAG
else
  PREPPER_DIGEST=$(aws ecr describe-images \
    --repository-name prepper \
    --image-ids imageTag=$PREPPER_TAG \
    --query 'imageDetails[0].imageDigest' \
    --output text)
fi

# Generate manifest
cat > image-manifest.json <<EOF
{
  "chef": {
    "tag": "$CHEF_TAG",
    "digest": "$CHEF_DIGEST"
  },
  "prepper": {
    "tag": "$PREPPER_TAG",
    "digest": "$PREPPER_DIGEST"
  }
}
EOF

echo "Image manifest generated:"
cat image-manifest.json
```

**Why this matters:**
- Lambda deployed with SHA256 digest (not tag)
- Prevents unexpected updates when ECR images change
- Immutable deployments

---

## 7. Deployment workflow

**Initial setup:**

```bash
# 1. Deploy infra (ECR repos)
yarn cdk:deploy:kitchen:infra

# 2. Build and push images (from chef/prepper repos)
# This triggers Chef-ECR and Prepper-ECR pipelines

# 3. Resolve digests
yarn resolve-digests

# 4. Deploy service stack
yarn cdk:deploy:kitchen

# 5. Deploy CICD stack
yarn cdk:deploy:kitchen:cicd
```

**Automated workflow (after setup):**

```
1. Git push to chef/prepper
   ↓
2. Chef-ECR/Prepper-ECR pipeline builds and pushes image
   ↓
3. EventBridge detects ECR push
   ↓
4. Kitchen-Deploy pipeline triggered
   ↓
5. Pipeline resolves digests and deploys updated Lambda
```

---

## 8. Quick reference

### Pipeline template

```typescript
new codepipeline.Pipeline(this, 'Pipeline', {
	pipelineName: 'name',
	pipelineType: codepipeline.PipelineType.V2,
	restartExecutionOnUpdate: true
});
```

### GitHub source action

```typescript
new codepipeline_actions.CodeStarConnectionsSourceAction({
	actionName: 'GitHub',
	owner: 'owner',
	repo: 'repo',
	branch: 'main',
	connectionArn: arn,
	output: artifact
});
```

### CodeBuild action

```typescript
new codepipeline_actions.CodeBuildAction({
	actionName: 'Build',
	project: buildProject,
	input: sourceArtifact
});
```

### EventBridge rule

```typescript
new events.Rule(this, 'Rule', {
	ruleName: 'name',
	eventPattern: {
		source: ['aws.ecr'],
		detailType: ['ECR Image Action'],
		detail: {
			'action-type': ['PUSH'],
			'result': ['SUCCESS']
		}
	}
});
```

---

Related skills: `cdk-development-guidelines`, `infrastructure-guidelines`, `testing-guidelines`

Last updated: 2025-11-21
