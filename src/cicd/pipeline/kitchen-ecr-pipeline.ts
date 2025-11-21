import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import { Construct } from 'constructs';
import { KitchenBuildEcr } from '../codebuild/kitchen-build-ecr.js';

export interface KitchenEcrPipelineProps {
  readonly pipelineName: string;
  readonly repositoryName: string;
  readonly repositoryOwner: string;
  readonly branch: string;
  readonly ecrRepositoryArn: string;
  readonly ecrRepositoryUri: string;
  readonly connectionArn: string;
}

/**
 * CodePipeline for building and pushing Docker images to ECR.
 *
 * Pipeline stages:
 * 1. Source: GitHub repository (via CodeConnections)
 * 2. Build: Docker image build and push to ECR (using buildspec.yml from repo)
 */
export class KitchenEcrPipeline extends Construct {
  public readonly pipeline: codepipeline.Pipeline;
  public readonly build: KitchenBuildEcr;

  constructor(scope: Construct, id: string, props: KitchenEcrPipelineProps) {
    super(scope, id);

    // CodeBuild project
    this.build = new KitchenBuildEcr(this, 'Deploy', {
      projectName: `${props.pipelineName}-Deploy`,
      description: `Build and push ${props.repositoryName} Docker image to ECR`,
      ecrRepositoryArn: props.ecrRepositoryArn,
      ecrRepositoryUri: props.ecrRepositoryUri,
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

    // Build stage - CodeBuild
    this.pipeline.addStage({
      stageName: 'Build',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'Build',
          project: this.build.project,
          input: sourceOutput,
        }),
      ],
    });
  }
}
