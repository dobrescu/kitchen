import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

export interface KitchenApiProps {
  readonly prepperFunction: lambda.Function;
  readonly chefFunction: lambda.Function;
  readonly domainName: string;
  readonly hostedZoneName: string;
}

export class KitchenApi extends Construct {
  public readonly api: apigwv2.HttpApi;
  public readonly domain: apigwv2.DomainName;

  constructor(scope: Construct, id: string, props: KitchenApiProps) {
    super(scope, id);

    // Lookup existing hosted zone
    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: props.hostedZoneName,
    });

    // Certificate for custom domain
    const certificate = new certificatemanager.Certificate(this, 'Certificate', {
      domainName: props.domainName,
      validation: certificatemanager.CertificateValidation.fromDns(hostedZone),
    });

    // HTTP API Gateway
    this.api = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: 'KitchenHttpApi',
      description: 'Kitchen API Gateway (HTTP API v2)',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // Lambda integrations
    const prepperIntegration = new integrations.HttpLambdaIntegration(
      'PrepperIntegration',
      props.prepperFunction
    );

    const chefIntegration = new integrations.HttpLambdaIntegration(
      'ChefIntegration',
      props.chefFunction
    );

    // API Routes
    this.api.addRoutes({
      path: '/fetch',
      methods: [apigwv2.HttpMethod.GET],
      integration: prepperIntegration,
    });

    this.api.addRoutes({
      path: '/loadRecipe',
      methods: [apigwv2.HttpMethod.GET],
      integration: chefIntegration,
    });

    // Custom domain
    this.domain = new apigwv2.DomainName(this, 'CustomDomain', {
      domainName: props.domainName,
      certificate,
    });

    // Map the API base path to the custom domain
    new apigwv2.ApiMapping(this, 'ApiMapping', {
      api: this.api,
      domainName: this.domain,
    });

    // Route53 alias record for the custom domain
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
