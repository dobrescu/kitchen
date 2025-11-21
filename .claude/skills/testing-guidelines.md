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

## Test setup

**File:** `test/stacks.test.ts`

```typescript
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { KitchenInfraStack } from '../src/infra/kitchen-infra-stack.js';

describe('Kitchen Stacks', () => {
  let app: cdk.App;
  let infraStack: KitchenInfraStack;

  beforeEach(() => {
    app = new cdk.App();
    infraStack = new KitchenInfraStack(app, 'TestInfraStack');
  });

  // Tests here
});
```

---

## Resource validation

**Count resources:**
```typescript
test('creates ECR repositories', () => {
  const template = Template.fromStack(infraStack);
  template.resourceCountIs('AWS::ECR::Repository', 2);
});
```

**Check properties:**
```typescript
template.hasResourceProperties('AWS::ECR::Repository', {
  RepositoryName: 'chef',
  ImageScanningConfiguration: { ScanOnPush: false }
});
```

**Lambda configuration:**
```typescript
template.hasResourceProperties('AWS::Lambda::Function', {
  FunctionName: 'chef',
  MemorySize: 512,
  Timeout: 30,
  PackageType: 'Image'
});
```

**API Gateway:**
```typescript
template.resourceCountIs('AWS::ApiGatewayV2::Api', 1);
template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
  RouteKey: 'GET /fetch'
});
```

---

## IAM validation

```typescript
template.hasResourceProperties('AWS::IAM::Policy', {
  PolicyDocument: {
    Statement: Match.arrayWith([
      Match.objectLike({
        Action: Match.arrayWith(['dynamodb:GetItem', 'dynamodb:PutItem']),
        Effect: 'Allow'
      })
    ])
  }
});
```

---

## Pipeline validation

```typescript
test('creates CodePipeline pipelines', () => {
  const template = Template.fromStack(cicdStack);
  template.resourceCountIs('AWS::CodePipeline::Pipeline', 3);
  template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
    Name: 'Chef-ECR'
  });
});
```

**EventBridge rules:**
```typescript
template.hasResourceProperties('AWS::Events::Rule', {
  Name: 'Kitchen-Chef-ECR-Push-Trigger',
  EventPattern: {
    source: ['aws.ecr'],
    'detail-type': ['ECR Image Action']
  }
});
```

---

## Output validation

```typescript
test('outputs ECR repository ARNs', () => {
  const template = Template.fromStack(infraStack);
  const outputs = template.findOutputs('*');
  expect(Object.keys(outputs)).toContain('ChefRepositoryArn');
});
```

---

## Stack synthesis

```typescript
test('all stacks can synthesize together', () => {
  const assembly = app.synth();
  expect(assembly.stacks).toHaveLength(3);
  expect(assembly.stacks.map(s => s.stackName)).toContain('TestInfraStack');
});
```

---

## Match utilities

```typescript
import { Match } from 'aws-cdk-lib/assertions';

Match.anyValue()                    // Any value
Match.absent()                      // Property not present
Match.stringLikeRegexp('pattern')   // Regex match
Match.arrayWith([...])              // Array contains
Match.objectLike({...})             // Object contains
```

---

## Running tests

```bash
yarn test              # Run all tests
yarn test --watch      # Watch mode
yarn test stacks.test.ts  # Specific file
```

---

Related skills: `cdk-development-guidelines`, `infrastructure-guidelines`, `cicd-guidelines`

Last updated: 2025-11-21
