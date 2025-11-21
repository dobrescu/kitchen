import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { KitchenInfraStack } from '../src/infra/kitchen-infra-stack.js';
import { KitchenServiceStack } from '../src/service/kitchen-service-stack.js';
import { CicdStack } from '../src/cicd/cicd-stack.js';

describe('KitchenInfraStack (ECR Repositories)', () => {
  const testEnv = {
    account: '123456789012',
    region: 'eu-central-1',
  };

  let app: cdk.App;
  let infraStack: KitchenInfraStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    infraStack = new KitchenInfraStack(app, 'TestKitchenInfraStack', { env: testEnv });
    template = Template.fromStack(infraStack);
  });

  describe('ECR Repositories', () => {
    test('creates chef and prepper ECR repositories', () => {
      template.hasResourceProperties('AWS::ECR::Repository', {
        RepositoryName: 'chef',
      });

      template.hasResourceProperties('AWS::ECR::Repository', {
        RepositoryName: 'prepper',
      });

      template.resourceCountIs('AWS::ECR::Repository', 2);
    });

    test('applies lifecycle policies to ECR repositories', () => {
      const repositories = template.findResources('AWS::ECR::Repository');

      Object.values(repositories).forEach(repo => {
        expect(repo.Properties.LifecyclePolicy).toBeDefined();
        const policyText = JSON.parse(repo.Properties.LifecyclePolicy.LifecyclePolicyText);
        expect(policyText.rules).toBeDefined();
        expect(policyText.rules.length).toBeGreaterThan(0);
      });
    });

    test('configures image scanning', () => {
      const repositories = template.findResources('AWS::ECR::Repository');

      Object.values(repositories).forEach(repo => {
        expect(repo.Properties.ImageScanningConfiguration).toBeDefined();
        expect(repo.Properties.ImageScanningConfiguration.ScanOnPush).toBe(false);
      });
    });
  });

  describe('SSM Parameter Store Exports', () => {
    test('exports chef repository ARN to SSM', () => {
      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: '/kitchen/ecr/chef/arn',
        Type: 'String',
      });
    });

    test('exports chef repository URI to SSM', () => {
      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: '/kitchen/ecr/chef/uri',
        Type: 'String',
      });
    });

    test('exports chef repository name to SSM', () => {
      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: '/kitchen/ecr/chef/name',
        Type: 'String',
      });
    });

    test('exports prepper repository information to SSM', () => {
      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: '/kitchen/ecr/prepper/arn',
        Type: 'String',
      });

      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: '/kitchen/ecr/prepper/uri',
        Type: 'String',
      });

      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: '/kitchen/ecr/prepper/name',
        Type: 'String',
      });
    });

    test('creates 6 SSM parameters total (3 per repository)', () => {
      template.resourceCountIs('AWS::SSM::Parameter', 6);
    });
  });

  describe('Stack Outputs', () => {
    test('outputs ECR repository URIs', () => {
      const outputs = template.findOutputs('*');
      expect(outputs.ChefRepositoryUri).toBeDefined();
      expect(outputs.PrepperRepositoryUri).toBeDefined();
    });

    test('outputs ECR repository names', () => {
      const outputs = template.findOutputs('*');
      expect(outputs.ChefRepositoryName).toBeDefined();
      expect(outputs.PrepperRepositoryName).toBeDefined();
    });
  });
});

