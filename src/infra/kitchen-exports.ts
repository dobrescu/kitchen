import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export interface KitchenExportsProps {
  chef: ecr.Repository;
  prepper: ecr.Repository;
}

/**
 * Exports Kitchen ECR repository information to SSM Parameter Store.
 * Enables other stacks to access ECR repository details without direct dependencies.
 */
export class KitchenExports extends Construct {
  private static readonly PARAM_PREFIX = '/kitchen/ecr';

  constructor(scope: Construct, id: string, props: KitchenExportsProps) {
    super(scope, id);

    // Export Chef ECR repository
    new ssm.StringParameter(this, 'ChefArn', {
      parameterName: `${KitchenExports.PARAM_PREFIX}/chef/arn`,
      stringValue: props.chef.repositoryArn,
      description: 'Chef ECR Repository ARN',
      tier: ssm.ParameterTier.STANDARD,
    });

    new ssm.StringParameter(this, 'ChefUri', {
      parameterName: `${KitchenExports.PARAM_PREFIX}/chef/uri`,
      stringValue: props.chef.repositoryUri,
      description: 'Chef ECR Repository URI',
      tier: ssm.ParameterTier.STANDARD,
    });

    new ssm.StringParameter(this, 'ChefName', {
      parameterName: `${KitchenExports.PARAM_PREFIX}/chef/name`,
      stringValue: props.chef.repositoryName,
      description: 'Chef ECR Repository Name',
      tier: ssm.ParameterTier.STANDARD,
    });

    // Export Prepper ECR repository
    new ssm.StringParameter(this, 'PrepperArn', {
      parameterName: `${KitchenExports.PARAM_PREFIX}/prepper/arn`,
      stringValue: props.prepper.repositoryArn,
      description: 'Prepper ECR Repository ARN',
      tier: ssm.ParameterTier.STANDARD,
    });

    new ssm.StringParameter(this, 'PrepperUri', {
      parameterName: `${KitchenExports.PARAM_PREFIX}/prepper/uri`,
      stringValue: props.prepper.repositoryUri,
      description: 'Prepper ECR Repository URI',
      tier: ssm.ParameterTier.STANDARD,
    });

    new ssm.StringParameter(this, 'PrepperName', {
      parameterName: `${KitchenExports.PARAM_PREFIX}/prepper/name`,
      stringValue: props.prepper.repositoryName,
      description: 'Prepper ECR Repository Name',
      tier: ssm.ParameterTier.STANDARD,
    });
  }
}
