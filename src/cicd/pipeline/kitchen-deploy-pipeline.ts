import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface KitchenDeployPipelineProps {
  readonly pipelineName: string;
  readonly repositoryName: string;
  readonly repositoryOwner: string;
  readonly branch: string;
  readonly connectionArn: string;
}

/**
 * CodePipeline for deploying the Kitchen CDK stack.
 *
 * Pipeline stages:
 * 1. Source: GitHub repository (Kitchen CDK code)
 * 2. Deploy: Runs tests, resolves digests, and deploys kitchen stack
 *
 * Uses buildspec.deploy.yml which:
 * - Runs tests and validation
 * - Resolves ECR image digests
 * - Deploys the kitchen stack
 */
export class KitchenDeployPipeline extends Construct {
  public readonly pipeline: codepipeline.Pipeline;
  public readonly buildProject: codebuild.PipelineProject;

  constructor(scope: Construct, id: string, props: KitchenDeployPipelineProps) {
    super(scope, id);

    // CodeBuild role with CDK deployment permissions
    const buildRole = new iam.Role(this, 'BuildRole', {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'),
      ],
    });

    // CodeBuild project for CDK deployment
    this.buildProject = new codebuild.PipelineProject(this, 'BuildProject', {
      projectName: props.pipelineName,
      description: 'Deploy kitchen CDK stack with tests and validation',
      role: buildRole,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
      },
      buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.deploy.yml'),
    });

    // Pipeline
    this.pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: props.pipelineName,
      restartExecutionOnUpdate: true,
      pipelineType: codepipeline.PipelineType.V2,
    });

    // Source stage - GitHub via CodeConnections
    const sourceOutput = new codepipeline.Artifact('SourceArtifact');
    this.pipeline.addStage({
      stageName: 'Source',
      actions: [
        new codepipeline_actions.CodeStarConnectionsSourceAction({
          actionName: 'GitHub',
          owner: props.repositoryOwner,
          repo: props.repositoryName,
          branch: props.branch,
          output: sourceOutput,
          connectionArn: props.connectionArn,
        }),
      ],
    });

    // Deploy stage - CodeBuild
    this.pipeline.addStage({
      stageName: 'Deploy',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'CDK-Deploy',
          project: this.buildProject,
          input: sourceOutput,
        }),
      ],
    });
  }
}
