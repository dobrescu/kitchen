import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface RecipesTableProps {
	readonly removalPolicy?: cdk.RemovalPolicy;
}

export class RecipesTable extends Construct {
	public readonly table: dynamodb.Table;

	constructor(scope: Construct, id: string, props?: RecipesTableProps) {
		super(scope, id);

		this.table = new dynamodb.Table(this, 'Table', {
			tableName: 'recipes',
			partitionKey: {
				name: 'PK',
				type: dynamodb.AttributeType.STRING,
			},
			sortKey: {
				name: 'SK',
				type: dynamodb.AttributeType.STRING,
			},
			billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
			pointInTimeRecoverySpecification: {
				pointInTimeRecoveryEnabled: true,
			},
			encryption: dynamodb.TableEncryption.AWS_MANAGED,
			removalPolicy: props?.removalPolicy || cdk.RemovalPolicy.RETAIN,
		});
	}
}
