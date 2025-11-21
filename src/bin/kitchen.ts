#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { KitchenInfraStack } from '../infra/kitchen-infra-stack.js';
import { KitchenServiceStack } from '../service/kitchen-service-stack.js';
import { CicdStack } from '../cicd/cicd-stack.js';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

// Stack 1: Kitchen Infrastructure (ECR repositories)
// Deploy this first to create ECR repos
new KitchenInfraStack(app, 'kitchen-infra', {
  env,
  description: 'Kitchen ECR repositories and shared infrastructure',
});

// Stack 2: Kitchen API & Lambdas
// Depends on kitchen-infra (reads ECR info from SSM)
// Run 'yarn resolve-digests' before deploying
new KitchenServiceStack(app, 'kitchen', {
  env,
  description: 'Kitchen API Gateway and Lambda functions',
});

// Stack 3: CI/CD pipelines
// Depends on kitchen-infra (reads ECR info from SSM)
// Includes pipelines for: ECR image builds + CDK deployments
new CicdStack(app, 'kitchen-cicd', {
  env,
  description: 'Kitchen CI/CD pipelines for Docker builds and deployments',
});
