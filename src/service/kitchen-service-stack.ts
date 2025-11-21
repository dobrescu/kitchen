import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { KitchenImports } from '../infra/kitchen-imports.js';
import { ChefLambda } from './lambdas/chef-lambda.js';
import { PrepperLambda } from './lambdas/prepper-lambda.js';
import { KitchenApi } from './kitchen-api.js';
import { RecipeMetadataBucket } from './storage/recipe-metadata-bucket.js';
import { RecipesTable } from './storage/recipes-table.js';
import { FirebaseAuthorizer } from './auth/firebase-authorizer.js';

export class KitchenServiceStack extends cdk.Stack {
	constructor(scope: Construct, id: string, props?: cdk.StackProps) {
		super(scope, id, props);

		// Import ECR repository info from SSM Parameter Store (created by kitchen-infra stack)
		const ecr = new KitchenImports(this, 'Imports');

		// Get context values
		const domainName = this.node.tryGetContext('domainName') || 'cook.hautomation.org';
		const hostedZoneName = this.node.tryGetContext('hostedZoneName') || 'hautomation.org';
		const firebaseProjectId = this.node.tryGetContext('firebaseProjectId');

		if (!firebaseProjectId) {
			throw new Error('Context variable "firebaseProjectId" is required (e.g., "kassi-242d1")');
		}

		// Storage resources for Chef Lambda
		const cookbooksBucket = new RecipeMetadataBucket(this, 'RecipeMetadataBucket');
		const cookbooksTable = new RecipesTable(this, 'RecipesTable');

		// Firebase JWT authorizer for authenticated routes
		const firebaseAuth = new FirebaseAuthorizer(this, 'FirebaseAuthorizer', {
			firebaseProjectId,
		});

		// Prepper Lambda
		const prepperLambda = new PrepperLambda(this, 'PrepperLambda', {
			repositoryArn: ecr.prepper.arn,
			repositoryName: ecr.prepper.name,
		});

		// Chef Lambda (needs PREPPER_URL which will be set to custom domain)
		const chefLambda = new ChefLambda(this, 'ChefLambda', {
			repositoryArn: ecr.chef.arn,
			repositoryName: ecr.chef.name,
			cookbooksBucket: cookbooksBucket.bucket,
			cookbooksTable: cookbooksTable.table,
			prepperUrl: `https://${domainName}`,
		});

		// API Gateway with Route53 and Firebase authentication
		const api = new KitchenApi(this, 'Api', {
			prepperFunction: prepperLambda.function,
			chefFunction: chefLambda.function,
			domainName,
			hostedZoneName,
			firebaseAuthorizer: firebaseAuth.authorizer,
		});

		// Outputs
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
