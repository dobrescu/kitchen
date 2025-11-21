---
name: cdk-development-guidelines
description: AWS CDK development patterns for Kitchen infrastructure. Use when creating or editing stacks, constructs, or CDK infrastructure code.
---

# CDK Development Guidelines

## When this skill should be used

Auto-activates when Claude is:

- Creating or editing CDK stacks
- Working with constructs (custom or AWS-provided)
- Modifying infrastructure code in `src/infra/`, `src/service/`, or `src/cicd/`
- Setting up inter-stack communication

Behavioral rules:

- Use 3-stack separation: infra (ECR) → service (API+Lambda) → cicd (pipelines)
- ESM imports with `.js` extension for local files
- Named exports only (no defaults)
- Readonly props interfaces
- SSM Parameter Store for inter-stack communication

---

## Stack architecture

Kitchen uses 3-stack design (`src/bin/kitchen.ts`):

```
KitchenInfraStack    → ECR repos + SSM exports
KitchenServiceStack  → Lambda + API (imports from SSM)
CicdStack            → Pipelines (imports from SSM)
```

**Why:** Deploy infra once, update services frequently, clear dependency chain.

---

## SSM Parameter Store (Kitchen-specific)

**Export values** (`src/infra/kitchen-exports.ts`):
```typescript
new ssm.StringParameter(this, 'ChefRepoArn', {
  parameterName: '/kitchen/ecr/chef/arn',
  stringValue: repos.chef.repositoryArn
});
```

**Import values** (`src/infra/kitchen-imports.ts`):
```typescript
this.chef = {
  arn: ssm.StringParameter.valueForStringParameter(this, '/kitchen/ecr/chef/arn')
};
```

**Why:** Stacks deploy independently, no CloudFormation cross-stack limits.

---

## Stack pattern

```typescript
export class MyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // Resources
  }
}
```

---

## Construct pattern

```typescript
export interface MyConstructProps {
  readonly param: string;
}

export class MyConstruct extends Construct {
  public readonly resource: Type;

  constructor(scope: Construct, id: string, props: MyConstructProps) {
    super(scope, id);
    this.resource = new Type(this, 'Id', { ... });
  }
}
```

---

## ESM imports

```typescript
// ✅ Local imports - use .js extension
import { EcrRepositories } from './ecr-repositories.js';

// ✅ AWS CDK imports
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
```

---

## Common patterns

**Naming:**
- Physical names: `kebab-case` (chef, prepper)
- Construct IDs: `PascalCase` (ChefLambda, EcrRepos)

**Context values:**
```typescript
const domain = this.node.tryGetContext('domainName') || 'cook.hautomation.org';
```

**Outputs:**
```typescript
new cdk.CfnOutput(this, 'ChefRepoArn', {
  value: repos.chef.repositoryArn,
  description: 'ARN of Chef ECR repository'
});
```

**Removal policies:**
```typescript
removalPolicy: cdk.RemovalPolicy.DESTROY  // Dev
removalPolicy: cdk.RemovalPolicy.RETAIN   // Prod
```

---

Related skills: `infrastructure-guidelines`, `cicd-guidelines`, `testing-guidelines`

Last updated: 2025-11-21
