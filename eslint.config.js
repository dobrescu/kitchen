import eslint from '@eslint/js';
import tsEslint from 'typescript-eslint';
import unusedImports from 'eslint-plugin-unused-imports';
import stylistic from '@stylistic/eslint-plugin-js';

export default tsEslint.config(
	eslint.configs.recommended,
	...tsEslint.configs.recommended,
	{
		languageOptions: {
			ecmaVersion: 6,
			sourceType: 'script',

			parserOptions: {
				project: ['tsconfig.json'],
				createDefaultProgram: true
			}
		}
	},
	{
		plugins: {
			'unused-imports': unusedImports,
			'@stylistic/js': stylistic
		}
	},
	{
		rules: {
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': ['warn'],
			'no-empty': 'off',
			'no-shadow': 'off',
			'unused-imports/no-unused-imports': 'error',
			'@typescript-eslint/ban-ts-comment': 'off',
			'@typescript-eslint/naming-convention': 'off',
			'@typescript-eslint/no-shadow': ['error'],
			'@typescript-eslint/no-non-null-assertion': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'eol-last': ['error', 'always'],
			'no-multiple-empty-lines': [2, { max: 2 }],
			'@stylistic/js/semi': ['error', 'always']
		}
	},
	{
		ignores: ['**/dist/', '**/test/', 'eslint.config.js', 'jest.config.cjs', '**/cdk.out/']
	}
);
