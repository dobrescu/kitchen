import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { loadImageReference } from '../../shared/image-reference-loader.js';
import { createLambdaExecutionRole } from '../../shared/lambda-role.js';

export interface PrepperLambdaProps {
  readonly repositoryArn: string;
  readonly repositoryName: string;
}

export class PrepperLambda extends Construct {
  public readonly function: lambda.DockerImageFunction;

  constructor(scope: Construct, id: string, props: PrepperLambdaProps) {
    super(scope, id);

    const lambdaRole = createLambdaExecutionRole(this, 'PrepperLambdaExecutionRole', 'PrepperLambdaExecutionRole');

    const prepperRepo = ecr.Repository.fromRepositoryAttributes(this, 'PrepperRepo', {
      repositoryArn: props.repositoryArn,
      repositoryName: props.repositoryName,
    });

    const prepperLogGroup = new logs.LogGroup(this, 'PrepperLogGroup', {
      logGroupName: `/aws/lambda/prepper`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.function = new lambda.DockerImageFunction(this, 'PrepperFunction', {
      functionName: 'prepper',
      code: lambda.DockerImageCode.fromEcr(prepperRepo, { tagOrDigest: loadImageReference('prepper') }),
      role: lambdaRole,
      memorySize: 4096,
      timeout: cdk.Duration.seconds(30),
      logGroup: prepperLogGroup,
    });
  }
}
