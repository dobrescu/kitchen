---
name: testing-guidelines
description: Testing patterns for Kitchen CDK stacks using Jest and CDK assertions. Use when writing or modifying tests for infrastructure code.
---

# Testing Guidelines

## When this skill should be used

Auto-activates when Claude is:

- Writing or modifying test files
- Testing CDK stack resources
- Validating infrastructure configuration
- Working with Jest or CDK assertions
- Debugging test failures

Behavioral rules:

- Test infrastructure configuration, not implementation details
- Use CDK assertions library for resource validation
- Test all critical resources (Lambda, API, ECR, Pipelines)
- Verify stack outputs
- Test that stacks can synthesize together

---

## 1. Test setup

**File:** `jest.config.js`

```javascript
module.exports = {
	testEnvironment: 'node',
	roots: ['<rootDir>/test'],
	testMatch: ['**/*.test.ts'],
	transform: {
		'^.+\\.tsx?$': 'ts-jest'
	},
	moduleNameMapper: {
		'^(\\.{1,2}/.*)\\.js$': '$1'
	}
};
```

**Test file:** `test/stacks.test.ts`

```typescript
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { KitchenInfraStack } from '../src/infra/kitchen-infra-stack.js';
import { KitchenServiceStack } from '../src/service/kitchen-service-stack.js';
import { CicdStack } from '../src/cicd/cicd-stack.js';

describe('Kitchen Stacks', () => {
	let app: cdk.App;
	let infraStack: KitchenInfraStack;
	let serviceStack: KitchenServiceStack;
	let cicdStack: CicdStack;

	beforeEach(() => {
		app = new cdk.App();
		infraStack = new KitchenInfraStack(app, 'TestInfraStack');
		serviceStack = new KitchenServiceStack(app, 'TestServiceStack');
		cicdStack = new CicdStack(app, 'TestCicdStack');
	});

	// Tests here
});
```

---

## 2. Resource validation

### Testing resource creation

```typescript
test('creates ECR repositories', () => {
	const template = Template.fromStack(infraStack);

	// Verify 2 ECR repositories exist
	template.resourceCountIs('AWS::ECR::Repository', 2);

	// Verify Chef repository configuration
	template.hasResourceProperties('AWS::ECR::Repository', {
		RepositoryName: 'chef',
		ImageScanningConfiguration: {
			ScanOnPush: false
		}
	});

	// Verify Prepper repository configuration
	template.hasResourceProperties('AWS::ECR::Repository', {
		RepositoryName: 'prepper',
		ImageScanningConfiguration: {
			ScanOnPush: false
		}
	});
});
```

### Testing lifecycle policies

```typescript
test('applies lifecycle policies to ECR repositories', () => {
	const template = Template.fromStack(infraStack);

	template.hasResourceProperties('AWS::ECR::LifecyclePolicy', {
		LifecyclePolicyText: Match.stringLikeRegexp('maxImageCount.*10')
	});
});
```

### Testing Lambda configuration

```typescript
test('creates Lambda functions with correct configuration', () => {
	const template = Template.fromStack(serviceStack);

	// Chef Lambda
	template.hasResourceProperties('AWS::Lambda::Function', {
		FunctionName: 'chef',
		MemorySize: 512,
		Timeout: 30,
		PackageType: 'Image'
	});

	// Prepper Lambda
	template.hasResourceProperties('AWS::Lambda::Function', {
		FunctionName: 'prepper',
		MemorySize: 4096,
		Timeout: 30,
		PackageType: 'Image'
	});
});
```

### Testing API Gateway

```typescript
test('creates HTTP API v2 with routes', () => {
	const template = Template.fromStack(serviceStack);

	// API exists
	template.resourceCountIs('AWS::ApiGatewayV2::Api', 1);

	template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
		Name: 'kitchen-api',
		ProtocolType: 'HTTP'
	});

	// Routes exist
	template.resourceCountIs('AWS::ApiGatewayV2::Route', 2);

	template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
		RouteKey: 'GET /fetch'
	});

	template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
		RouteKey: 'GET /loadRecipe'
	});
});
```

---

## 3. IAM validation

### Testing role permissions

```typescript
test('grants DynamoDB permissions to Chef Lambda', () => {
	const template = Template.fromStack(serviceStack);

	template.hasResourceProperties('AWS::IAM::Policy', {
		PolicyDocument: {
			Statement: Match.arrayWith([
				Match.objectLike({
					Action: Match.arrayWith([
						'dynamodb:GetItem',
						'dynamodb:PutItem',
						'dynamodb:UpdateItem'
					]),
					Effect: 'Allow'
				})
			])
		}
	});
});
```

