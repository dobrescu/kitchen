import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';

export interface EcrRepositoriesProps {
  readonly maxImageCount?: number;
  readonly untaggedImageExpirationDays?: number;
}

export class EcrRepositories extends Construct {
  public readonly chef: ecr.Repository;
  public readonly prepper: ecr.Repository;

  constructor(scope: Construct, id: string, props?: EcrRepositoriesProps) {
    super(scope, id);

    const maxImageCount = props?.maxImageCount ?? 10;
    const untaggedExpiration = props?.untaggedImageExpirationDays ?? 1;

    const lifecycleRules: ecr.LifecycleRule[] = [
      {
        description: `Keep only ${maxImageCount} images`,
        maxImageCount,
      },
      {
        description: `Delete untagged images after ${untaggedExpiration} day(s)`,
        tagStatus: ecr.TagStatus.UNTAGGED,
        maxImageAge: cdk.Duration.days(untaggedExpiration),
      },
    ];

    this.chef = new ecr.Repository(this, 'ChefRepository', {
      repositoryName: 'chef',
      imageScanOnPush: false,
      lifecycleRules,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.prepper = new ecr.Repository(this, 'PrepperRepository', {
      repositoryName: 'prepper',
      imageScanOnPush: false,
      lifecycleRules,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}
