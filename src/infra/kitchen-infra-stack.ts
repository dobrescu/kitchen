import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EcrRepositories } from './ecr-repositories.js';
import { KitchenExports } from './kitchen-exports.js';

export class KitchenInfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ECR Repositories
    const ecrRepos = new EcrRepositories(this, 'EcrRepositories', {
      maxImageCount: 10,
      untaggedImageExpirationDays: 1,
    });

    // Export ECR repository info to SSM Parameter Store for consumption by:
    // - kitchen-cicd stack (CI/CD pipelines need repo URIs)
    // - External build processes
    new KitchenExports(this, 'Exports', {
      chef: ecrRepos.chef,
      prepper: ecrRepos.prepper,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ChefRepositoryUri', {
      value: ecrRepos.chef.repositoryUri,
      description: 'Chef ECR Repository URI',
    });

    new cdk.CfnOutput(this, 'PrepperRepositoryUri', {
      value: ecrRepos.prepper.repositoryUri,
      description: 'Prepper ECR Repository URI',
    });

    new cdk.CfnOutput(this, 'ChefRepositoryName', {
      value: ecrRepos.chef.repositoryName,
      description: 'Chef ECR Repository Name',
    });

    new cdk.CfnOutput(this, 'PrepperRepositoryName', {
      value: ecrRepos.prepper.repositoryName,
      description: 'Prepper ECR Repository Name',
    });
  }
}
