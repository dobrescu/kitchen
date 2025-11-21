import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

/**
 * Create a standard Lambda execution role with basic permissions
 *
 * @param scope - CDK construct scope
 * @param id - Construct ID
 * @param roleName - Physical name for the IAM role
 * @returns IAM role for Lambda execution
 */
export function createLambdaExecutionRole(
  scope: Construct,
  id: string,
  roleName: string
): iam.Role {
  return new iam.Role(scope, id, {
    roleName,
    assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    managedPolicies: [
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
    ],
  });
}
