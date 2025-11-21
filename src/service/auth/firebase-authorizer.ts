import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { Construct } from 'constructs';

export interface FirebaseAuthorizerProps {
	/**
	 * Firebase project ID (from google-services.json)
	 * @example 'kassi-242d1'
	 */
	readonly firebaseProjectId: string;

	/**
	 * Optional name for the authorizer
	 * @default 'FirebaseJwtAuthorizer'
	 */
	readonly authorizerName?: string;
}

/**
 * JWT authorizer for Firebase Authentication integration with API Gateway HTTP API (v2).
 *
 * Validates Firebase JWTs at API Gateway level (before Lambda invocation).
 * Lambda can extract the validated user ID from event.requestContext.authorizer.jwt.claims.sub
 *
 * @example
 * ```typescript
 * const authorizer = new FirebaseAuthorizer(this, 'Authorizer', {
 *   firebaseProjectId: 'kassi-242d1'
 * });
 *
 * // Use with API Gateway routes
 * api.addRoutes({
 *   path: '/recipe/load',
 *   methods: [HttpMethod.POST],
 *   integration: chefIntegration,
 *   authorizer
 * });
 * ```
 */
export class FirebaseAuthorizer extends Construct {
	public readonly authorizer: HttpJwtAuthorizer;

	constructor(scope: Construct, id: string, props: FirebaseAuthorizerProps) {
		super(scope, id);

		// Firebase JWT issuer URL
		const issuer = `https://securetoken.google.com/${props.firebaseProjectId}`;

		// Create JWT authorizer
		this.authorizer = new HttpJwtAuthorizer(
			props.authorizerName || 'FirebaseJwtAuthorizer',
			issuer,
			{
				// Firebase uses project ID as the audience
				jwtAudience: [props.firebaseProjectId],
			}
		);
	}
}
