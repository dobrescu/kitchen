import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { KitchenServiceStack } from '../src/service/kitchen-service-stack.js';
import { CicdStack } from '../src/cicd/cicd-stack.js';

describe('Kitchen ServiceStack (API & Lambda)', () => {
  const testEnv = {
    account: '123456789012',
    region: 'eu-central-1',
  };

  test('ServiceStack works with image environment variables', () => {
    process.env.PREPPER_IMAGE_TAG = 'sha256:test1234';
    process.env.CHEF_IMAGE_TAG = 'sha256:test5678';

    const app = new cdk.App({
      context: {
        s3CookbooksBucket: 'test-cookbooks-bucket',
        dynamoCookbooksTable: 'test-cookbooks-table',
      },
    });
    const stack = new KitchenServiceStack(app, 'TestServiceStack', { env: testEnv });
    const template = Template.fromStack(stack);

    // Test Lambda functions are created
    template.resourceCountIs('AWS::Lambda::Function', 2);

    delete process.env.PREPPER_IMAGE_TAG;
    delete process.env.CHEF_IMAGE_TAG;
  });

  test('ServiceStack creates API Gateway with custom domain', () => {
    process.env.PREPPER_IMAGE_TAG = 'sha256:test1234';
    process.env.CHEF_IMAGE_TAG = 'sha256:test5678';

    const app = new cdk.App({
      context: {
        s3CookbooksBucket: 'test-cookbooks-bucket',
        dynamoCookbooksTable: 'test-cookbooks-table',
      },
    });
    const stack = new KitchenServiceStack(app, 'TestServiceStack', { env: testEnv });
    const template = Template.fromStack(stack);

    // Test API Gateway is created
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Description: 'Kitchen API Gateway',
    });

    // Test custom domain
    template.hasResourceProperties('AWS::ApiGateway::DomainName', {
      DomainName: 'cook.hautomation.org',
    });

    // Test Lambda functions are created
    template.resourceCountIs('AWS::Lambda::Function', 2);

    // Test API Gateway methods
    template.hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'GET',
    });

    delete process.env.PREPPER_IMAGE_TAG;
    delete process.env.CHEF_IMAGE_TAG;
  });

  test('Lambda functions have correct memory and timeout settings', () => {
    process.env.PREPPER_IMAGE_TAG = 'sha256:test1234';
    process.env.CHEF_IMAGE_TAG = 'sha256:test5678';

    const app = new cdk.App({
      context: {
        s3CookbooksBucket: 'test-cookbooks-bucket',
        dynamoCookbooksTable: 'test-cookbooks-table',
      },
    });
    const stack = new KitchenServiceStack(app, 'TestServiceStack', { env: testEnv });
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::Lambda::Function', {
      MemorySize: 512,
      Timeout: 30,
      PackageType: 'Image',
    });

    delete process.env.PREPPER_IMAGE_TAG;
    delete process.env.CHEF_IMAGE_TAG;
  });

  test('Lambda functions have proper names', () => {
    process.env.PREPPER_IMAGE_TAG = 'sha256:test1234';
    process.env.CHEF_IMAGE_TAG = 'sha256:test5678';

    const app = new cdk.App({
      context: {
        s3CookbooksBucket: 'test-cookbooks-bucket',
        dynamoCookbooksTable: 'test-cookbooks-table',
      },
    });
    const stack = new KitchenServiceStack(app, 'TestServiceStack', { env: testEnv });
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'prepper',
    });

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'chef',
    });

    delete process.env.PREPPER_IMAGE_TAG;
    delete process.env.CHEF_IMAGE_TAG;
  });
});

describe('Kitchen CicdStack', () => {
  const testEnv = {
    account: '123456789012',
    region: 'eu-central-1',
  };

  test('CicdStack creates pipelines for chef, prepper, and kitchen deployment', () => {
    const app = new cdk.App({
      context: {
        'github-connection-arn': 'arn:aws:codeconnections:eu-central-1:123456789012:connection/test-connection',
      },
    });
    const cicdStack = new CicdStack(app, 'TestCicdStack', { env: testEnv });
    const template = Template.fromStack(cicdStack);

    // Test 3 pipelines are created (Chef-ECR, Prepper-ECR, Kitchen-Deploy)
    template.resourceCountIs('AWS::CodePipeline::Pipeline', 3);

    template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
      Name: 'Chef-ECR',
    });

    template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
      Name: 'Prepper-ECR',
    });

    template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
      Name: 'Kitchen-Deploy',
    });

    // Test CodeBuild projects are created (2 for ECR + 1 for CDK deploy)
    template.resourceCountIs('AWS::CodeBuild::Project', 3);
  });

  test('CodeBuild projects have correct environment and privileges', () => {
    const app = new cdk.App({
      context: {
        'github-connection-arn': 'arn:aws:codeconnections:eu-central-1:123456789012:connection/test-connection',
      },
    });
    const cicdStack = new CicdStack(app, 'TestCicdStack', { env: testEnv });
    const template = Template.fromStack(cicdStack);

    template.hasResourceProperties('AWS::CodeBuild::Project', {
      Environment: {
        Image: 'aws/codebuild/standard:7.0',
        PrivilegedMode: true,
        Type: 'LINUX_CONTAINER',
      },
    });
  });

  test('ECR CodeBuild projects use buildspec from repository', () => {
    const app = new cdk.App({
      context: {
        'github-connection-arn': 'arn:aws:codeconnections:eu-central-1:123456789012:connection/test-connection',
      },
    });
    const cicdStack = new CicdStack(app, 'TestCicdStack', { env: testEnv });
    const template = Template.fromStack(cicdStack);

    // Test buildspec is loaded from source for ECR build projects
    template.hasResourceProperties('AWS::CodeBuild::Project', {
      Source: {
        BuildSpec: 'buildspec.yml',
      },
    });
  });

  test('IAM policies grant ECR permissions', () => {
    const app = new cdk.App({
      context: {
        'github-connection-arn': 'arn:aws:codeconnections:eu-central-1:123456789012:connection/test-connection',
      },
    });
    const cicdStack = new CicdStack(app, 'TestCicdStack', { env: testEnv });
    const template = Template.fromStack(cicdStack);

    // Verify IAM policies with ECR permissions exist
    const policies = template.findResources('AWS::IAM::Policy');
    const hasEcrPermissions = Object.values(policies).some(policy => {
      const statements = policy.Properties?.PolicyDocument?.Statement || [];
      return statements.some((stmt: any) => {
        const actions = Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action];
        return actions.some((action: string) => action?.startsWith('ecr:'));
      });
    });
    expect(hasEcrPermissions).toBe(true);
  });
});