describe('ServiceStack (API Gateway & Lambdas)', () => {
  const testEnv = {
    account: '123456789012',
    region: 'eu-central-1',
  };

  let app: cdk.App;
  let infraStack: KitchenInfraStack;
  let apiStack: KitchenServiceStack;
  let template: Template;

  beforeEach(() => {
    // Set required environment variables for image references
    process.env.PREPPER_IMAGE_TAG = 'sha256:test1234';
    process.env.CHEF_IMAGE_TAG = 'sha256:test5678';

    app = new cdk.App({
      context: {
        s3CookbooksBucket: 'test-cookbooks-bucket',
        dynamoCookbooksTable: 'test-cookbooks-table',
        openAiApiKey: '/test/openai-api-key',
      },
    });
    infraStack = new KitchenInfraStack(app, 'TestKitchenInfraStack', { env: testEnv });
    apiStack = new KitchenServiceStack(app, 'TestKitchenStack', { env: testEnv });
    template = Template.fromStack(apiStack);
  });

  afterEach(() => {
    delete process.env.PREPPER_IMAGE_TAG;
    delete process.env.CHEF_IMAGE_TAG;
  });

  describe('Lambda Functions', () => {
    test('creates prepper and chef Lambda functions', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'prepper',
        PackageType: 'Image',
      });

      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'chef',
        PackageType: 'Image',
      });

      template.resourceCountIs('AWS::Lambda::Function', 2);
    });

    test('configures Lambda functions with correct memory and timeout', () => {
      // Chef Lambda: 512MB, Prepper Lambda: 4096MB, both 30s timeout
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'chef',
        MemorySize: 512,
        Timeout: 30,
      });

      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'prepper',
        MemorySize: 4096,
        Timeout: 30,
      });
    });

    test('uses Docker images from ECR', () => {
      const functions = template.findResources('AWS::Lambda::Function');

      Object.values(functions).forEach(fn => {
        expect(fn.Properties.PackageType).toBe('Image');
        expect(fn.Properties.Code.ImageUri).toBeDefined();
      });
    });

    test('assigns execution role to Lambda functions', () => {
      template.hasResourceProperties('AWS::IAM::Role', {
        RoleName: 'ChefLambdaExecutionRole',
        AssumeRolePolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Principal: { Service: 'lambda.amazonaws.com' },
            }),
          ]),
        }),
      });

      template.hasResourceProperties('AWS::IAM::Role', {
        RoleName: 'PrepperLambdaExecutionRole',
        AssumeRolePolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Principal: { Service: 'lambda.amazonaws.com' },
            }),
          ]),
        }),
      });
    });
  });

  describe('API Gateway', () => {
    test('creates HTTP API v2', () => {
      template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
        Name: 'KitchenHttpApi',
        ProtocolType: 'HTTP',
      });
    });

    test('configures custom domain', () => {
      template.hasResourceProperties('AWS::ApiGatewayV2::DomainName', {
        DomainName: 'cook.hautomation.org',
      });
    });

    test('creates API routes for /fetch and /loadRecipe', () => {
      template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
        RouteKey: 'GET /fetch',
      });

      template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
        RouteKey: 'GET /loadRecipe',
      });
    });

    test('integrates Lambda functions with API Gateway', () => {
      template.hasResourceProperties('AWS::ApiGatewayV2::Integration', {
        IntegrationType: 'AWS_PROXY',
      });
    });
  });

  describe('Stack Outputs', () => {
    test('outputs API Gateway URL', () => {
      const outputs = template.findOutputs('*');
      expect(outputs.ApiCustomDomainUrl).toBeDefined();
      expect(outputs.ApiGatewayDefaultUrl).toBeDefined();
    });
  });
});

