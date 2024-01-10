#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SonarqubeStack } from '../lib/index';

const app = new cdk.App();
if(process.env && process.env.STACK_NAME) {
    //START-NO-SONAR-SCAN
    new SonarqubeStack(app, process.env.STACK_NAME.toString(), {
    //END-NO-SONAR-SCAN
    synthesizer: new cdk.DefaultStackSynthesizer({
        fileAssetsBucketName: '${AWS::AccountId}-cdk-v2-cloud-blocks',
    }),
    // Input parameters
    team: <string>process.env.TEAM,
    stage: <string>process.env.ENV,
    amiName: <string>process.env.AMI,
    env: {
        account: process.env.ACCOUNT_ID?.toString(),
        region: process.env.AWS_REGION?.toString(),
    }   
}
)}