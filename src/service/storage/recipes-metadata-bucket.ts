import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface RecipesMetadataBucketProps {
	readonly removalPolicy?: cdk.RemovalPolicy;
}

export class RecipesMetadataBucket extends Construct {
	public readonly bucket: s3.Bucket;

	constructor(scope: Construct, id: string, props?: RecipesMetadataBucketProps) {
		super(scope, id);

		this.bucket = new s3.Bucket(this, 'Bucket', {
			bucketName: 'recipes-metadata',
			blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
			versioned: false,
			encryption: s3.BucketEncryption.S3_MANAGED,
			removalPolicy: props?.removalPolicy || cdk.RemovalPolicy.RETAIN,
			autoDeleteObjects: false,
		});
	}
}