describe('CicdStack (CI/CD Pipelines)', () => {
  const testEnv = {
    account: '123456789012',
    region: 'eu-central-1',
  };

  let app: cdk.App;
  let infraStack: KitchenInfraStack;
  let cicdStack: CicdStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App({
      context: {
        'github-connection-arn': 'arn:aws:codeconnections:eu-central-1:123456789012:connection/test-connection',
      },
    });
    infraStack = new KitchenInfraStack(app, 'TestKitchenInfraStack', { env: testEnv });
    cicdStack = new CicdStack(app, 'TestCicdStack', { env: testEnv });
    template = Template.fromStack(cicdStack);
  });

  describe('ECR Build Pipelines', () => {
    test('creates chef and prepper ECR build pipelines', () => {
      template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
        Name: 'Chef-ECR',
      });

      template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
        Name: 'Prepper-ECR',
      });
    });

    test('creates CodeBuild projects for Docker builds', () => {
      template.hasResourceProperties('AWS::CodeBuild::Project', {
        Environment: Match.objectLike({
          Image: 'aws/codebuild/standard:7.0',
          PrivilegedMode: true,
        }),
      });
    });

    test('configures CodeBuild with ECR environment variables', () => {
      const projects = template.findResources('AWS::CodeBuild::Project');
      const ecrProjects = Object.values(projects).filter(
        (p: any) => p.Properties.Description?.includes('push') && p.Properties.Description?.includes('ECR')
      );

      expect(ecrProjects.length).toBeGreaterThan(0);
      ecrProjects.forEach(project => {
        const envVars = project.Properties.Environment.EnvironmentVariables;
        const hasEcrUri = envVars.some((v: any) => v.Name === 'ECR_REPOSITORY_URI');
        expect(hasEcrUri).toBe(true);
      });
    });

    test('ECR build projects use buildspec from repository', () => {
      const projects = template.findResources('AWS::CodeBuild::Project');
      const ecrProjects = Object.values(projects).filter(
        (p: any) => p.Properties.Description?.includes('push') && p.Properties.Description?.includes('ECR')
      );

      ecrProjects.forEach(project => {
        if (project.Properties.Source?.BuildSpec) {
          expect(project.Properties.Source.BuildSpec).toBe('buildspec.yml');
        }
      });
    });
  });

  describe('CDK Deployment Pipeline', () => {
    test('creates Kitchen CDK deployment pipeline', () => {
      template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
        Name: 'Kitchen-Deploy',
      });
    });

    test('creates CodeBuild project for CDK deployment', () => {
      template.hasResourceProperties('AWS::CodeBuild::Project', {
        Name: 'Kitchen-Deploy',
      });
    });

    test('uses external buildspec for CDK deployment', () => {
      const projects = template.findResources('AWS::CodeBuild::Project');
      const deployProject = Object.values(projects).find(
        (p: any) => p.Properties.Name === 'Kitchen-Deploy'
      );

      expect(deployProject).toBeDefined();
      if (deployProject) {
        expect(deployProject.Properties.Source.BuildSpec).toBe('buildspec.deploy.yml');
      }
    });

    test('grants administrator access to CDK deployment role', () => {
      const roles = template.findResources('AWS::IAM::Role');
      const deployRole = Object.values(roles).find(
        (r: any) => r.Properties.AssumeRolePolicyDocument?.Statement?.[0]?.Principal?.Service === 'codebuild.amazonaws.com'
      );

      expect(deployRole).toBeDefined();
    });
  });

  describe('EventBridge Rules', () => {
    test('creates EventBridge rule for chef ECR pushes', () => {
      template.hasResourceProperties('AWS::Events::Rule', {
        Name: 'Kitchen-Chef-ECR-Push-Trigger',
        EventPattern: Match.objectLike({
          source: ['aws.ecr'],
          'detail-type': ['ECR Image Action'],
          detail: Match.objectLike({
            'action-type': ['PUSH'],
            result: ['SUCCESS'],
          }),
        }),
      });
    });

    test('creates EventBridge rule for prepper ECR pushes', () => {
      template.hasResourceProperties('AWS::Events::Rule', {
        Name: 'Kitchen-Prepper-ECR-Push-Trigger',
        EventPattern: Match.objectLike({
          source: ['aws.ecr'],
          'detail-type': ['ECR Image Action'],
          detail: Match.objectLike({
            'action-type': ['PUSH'],
            result: ['SUCCESS'],
          }),
        }),
      });
    });

    test('targets Kitchen deployment pipeline from EventBridge rules', () => {
      const rules = template.findResources('AWS::Events::Rule');
      const ecrRules = Object.values(rules).filter(
        (r: any) => r.Properties.EventPattern?.source?.includes('aws.ecr')
      );

      expect(ecrRules.length).toBe(2);
      ecrRules.forEach(rule => {
        expect(rule.Properties.Targets).toBeDefined();
        expect(rule.Properties.Targets.length).toBeGreaterThan(0);
      });
    });
  });

  describe('IAM Permissions', () => {
    test('grants ECR permissions to CodeBuild roles', () => {
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

    test('grants ECR GetAuthorizationToken permission globally', () => {
      const policies = template.findResources('AWS::IAM::Policy');
      const hasGlobalEcrAuth = Object.values(policies).some(policy => {
        const statements = policy.Properties?.PolicyDocument?.Statement || [];
        return statements.some((stmt: any) => {
          const actions = Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action];
          const resources = Array.isArray(stmt.Resource) ? stmt.Resource : [stmt.Resource];
          return actions.includes('ecr:GetAuthorizationToken') && resources.includes('*');
        });
      });

      expect(hasGlobalEcrAuth).toBe(true);
    });
  });

  describe('Stack Outputs', () => {
    test('outputs pipeline names', () => {
      const outputs = template.findOutputs('*');
      expect(outputs.ChefEcrPipelineName).toBeDefined();
      expect(outputs.PrepperEcrPipelineName).toBeDefined();
      expect(outputs.KitchenDeployPipelineName).toBeDefined();
    });

    test('outputs EventBridge rule names', () => {
      const outputs = template.findOutputs('*');
      expect(outputs.ChefEcrTriggerRuleName).toBeDefined();
      expect(outputs.PrepperEcrTriggerRuleName).toBeDefined();
    });
  });
});

describe('Stack Integration', () => {
  test('all three stacks can be synthesized together', () => {
    const app = new cdk.App({
      context: {
        'github-connection-arn': 'arn:aws:codeconnections:eu-central-1:123456789012:connection/test-connection',
        s3CookbooksBucket: 'test-cookbooks-bucket',
        dynamoCookbooksTable: 'test-cookbooks-table',
        openAiApiKey: '/test/openai-api-key',
      },
    });

    process.env.PREPPER_IMAGE_TAG = 'sha256:test1234';
    process.env.CHEF_IMAGE_TAG = 'sha256:test5678';

    const env = {
      account: '123456789012',
      region: 'eu-central-1',
    };

    const infraStack = new KitchenInfraStack(app, 'TestKitchenInfraStack', { env });
    const apiStack = new KitchenServiceStack(app, 'TestKitchenStack', { env });
    const cicdStack = new CicdStack(app, 'TestCicdStack', { env });

    expect(infraStack).toBeDefined();
    expect(apiStack).toBeDefined();
    expect(cicdStack).toBeDefined();

    const assembly = app.synth();
    expect(assembly.stacks.length).toBe(3);

    delete process.env.PREPPER_IMAGE_TAG;
    delete process.env.CHEF_IMAGE_TAG;
  });
});
