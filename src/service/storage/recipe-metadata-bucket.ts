import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface RecipeMetadataBucketProps {
	readonly removalPolicy?: cdk.RemovalPolicy;
}

/**
 * S3 bucket for storing recipe metadata (HTML fragments, raw scraped data, etc.)
 * Used by Chef Lambda for reading/writing recipe-related files.
 */
export class RecipeMetadataBucket extends Construct {
	public readonly bucket: s3.Bucket;

	constructor(scope: Construct, id: string, props?: RecipeMetadataBucketProps) {
		super(scope, id);

		this.bucket = new s3.Bucket(this, 'Bucket', {
			bucketName: 'recipe-metadata',
			// Private bucket - only Lambda access
			blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
			// No versioning (per requirements)
			versioned: false,
			// No lifecycle rules (per requirements)
			// Encryption at rest with AWS managed keys
			encryption: s3.BucketEncryption.S3_MANAGED,
			// RETAIN for production safety (can override for dev)
			removalPolicy: props?.removalPolicy || cdk.RemovalPolicy.RETAIN,
			// Don't auto-delete objects on stack deletion (safety)
			autoDeleteObjects: false,
		});
	}
}
