import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { Construct } from 'constructs';

export interface KitchenApiProps {
	readonly prepperFunction: lambda.Function;
	readonly chefFunction: lambda.Function;
	readonly domainName: string;
	readonly hostedZoneName: string;
	readonly firebaseAuthorizer: HttpJwtAuthorizer;
}

export class KitchenApi extends Construct {
  public readonly api: apigwv2.HttpApi;
  public readonly domain: apigwv2.DomainName;

  constructor(scope: Construct, id: string, props: KitchenApiProps) {
    super(scope, id);

    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: props.hostedZoneName,
    });

    const certificate = new certificatemanager.Certificate(this, 'Certificate', {
      domainName: props.domainName,
      validation: certificatemanager.CertificateValidation.fromDns(hostedZone),
    });

    this.api = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: 'KitchenHttpApi',
      description: 'Kitchen API Gateway (HTTP API v2) with Firebase JWT authentication',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const prepperIntegration = new integrations.HttpLambdaIntegration(
      'PrepperIntegration',
      props.prepperFunction
    );

    const chefIntegration = new integrations.HttpLambdaIntegration(
      'ChefIntegration',
      props.chefFunction
    );

    this.api.addRoutes({
      path: '/fetch',
      methods: [apigwv2.HttpMethod.GET],
      integration: prepperIntegration,
    });

    this.api.addRoutes({
      path: '/health',
      methods: [apigwv2.HttpMethod.GET],
      integration: chefIntegration,
    });

    this.api.addRoutes({
      path: '/recipe/load',
      methods: [apigwv2.HttpMethod.POST],
      integration: chefIntegration,
      authorizer: props.firebaseAuthorizer,
    });

    this.api.addRoutes({
      path: '/recipe/{urlHash}/improve',
      methods: [apigwv2.HttpMethod.POST],
      integration: chefIntegration,
      authorizer: props.firebaseAuthorizer,
    });

    this.api.addRoutes({
      path: '/recipe/{urlHash}',
      methods: [apigwv2.HttpMethod.GET],
      integration: chefIntegration,
      authorizer: props.firebaseAuthorizer,
    });

    this.api.addRoutes({
      path: '/recipe/{urlHash}',
      methods: [apigwv2.HttpMethod.PUT],
      integration: chefIntegration,
      authorizer: props.firebaseAuthorizer,
    });

    this.api.addRoutes({
      path: '/recipes',
      methods: [apigwv2.HttpMethod.GET],
      integration: chefIntegration,
      authorizer: props.firebaseAuthorizer,
    });

    this.api.addRoutes({
      path: '/recipe/{urlHash}',
      methods: [apigwv2.HttpMethod.DELETE],
      integration: chefIntegration,
      authorizer: props.firebaseAuthorizer,
    });

    this.domain = new apigwv2.DomainName(this, 'CustomDomain', {
      domainName: props.domainName,
      certificate,
    });

    new apigwv2.ApiMapping(this, 'ApiMapping', {
      api: this.api,
      domainName: this.domain,
    });

    new route53.ARecord(this, 'AliasRecord', {
      zone: hostedZone,
      recordName: props.domainName,
      target: route53.RecordTarget.fromAlias(
        new route53targets.ApiGatewayv2DomainProperties(
          this.domain.regionalDomainName,
          this.domain.regionalHostedZoneId
        )
      ),
    });
  }
}