---

## 4. Pipeline validation

### Testing pipeline creation

```typescript
test('creates CodePipeline pipelines', () => {
	const template = Template.fromStack(cicdStack);

	// 3 pipelines: Chef-ECR, Prepper-ECR, Kitchen-Deploy
	template.resourceCountIs('AWS::CodePipeline::Pipeline', 3);

	template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
		Name: 'Chef-ECR'
	});

	template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
		Name: 'Prepper-ECR'
	});

	template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
		Name: 'Kitchen-Deploy'
	});
});
```

### Testing EventBridge rules

```typescript
test('creates EventBridge rules for ECR triggers', () => {
	const template = Template.fromStack(cicdStack);

	template.hasResourceProperties('AWS::Events::Rule', {
		Name: 'Kitchen-Chef-ECR-Push-Trigger',
		EventPattern: {
			source: ['aws.ecr'],
			'detail-type': ['ECR Image Action'],
			detail: {
				'action-type': ['PUSH'],
				result: ['SUCCESS'],
				'repository-name': ['chef']
			}
		}
	});
});
```

---

## 5. Output validation

```typescript
test('outputs ECR repository ARNs', () => {
	const template = Template.fromStack(infraStack);

	// Find outputs
	const outputs = template.findOutputs('*');

	expect(Object.keys(outputs)).toContain('ChefRepositoryArn');
	expect(Object.keys(outputs)).toContain('PrepperRepositoryArn');
});
```

---

## 6. Stack synthesis

```typescript
test('all stacks can synthesize together', () => {
	const assembly = app.synth();

	expect(assembly.stacks).toHaveLength(3);
	expect(assembly.stacks.map(s => s.stackName)).toContain('TestInfraStack');
	expect(assembly.stacks.map(s => s.stackName)).toContain('TestServiceStack');
	expect(assembly.stacks.map(s => s.stackName)).toContain('TestCicdStack');
});
```

---

## 7. Advanced patterns

### Using Match utilities

```typescript
import { Match } from 'aws-cdk-lib/assertions';

// String pattern matching
template.hasResourceProperties('AWS::ECR::LifecyclePolicy', {
	LifecyclePolicyText: Match.stringLikeRegexp('maxImageCount')
});

// Array contains
template.hasResourceProperties('AWS::IAM::Policy', {
	PolicyDocument: {
		Statement: Match.arrayWith([
			Match.objectLike({
				Action: Match.arrayWith(['s3:GetObject'])
			})
		])
	}
});

// Any value
template.hasResourceProperties('AWS::Lambda::Function', {
	FunctionName: Match.anyValue()
});

// Absent
template.hasResourceProperties('AWS::ECR::Repository', {
	EncryptionConfiguration: Match.absent()
});
```

### Testing environment variables

```typescript
test('Lambda has correct environment variables', () => {
	const template = Template.fromStack(serviceStack);

	template.hasResourceProperties('AWS::Lambda::Function', {
		FunctionName: 'chef',
		Environment: {
			Variables: Match.objectLike({
				S3_COOKBOOKS: Match.anyValue(),
				DYNAMODB_COOKBOOKS: Match.anyValue(),
				PREPPER_URL: Match.anyValue()
			})
		}
	});
});
```

---

## 8. Running tests

```bash
# Run all tests
yarn test

# Run in watch mode
yarn test --watch

# Run with coverage
yarn test --coverage

# Run specific test file
yarn test stacks.test.ts
```

---

## 9. Quick reference

### Test template

```typescript
test('description', () => {
	const template = Template.fromStack(stack);

	template.resourceCountIs('AWS::Service::Resource', count);

	template.hasResourceProperties('AWS::Service::Resource', {
		Property: 'value'
	});
});
```

### Common assertions

```typescript
// Count resources
template.resourceCountIs('AWS::Lambda::Function', 2);

// Check properties
template.hasResourceProperties('AWS::Lambda::Function', { ... });

// Find resources
const resources = template.findResources('AWS::Lambda::Function');

// Find outputs
const outputs = template.findOutputs('*');
```

### Match utilities

```typescript
Match.anyValue()                    // Any value
Match.absent()                      // Property not present
Match.stringLikeRegexp('pattern')   // Regex match
Match.arrayWith([...])              // Array contains
Match.objectLike({...})             // Object contains
```

---

Related skills: `cdk-development-guidelines`, `infrastructure-guidelines`, `cicd-guidelines`

Last updated: 2025-11-21
