import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { loadImageReference } from '../../shared/image-reference-loader.js';
import { createLambdaExecutionRole } from '../../shared/lambda-role.js';

export interface ChefLambdaProps {
  readonly repositoryArn: string;
  readonly repositoryName: string;
  readonly s3CookbooksBucket: string;
  readonly dynamoCookbooksTable: string;
  readonly prepperUrl: string;
}

export class ChefLambda extends Construct {
  public readonly function: lambda.DockerImageFunction;

  constructor(scope: Construct, id: string, props: ChefLambdaProps) {
    super(scope, id);

    const lambdaRole = createLambdaExecutionRole(this, 'ChefLambdaExecutionRole', 'ChefLambdaExecutionRole');

    const chefRepo = ecr.Repository.fromRepositoryAttributes(this, 'ChefRepo', {
      repositoryArn: props.repositoryArn,
      repositoryName: props.repositoryName,
    });

    // Get parameter name from context
    const openAiParamName = this.node.tryGetContext('openAiApiKey');
    if (!openAiParamName) {
      throw new Error('Context variable "openAiApiKey" is required');
    }

    // Resolve value from SSM Parameter Store at synth time
    const openAiValue = ssm.StringParameter.valueForStringParameter(this, openAiParamName);

    const chefLogGroup = new logs.LogGroup(this, 'ChefLogGroup', {
      logGroupName: `/aws/lambda/chef`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.function = new lambda.DockerImageFunction(this, 'ChefFunction', {
      functionName: 'chef',
      code: lambda.DockerImageCode.fromEcr(chefRepo, { tagOrDigest: loadImageReference('chef') }),
      role: lambdaRole,
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      logGroup: chefLogGroup,
      environment: {
        OPENAI_API_KEY: openAiValue,
        S3_COOKBOOKS: props.s3CookbooksBucket,
        DYNAMODB_COOKBOOKS: props.dynamoCookbooksTable,
        PREPPER_URL: props.prepperUrl,
      },
    });

    // Grant DynamoDB CRUD permissions
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:Query',
        'dynamodb:Scan',
      ],
      resources: [
        `arn:aws:dynamodb:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:table/${props.dynamoCookbooksTable}`,
      ],
    }));

    // Grant S3 CRUD permissions
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject',
        's3:ListBucket',
      ],
      resources: [
        `arn:aws:s3:::${props.s3CookbooksBucket}`,
        `arn:aws:s3:::${props.s3CookbooksBucket}/*`,
      ],
    }));
  }
}
