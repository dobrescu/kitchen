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
- Working with CDK app entry point

Behavioral rules:

- Use 3-stack separation: infra (ECR) → service (API+Lambda) → cicd (pipelines)
- ESM imports with `.js` extension for local files
- Named exports only (no defaults)
- Readonly props interfaces
- SSM Parameter Store for inter-stack communication

---

## 1. Stack architecture

Kitchen uses 3-stack design for separation of concerns:

```
KitchenInfraStack        Creates ECR repos, exports to SSM
    ↓
KitchenServiceStack      Imports from SSM, creates Lambda + API
    ↓
CicdStack                Imports from SSM, creates pipelines
```

**File:** `/home/user/kitchen/src/bin/kitchen.ts`

```typescript
const app = new cdk.App();

const infraStack = new KitchenInfraStack(app, 'kitchen-infra', { env });
const serviceStack = new KitchenServiceStack(app, 'kitchen', { env });
const cicdStack = new CicdStack(app, 'kitchen-cicd', { env });
```

**Why 3 stacks:**
- Deploy infra once, update service frequently
- CICD stack can be deployed independently
- Clear dependency chain

---

## 2. Stack pattern

```typescript
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class MyStack extends cdk.Stack {
	constructor(scope: Construct, id: string, props?: cdk.StackProps) {
		super(scope, id, props);

		// Create resources
		const resource = new MyConstruct(this, 'ResourceId', {
			prop: 'value'
		});

		// Outputs
		new cdk.CfnOutput(this, 'ResourceArn', {
			value: resource.arn,
			description: 'ARN of the resource'
		});
	}
}
```

**Key points:**
- Extends `cdk.Stack`
- Constructor with `Construct, string, StackProps`
- Use `CfnOutput` for important values

---

## 3. Construct pattern

```typescript
import { Construct } from 'constructs';

export interface MyConstructProps {
	readonly param1: string;
	readonly param2?: number; // Optional with ?
}

export class MyConstruct extends Construct {
	public readonly resource: ResourceType;

	constructor(scope: Construct, id: string, props: MyConstructProps) {
		super(scope, id);

		this.resource = new ResourceType(this, 'Resource', {
			property: props.param1
		});
	}
}
```

**Key points:**
- Interface with `readonly` properties
- Extends `Construct`
- Expose important resources as public properties

---

## 4. ESM imports

Always use `.js` extension for local imports (TypeScript ESM requirement):

```typescript
// ✅ GOOD
import { EcrRepositories } from './ecr-repositories.js';
import { KitchenExports } from './kitchen-exports.js';

// ❌ BAD
import { EcrRepositories } from './ecr-repositories';
import { KitchenExports } from './kitchen-exports.ts';
```

**AWS CDK imports:**

```typescript
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';
```

---

## 5. SSM Parameter Store for inter-stack communication

**Kitchen-specific pattern:** Use SSM to share values between stacks instead of cross-stack references.

### Exporting values

**File:** `src/infra/kitchen-exports.ts`

```typescript
export class KitchenExports extends Construct {
	constructor(scope: Construct, id: string, repos: { chef: IRepository; prepper: IRepository }) {
		super(scope, id);

		new ssm.StringParameter(this, 'ChefRepoArn', {
			parameterName: '/kitchen/ecr/chef/arn',
			stringValue: repos.chef.repositoryArn
		});

		new ssm.StringParameter(this, 'ChefRepoUri', {
			parameterName: '/kitchen/ecr/chef/uri',
			stringValue: repos.chef.repositoryUri
		});
	}
}
```

### Importing values

**File:** `src/infra/kitchen-imports.ts`

```typescript
export class KitchenImports extends Construct {
	public readonly chef: { arn: string; uri: string; name: string };

	constructor(scope: Construct, id: string) {
		super(scope, id);

		this.chef = {
			arn: ssm.StringParameter.valueForStringParameter(this, '/kitchen/ecr/chef/arn'),
			uri: ssm.StringParameter.valueForStringParameter(this, '/kitchen/ecr/chef/uri'),
			name: ssm.StringParameter.valueForStringParameter(this, '/kitchen/ecr/chef/name')
		};
	}
}
```

**Usage in dependent stack:**

```typescript
export class KitchenServiceStack extends cdk.Stack {
	constructor(scope: Construct, id: string, props?: cdk.StackProps) {
		super(scope, id, props);

		const imports = new KitchenImports(this, 'Imports');

		new ChefLambda(this, 'ChefLambda', {
			repositoryArn: imports.chef.arn,
			repositoryUri: imports.chef.uri,
			repositoryName: imports.chef.name
		});
	}
}
```

**Benefits:**
- Stacks can be deployed independently
- No CloudFormation cross-stack export limits
- Values can be updated without redeploying exporting stack

---

## 6. Type safety

### Interfaces for props

```typescript
export interface ChefLambdaProps {
	readonly repositoryArn: string;
	readonly repositoryUri: string;
	readonly repositoryName: string;
	readonly openAiApiKey: string;
	readonly s3CookbooksBucket: string;
	readonly dynamoCookbooksTable: string;
	readonly prepperUrl: string;
}
```

### Context values

```typescript
// cdk.json or cdk.context.json
{
  "domainName": "cook.hautomation.org",
  "hostedZoneName": "hautomation.org"
}

// Read in stack
const domainName = this.node.tryGetContext('domainName') || 'cook.hautomation.org';
```

### Environment

```typescript
const env = {
	account: process.env.CDK_DEFAULT_ACCOUNT,
	region: process.env.CDK_DEFAULT_REGION
};

new MyStack(app, 'MyStack', { env });
```

---

## 7. Common patterns

### Naming conventions

```typescript
// Physical resource names: kebab-case
functionName: 'chef'
repositoryName: 'prepper'
ruleName: 'Kitchen-Chef-ECR-Push-Trigger'

// Construct IDs: PascalCase
new ChefLambda(this, 'ChefLambda', {...});
new EcrRepositories(this, 'EcrRepos', {...});

// Logical names: CamelCase (CDK auto-generates)
```

### Outputs

```typescript
new cdk.CfnOutput(this, 'ChefRepoArn', {
	value: repos.chef.repositoryArn,
	description: 'ARN of Chef ECR repository',
	exportName: 'KitchenChefRepoArn' // Optional: for cross-stack refs
});
```

### Removal policies

```typescript
// Development - destroy on stack delete
new ecr.Repository(this, 'Repo', {
	removalPolicy: cdk.RemovalPolicy.DESTROY
});

// Production - retain resources
new dynamodb.Table(this, 'Table', {
	removalPolicy: cdk.RemovalPolicy.RETAIN
});
```

---

## 8. Quick reference

### Stack template

```typescript
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class MyStack extends cdk.Stack {
	constructor(scope: Construct, id: string, props?: cdk.StackProps) {
		super(scope, id, props);
		// Resources here
	}
}
```

### Construct template

```typescript
import { Construct } from 'constructs';

export interface MyProps {
	readonly prop: string;
}

export class MyConstruct extends Construct {
	public readonly resource: Type;

	constructor(scope: Construct, id: string, props: MyProps) {
		super(scope, id);
		this.resource = new Type(this, 'Id', {});
	}
}
```

### SSM export

```typescript
new ssm.StringParameter(this, 'ParamId', {
	parameterName: '/kitchen/category/name',
	stringValue: value
});
```

### SSM import

```typescript
const value = ssm.StringParameter.valueForStringParameter(this, '/kitchen/category/name');
```

---

Related skills: `infrastructure-guidelines`, `cicd-guidelines`, `testing-guidelines`

Last updated: 2025-11-21
