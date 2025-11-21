import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { KitchenImports } from '../infra/kitchen-imports.js';
import { ChefLambda } from './lambdas/chef-lambda.js';
import { PrepperLambda } from './lambdas/prepper-lambda.js';
import { KitchenApi } from './kitchen-api.js';

export class KitchenServiceStack extends cdk.Stack {
	constructor(scope: Construct, id: string, props?: cdk.StackProps) {
		super(scope, id, props);

		// Import ECR repository info from SSM Parameter Store (created by kitchen-infra stack)
		const ecr = new KitchenImports(this, 'Imports');

		// Get context values
		const s3CookbooksBucket = this.node.tryGetContext('s3CookbooksBucket');
		const dynamoCookbooksTable = this.node.tryGetContext('dynamoCookbooksTable');
		const domainName = this.node.tryGetContext('domainName') || 'cook.hautomation.org';
		const hostedZoneName = this.node.tryGetContext('hostedZoneName') || 'hautomation.org';

		if (!s3CookbooksBucket) {
			throw new Error('Context variable "s3CookbooksBucket" is required');
		}
		if (!dynamoCookbooksTable) {
			throw new Error('Context variable "dynamoCookbooksTable" is required');
		}

		// Prepper Lambda
		const prepperLambda = new PrepperLambda(this, 'PrepperLambda', {
			repositoryArn: ecr.prepper.arn,
			repositoryName: ecr.prepper.name,
		});

		// Chef Lambda (needs PREPPER_URL which will be set to custom domain)
		const chefLambda = new ChefLambda(this, 'ChefLambda', {
			repositoryArn: ecr.chef.arn,
			repositoryName: ecr.chef.name,
			s3CookbooksBucket,
			dynamoCookbooksTable,
			prepperUrl: `https://${domainName}`,
		});

		// API Gateway with Route53
		const api = new KitchenApi(this, 'Api', {
			prepperFunction: prepperLambda.function,
			chefFunction: chefLambda.function,
			domainName,
			hostedZoneName,
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
