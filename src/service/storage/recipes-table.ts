import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface RecipesTableProps {
	readonly removalPolicy?: cdk.RemovalPolicy;
}

/**
 * DynamoDB table for recipe storage using single-table design.
 *
 * Key schema:
 * - PK (String): Partition key - "recipe#<urlHash>" or "user#<firebaseUID>"
 * - SK (String): Sort key - "base" or "recipe#<urlHash>"
 *
 * Access patterns:
 * 1. Shared recipe cache: PK=recipe#<hash>, SK=base
 * 2. User recipe records: PK=user#<uid>, SK=recipe#<hash>
 */
export class RecipesTable extends Construct {
	public readonly table: dynamodb.Table;

	constructor(scope: Construct, id: string, props?: RecipesTableProps) {
		super(scope, id);

		this.table = new dynamodb.Table(this, 'Table', {
			tableName: 'Recipes',
			// Primary key: PK (partition) + SK (sort)
			partitionKey: {
				name: 'PK',
				type: dynamodb.AttributeType.STRING,
			},
			sortKey: {
				name: 'SK',
				type: dynamodb.AttributeType.STRING,
			},
			// On-demand billing (cost-effective for variable workloads)
			billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
			// Point-in-time recovery for production safety
			pointInTimeRecoverySpecification: {
				pointInTimeRecoveryEnabled: true,
			},
			// Encryption at rest with AWS managed keys
			encryption: dynamodb.TableEncryption.AWS_MANAGED,
			// RETAIN for production safety (can override for dev)
			removalPolicy: props?.removalPolicy || cdk.RemovalPolicy.RETAIN,
		});
	}
}
