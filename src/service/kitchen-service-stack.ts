import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { KitchenImports } from '../infra/kitchen-imports.js';
import { ChefLambda } from './lambdas/chef-lambda.js';
import { PrepperLambda } from './lambdas/prepper-lambda.js';
import { KitchenApi } from './kitchen-api.js';
import { RecipesMetadataBucket } from './storage/recipes-metadata-bucket.js';
import { RecipesTable } from './storage/recipes-table.js';
import { FirebaseAuthorizer } from './auth/firebase-authorizer.js';

export class KitchenServiceStack extends cdk.Stack {
	constructor(scope: Construct, id: string, props?: cdk.StackProps) {
		super(scope, id, props);

		const ecr = new KitchenImports(this, 'Imports');

		const domainName = this.node.tryGetContext('domainName') || 'cook.hautomation.org';
		const hostedZoneName = this.node.tryGetContext('hostedZoneName') || 'hautomation.org';
		const firebaseProjectId = this.node.tryGetContext('firebaseProjectId');

		if (!firebaseProjectId) {
			throw new Error('Context variable "firebaseProjectId" is required (e.g., "kassi-242d1")');
		}

		const cookbooksBucket = new RecipesMetadataBucket(this, 'RecipesMetadataBucket');
		const cookbooksTable = new RecipesTable(this, 'RecipesTable');

		const firebaseAuth = new FirebaseAuthorizer(this, 'FirebaseAuthorizer', {
			firebaseProjectId,
		});

		const prepperLambda = new PrepperLambda(this, 'PrepperLambda', {
			repositoryArn: ecr.prepper.arn,
			repositoryName: ecr.prepper.name,
		});

		const chefLambda = new ChefLambda(this, 'ChefLambda', {
			repositoryArn: ecr.chef.arn,
			repositoryName: ecr.chef.name,
			cookbooksBucket: cookbooksBucket.bucket,
			cookbooksTable: cookbooksTable.table,
			prepperUrl: `https://${domainName}`,
		});

		const api = new KitchenApi(this, 'Api', {
			prepperFunction: prepperLambda.function,
			chefFunction: chefLambda.function,
			domainName,
			hostedZoneName,
			firebaseAuthorizer: firebaseAuth.authorizer,
		});

		new cdk.CfnOutput(this, 'ApiCustomDomainUrl', {
			value: `https://${api.domain.name}`,
			description: 'Kitchen API custom domain URL',
		});

		new cdk.CfnOutput(this, 'ApiGatewayDefaultUrl', {
			value: api.api.url!,
			description: 'Kitchen API default AWS endpoint (useful before DNS propagation)',
		});
	}
}
