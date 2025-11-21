# GitHub Copilot Instructions for Kitchen CDK Project

## Project Context

This is an AWS CDK TypeScript project that deploys a microservices API with automated CI/CD. The project uses:
- **TypeScript 5.6+** with ES modules (ESM)
- **AWS CDK** for infrastructure as code
- **Yarn** for package management (with node_modules linker)
- **Jest** for testing
- **ESLint** for code quality

## Code Style and Conventions

### TypeScript
- Use ES6+ features: `const`/`let`, arrow functions, async/await
- Explicit types preferred; avoid `any` unless necessary
- ESM imports with `.js` extensions: `import { X } from './module.js'`
- No default exports; use named exports

### AWS CDK Patterns
- Resource names use CamelCase: `KitchenChefBuild`, `KitchenLambdaExecutionRole`
- Logical IDs (construct IDs) use PascalCase: `'ChefRepository'`, `'FetchFunction'`
- Physical names include project prefix: `kitchen-chef`, `KitchenFetchFunction`
- Always include descriptions for outputs and stacks

### File Organization
```
src/
  bin/      - CDK app entry point
  infra/    - Infrastructure stacks
  cicd/     - CI/CD stacks
test/       - Jest unit tests
```

### IAM and Security
- Use least-privilege IAM policies
- Name IAM roles explicitly for tracking
- Enable ECR image scanning
- Include removal policies for dev resources

### Lambda Functions
- Container-based Lambdas from ECR
- Use `lambda.Runtime.FROM_IMAGE` and `lambda.Handler.FROM_IMAGE`
- Set explicit timeout and memory limits
- Name functions with project prefix

### API Gateway
- Use REST API for cost optimization
- Include CORS configuration
- Comment custom domain setup until ready
- Add descriptive integration settings

### CodeBuild
- Load buildspec from repository (`BuildSpec.fromSourceFilename`)
- Use standard build image (STANDARD_7_0)
- Enable privileged mode for Docker builds
- Include ECR environment variables

## Testing Guidelines

- Test file naming: `*.test.ts`
- Use CDK assertions library: `aws-cdk-lib/assertions`
- Test patterns:
  - Resource creation with `hasResourceProperties`
  - Resource counts with `resourceCountIs`
  - Custom validation with `findResources`
- Each stack should have dedicated test suite

## Development Workflow

### Before Committing
```bash
yarn lint:fix    # Fix auto-fixable issues
yarn typecheck   # Verify types
yarn test        # Run all tests
yarn build       # Ensure compilation succeeds
```

### CDK Operations
```bash
yarn cdk diff          # Review changes
yarn cdk synth         # Generate CloudFormation
yarn cdk deploy --all  # Deploy stacks
```

## Common Patterns

### Creating a New Stack
```typescript
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class MyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Resources here

    new cdk.CfnOutput(this, 'OutputName', {
      value: resource.attribute,
      description: 'Description of output',
    });
  }
}
```

### Lambda from ECR
```typescript
const fn = new lambda.Function(this, 'FunctionName', {
  functionName: 'ProjectPrefixFunction',
  runtime: lambda.Runtime.FROM_IMAGE,
  handler: lambda.Handler.FROM_IMAGE,
  code: lambda.Code.fromEcrImage(repository, {
    tagOrDigest: 'latest',
  }),
  timeout: cdk.Duration.seconds(30),
  memorySize: 512,
});
```

### ECR with Lifecycle
```typescript
const repo = new ecr.Repository(this, 'RepoName', {
  repositoryName: 'project-repo-name',
  imageScanOnPush: true,
  lifecycleRules: [
    {
      description: 'Keep only 10 images',
      maxImageCount: 10,
    },
    {
      description: 'Delete untagged images after 1 day',
      tagStatus: ecr.TagStatus.UNTAGGED,
      maxImageAge: cdk.Duration.days(1),
    },
  ],
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});
```

## Avoid

- Don't use inline buildspecs in CodeBuild (load from repo)
- Don't hardcode credentials or secrets
- Don't use wildcard IAM permissions
- Don't ignore TypeScript strict mode errors
- Don't commit without running lint and tests
- Don't use npm commands (use yarn)
- Don't modify CDK CloudAssembly directory (cdk.out/)

## Dependencies

### When Adding CDK Constructs
```bash
# Already included in aws-cdk-lib
import * as service from 'aws-cdk-lib/aws-service';
```

### When Adding Dev Dependencies
```bash
yarn add -D package-name
```

### When Adding Runtime Dependencies
```bash
yarn add package-name
```

## ESLint Rules

The project enforces:
- No unused imports (auto-removed)
- Semicolons required
- No multiple empty lines (max 2)
- No shadowing variables
- TypeScript-specific rules for nullability and types

Run `yarn lint:fix` before committing to auto-fix issues.

## Environment Variables

### Required for Deployment
- `CDK_DEFAULT_ACCOUNT`: AWS account ID
- `CDK_DEFAULT_REGION`: AWS region

### Optional for Lambda Configuration
- `PREPPER_IMAGE_TAG`: ECR image tag for Prepper Lambda
- `CHEF_IMAGE_TAG`: ECR image tag for Chef Lambda

## Useful Commands

```bash
# Development
yarn dev                    # Run with tsx (no build)
yarn build                  # Compile TypeScript
yarn watch                  # Watch mode compilation
yarn typecheck              # Type-only checking

# Quality
yarn lint                   # Check code style
yarn lint:fix               # Auto-fix issues
yarn test                   # Run all tests

# CDK
yarn cdk synth              # Generate templates
yarn cdk diff               # Show changes
yarn cdk deploy --all       # Deploy everything
yarn cdk destroy --all      # Remove all stacks
```

## When Making Changes

1. **Infrastructure Changes**: Edit files in `src/infra/`
2. **CI/CD Changes**: Edit files in `src/cicd/`
3. **Add Tests**: Update `test/kitchen.test.ts`
4. **Update Docs**: Modify README.md as needed
5. **Verify**: Run `yarn typecheck && yarn test && yarn cdk synth`

## Project-Specific Notes

- Buildspec files live in chef/prepper repos, not here
- Lambda functions use container images (not zip files)
- API Gateway custom domain is commented out (enable when ready)
- ECR lifecycle keeps max 10 images per repository
- CodeBuild triggers on GitHub webhook (main branch)
