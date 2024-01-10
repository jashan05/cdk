import { Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';

//https://git.us.aegon.com/AGT/getting-started-runbook/wiki/Tagging-resources
export function addTags(scope: Construct) {

  Tags.of(scope).add('Environment', <string>process.env.ENV);
  Tags.of(scope).add('Division', <string>process.env.CDK_TAG_DIVISION);
  Tags.of(scope).add('AGTManaged', <string>process.env.CDK_TAG_AGT_MANAGED);
  Tags.of(scope).add('ResourcePurpose', <string>process.env.STACK_NAME);
  Tags.of(scope).add('ResourceContact', <string>process.env.CDK_TAG_RESOURCE_CONTACT);
  Tags.of(scope).add('BillingCostCenter', <string>process.env.CDK_TAG_COST_CENTER);
  Tags.of(scope).add('Anl_HawkEye_Bcm', <string>process.env.CDK_TAG_HAWKEYE_BCM);
}