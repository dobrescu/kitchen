import * as cdk from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface KitchenBuildEcrProps {
  readonly projectName: string;
  readonly description: string;
  readonly ecrRepositoryArn: string;
  readonly ecrRepositoryUri: string;
}

/**
 * CodeBuild project for building and pushing Docker images to ECR.
 * Designed to be used within a CodePipeline where source is provided by the pipeline.
 */
export class KitchenBuildEcr extends Construct {
  public readonly project: codebuild.PipelineProject;
  public readonly role: iam.Role;

  constructor(scope: Construct, id: string, props: KitchenBuildEcrProps) {
    super(scope, id);

    // IAM role with ECR permissions
    this.role = new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      description: `CodeBuild role for ${props.projectName}`,
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLogsFullAccess'),
      ],
    });

    // ECR authentication (global)
    this.role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      })
    );

    // ECR repository operations
    this.role.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'ecr:BatchCheckLayerAvailability',
          'ecr:GetDownloadUrlForLayer',
          'ecr:BatchGetImage',
          'ecr:PutImage',
          'ecr:InitiateLayerUpload',
          'ecr:UploadLayerPart',
          'ecr:CompleteLayerUpload',
        ],
        resources: [props.ecrRepositoryArn],
      })
    );

    // CodeBuild project
    this.project = new codebuild.PipelineProject(this, 'Project', {
      projectName: props.projectName,
      description: props.description,
      role: this.role,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
        privileged: true,
        environmentVariables: {
          ECR_REPOSITORY_URI: {
            value: props.ecrRepositoryUri,
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          },
          AWS_ACCOUNT_ID: {
            value: cdk.Stack.of(this).account,
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          },
          AWS_DEFAULT_REGION: {
            value: cdk.Stack.of(this).region,
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          },
          IMAGE_TAG: {
            value: process.env.CHEF_TAG || process.env.PREPPER_TAG || 'latest',
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          },
        },
      },
      buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yml'),
    });
  }
}
