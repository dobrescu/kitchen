import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export interface EcrRepositoryInfo {
  readonly arn: string;
  readonly uri: string;
  readonly name: string;
}

/**
 * Imports Kitchen ECR repository information from SSM Parameter Store.
 * Reads parameters exported by KitchenExports construct.
 */
export class KitchenImports extends Construct {
  private static readonly PARAM_PREFIX = '/kitchen/ecr';

  public readonly chef: EcrRepositoryInfo;
  public readonly prepper: EcrRepositoryInfo;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Import Chef ECR repository info
    this.chef = {
      arn: ssm.StringParameter.valueForStringParameter(
        this,
        `${KitchenImports.PARAM_PREFIX}/chef/arn`
      ),
      uri: ssm.StringParameter.valueForStringParameter(
        this,
        `${KitchenImports.PARAM_PREFIX}/chef/uri`
      ),
      name: ssm.StringParameter.valueForStringParameter(
        this,
        `${KitchenImports.PARAM_PREFIX}/chef/name`
      ),
    };

    // Import Prepper ECR repository info
    this.prepper = {
      arn: ssm.StringParameter.valueForStringParameter(
        this,
        `${KitchenImports.PARAM_PREFIX}/prepper/arn`
      ),
      uri: ssm.StringParameter.valueForStringParameter(
        this,
        `${KitchenImports.PARAM_PREFIX}/prepper/uri`
      ),
      name: ssm.StringParameter.valueForStringParameter(
        this,
        `${KitchenImports.PARAM_PREFIX}/prepper/name`
      ),
    };
  }
}
