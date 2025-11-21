import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as events_targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';
import { KitchenImports } from '../infra/kitchen-imports.js';
import { KitchenEcrPipeline } from './pipeline/kitchen-ecr-pipeline.js';
import { KitchenDeployPipeline } from './pipeline/kitchen-deploy-pipeline.js';

export class CicdStack extends cdk.Stack {
  public readonly chefEcrPipeline: KitchenEcrPipeline;
  public readonly prepperEcrPipeline: KitchenEcrPipeline;
  public readonly kitchenDeployPipeline: KitchenDeployPipeline;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Import ECR repository info from Parameter Store
    const ecr = new KitchenImports(this, 'Imports');

    // Get GitHub connection ARN from context
    const connectionArn = this.node.tryGetContext('github-connection-arn');
    if (!connectionArn) {
      throw new Error(
        'GitHub connection ARN not found in cdk.context.json. ' +
        'Add "github-connection-arn" with your CodeConnections ARN.'
      );
    }

    // Chef ECR Pipeline (builds Docker images)
    this.chefEcrPipeline = new KitchenEcrPipeline(this, 'ChefEcrPipeline', {
      pipelineName: 'Chef-ECR',
      repositoryName: 'chef',
      repositoryOwner: 'dobrescu',
      branch: 'main',
      ecrRepositoryArn: ecr.chef.arn,
      ecrRepositoryUri: ecr.chef.uri,
      connectionArn,
    });

    // Prepper ECR Pipeline (builds Docker images)
    this.prepperEcrPipeline = new KitchenEcrPipeline(this, 'PrepperEcrPipeline', {
      pipelineName: 'Prepper-ECR',
      repositoryName: 'prepper',
      repositoryOwner: 'dobrescu',
      branch: 'main',
      ecrRepositoryArn: ecr.prepper.arn,
      ecrRepositoryUri: ecr.prepper.uri,
      connectionArn,
    });

    // Kitchen CDK Deployment Pipeline
    this.kitchenDeployPipeline = new KitchenDeployPipeline(this, 'KitchenDeployPipeline', {
      pipelineName: 'Kitchen-Deploy',
      repositoryName: 'kitchen',
      repositoryOwner: 'dobrescu',
      branch: 'main',
      connectionArn,
    });

    // EventBridge rules to trigger Kitchen deployment on ECR image pushes
    this.createEcrPushTriggers(ecr);

    // Outputs
    new cdk.CfnOutput(this, 'ChefEcrPipelineName', {
      value: this.chefEcrPipeline.pipeline.pipelineName,
      description: 'Chef ECR Build Pipeline Name',
    });

    new cdk.CfnOutput(this, 'PrepperEcrPipelineName', {
      value: this.prepperEcrPipeline.pipeline.pipelineName,
      description: 'Prepper ECR Build Pipeline Name',
    });

    new cdk.CfnOutput(this, 'KitchenDeployPipelineName', {
      value: this.kitchenDeployPipeline.pipeline.pipelineName,
      description: 'Kitchen CDK Deployment Pipeline Name',
    });
  }

  /**
   * Create EventBridge rules to trigger Kitchen deployment when ECR images are pushed
   */
  private createEcrPushTriggers(ecr: KitchenImports): void {
    // Rule for Chef ECR pushes
    const chefRule = new events.Rule(this, 'ChefEcrPushRule', {
      ruleName: 'Kitchen-Chef-ECR-Push-Trigger',
      description: 'Trigger Kitchen deployment when chef image is pushed to ECR',
      eventPattern: {
        source: ['aws.ecr'],
        detailType: ['ECR Image Action'],
        detail: {
          'action-type': ['PUSH'],
          'result': ['SUCCESS'],
          'repository-name': [ecr.chef.name],
        },
      },
    });

    // Rule for Prepper ECR pushes
    const prepperRule = new events.Rule(this, 'PrepperEcrPushRule', {
      ruleName: 'Kitchen-Prepper-ECR-Push-Trigger',
      description: 'Trigger Kitchen deployment when prepper image is pushed to ECR',
      eventPattern: {
        source: ['aws.ecr'],
        detailType: ['ECR Image Action'],
        detail: {
          'action-type': ['PUSH'],
          'result': ['SUCCESS'],
          'repository-name': [ecr.prepper.name],
        },
      },
    });

    // Add pipeline as target for both rules
    chefRule.addTarget(new events_targets.CodePipeline(this.kitchenDeployPipeline.pipeline));
    prepperRule.addTarget(new events_targets.CodePipeline(this.kitchenDeployPipeline.pipeline));

    // Outputs
    new cdk.CfnOutput(this, 'ChefEcrTriggerRuleName', {
      value: chefRule.ruleName,
      description: 'EventBridge rule for Chef ECR push triggers',
    });

    new cdk.CfnOutput(this, 'PrepperEcrTriggerRuleName', {
      value: prepperRule.ruleName,
      description: 'EventBridge rule for Prepper ECR push triggers',
    });
  }
}
