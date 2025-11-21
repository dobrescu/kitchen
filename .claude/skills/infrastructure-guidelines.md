---
name: infrastructure-guidelines
description: AWS infrastructure patterns for Kitchen - Lambda (container), API Gateway, ECR, IAM. Use when working with Lambda functions, API routes, ECR repositories, or IAM permissions.
---

# Infrastructure Guidelines

## When this skill should be used

Auto-activates when Claude is:

- Creating or modifying Lambda functions
- Working with API Gateway routes or custom domains
- Setting up ECR repositories
- Configuring IAM roles or policies
- Loading Docker image references

Behavioral rules:

- Container-based Lambdas (not zip files)
- Use image digests for immutable deployments
- HTTP API v2 (not REST API) for cost efficiency
- Least-privilege IAM policies
- Shared utilities in `src/shared/`

---

## Container Lambda pattern

**Chef Lambda** (512MB): `src/service/lambdas/chef-lambda.ts`
**Prepper Lambda** (4096MB): `src/service/lambdas/prepper-lambda.ts`

```typescript
const repo = ecr.Repository.fromRepositoryAttributes(this, 'Repo', {
  repositoryArn: props.repositoryArn,
  repositoryName: props.repositoryName
});

this.function = new lambda.DockerImageFunction(this, 'Function', {
  functionName: 'chef',
  code: lambda.DockerImageCode.fromEcr(repo, {
    tagOrDigest: loadImageReference('chef')  // SHA256 digest, not tag
  }),
  memorySize: 512,
  timeout: cdk.Duration.seconds(30),
  environment: { KEY: 'value' }
});
```

**Image loading** (`src/shared/image-reference-loader.ts`):
1. Reads `image-manifest.json` (SHA256 digests)
2. Fallback to `CHEF_IMAGE_TAG` env var
3. Final fallback: `latest`

**Why:** Immutable deployments prevent unexpected Lambda updates.

---

## API Gateway HTTP API v2

**File:** `src/service/kitchen-api.ts`

```typescript
this.api = new apigwv2.HttpApi(this, 'HttpApi', {
  apiName: 'kitchen-api',
  corsPreflight: {
    allowOrigins: ['*'],
    allowMethods: [apigwv2.CorsHttpMethod.GET, apigwv2.CorsHttpMethod.POST]
  },
  defaultDomainMapping: { domainName }
});
```

**Add routes:**
```typescript
api.addRoute('/fetch', apigwv2.HttpMethod.GET,
  new HttpLambdaIntegration('PrepperIntegration', prepperLambda.function)
);
```

**Why HTTP API v2:** 70% cheaper than REST API, built-in CORS.

---

## ECR repositories

**File:** `src/infra/ecr-repositories.ts`

```typescript
this.chef = new ecr.Repository(this, 'ChefRepository', {
  repositoryName: 'chef',
  imageScanOnPush: false,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  lifecycleRules: [
    { description: 'Keep max 10 images', maxImageCount: 10 },
    { description: 'Delete untagged after 1 day', tagStatus: ecr.TagStatus.UNTAGGED, maxImageAge: cdk.Duration.days(1) }
  ]
});
```

---

## IAM roles

**Shared utility:** `src/shared/lambda-role.ts`

```typescript
export const createLambdaExecutionRole = (scope: Construct, id: string, roleName: string): iam.Role => {
  return new iam.Role(scope, id, {
    roleName,
    assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    managedPolicies: [
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
    ]
  });
};
```

**Grant permissions:**
```typescript
lambdaRole.addToPolicy(new iam.PolicyStatement({
  actions: ['dynamodb:GetItem', 'dynamodb:PutItem'],
  resources: [`arn:aws:dynamodb:${region}:${account}:table/${tableName}`]
}));
```

**Least-privilege:** Specific actions only, scoped resource ARNs.

---

## Custom domain

**File:** `src/service/kitchen-api.ts`

```typescript
const hostedZone = route53.HostedZone.fromLookup(this, 'Zone', {
  domainName: 'hautomation.org'
});

const certificate = new acm.Certificate(this, 'Cert', {
  domainName: 'cook.hautomation.org',
  validation: acm.CertificateValidation.fromDns(hostedZone)
});

const domainName = new apigwv2.DomainName(this, 'DomainName', {
  domainName: 'cook.hautomation.org',
  certificate
});
```

---

Related skills: `cdk-development-guidelines`, `cicd-guidelines`, `testing-guidelines`

Last updated: 2025-11-21
