import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { Construct } from 'constructs';

export interface FirebaseAuthorizerProps {
	readonly firebaseProjectId: string;
	readonly authorizerName?: string;
}

export class FirebaseAuthorizer extends Construct {
	public readonly authorizer: HttpJwtAuthorizer;

	constructor(scope: Construct, id: string, props: FirebaseAuthorizerProps) {
		super(scope, id);

		const issuer = `https://securetoken.google.com/${props.firebaseProjectId}`;

		this.authorizer = new HttpJwtAuthorizer(
			props.authorizerName || 'FirebaseJwtAuthorizer',
			issuer,
			{
				jwtAudience: [props.firebaseProjectId],
			}
		);
	}
}
