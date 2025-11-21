import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface RecipeMetadataBucketProps {
	readonly removalPolicy?: cdk.RemovalPolicy;
}

export class RecipeMetadataBucket extends Construct {
	public readonly bucket: s3.Bucket;

	constructor(scope: Construct, id: string, props?: RecipeMetadataBucketProps) {
		super(scope, id);

		this.bucket = new s3.Bucket(this, 'Bucket', {
			bucketName: 'recipe-metadata',
			blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
			versioned: false,
			encryption: s3.BucketEncryption.S3_MANAGED,
			removalPolicy: props?.removalPolicy || cdk.RemovalPolicy.RETAIN,
			autoDeleteObjects: false,
		});
	}
}
