import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { loadImageReference } from '../../shared/image-reference-loader.js';
import { createLambdaExecutionRole } from '../../shared/lambda-role.js';

export interface ChefLambdaProps {
	readonly repositoryArn: string;
	readonly repositoryName: string;
	readonly cookbooksBucket: s3.IBucket;
	readonly cookbooksTable: dynamodb.ITable;
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
        S3_COOKBOOKS: props.cookbooksBucket.bucketName,
        DYNAMODB_COOKBOOKS: props.cookbooksTable.tableName,
        PREPPER_URL: props.prepperUrl,
      },
    });

    // Grant read/write access to S3 bucket and DynamoDB table
    // Uses CDK grants (more maintainable than manual IAM policies)
    props.cookbooksBucket.grantReadWrite(this.function);
    props.cookbooksTable.grantReadWriteData(this.function);
  }
}
