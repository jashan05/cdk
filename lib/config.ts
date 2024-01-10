import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as r53 from 'aws-cdk-lib/aws-route53';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

interface ConfigProps {
  team: string;
  stage: string;
  amiName: string;
}

/**
 *  Construct to lookup all existing resources and other data to use for creating stack
 * 
 *  @property {r53.IHostedZone} hostedZone the zone to which the stack should be made available
 *  @property {ec2.IVpc} vpc the VPC in which the stack should be created
 *  @property {ec2.ISecurityGroup} privateSg the Security Group to allow private access
 *  @property {ec2.ISecurityGroup} publicSg the Security Group to allow public egress
 *  @property {ec2.IMachineImage} ami the image based on which the instances should be created
 *  @property {ec2.InstanceType} ec2instanceSize the size of the EC2 instances to be created
 *  @property {sns.ITopic} topic the SNS topic to which the alarm should publish
 *  @property {number} healthPort the port number to which to perform health checks
 */
export class ConfigConstruct extends Construct {
  public hostedZone: r53.IHostedZone;
  public vpc: ec2.IVpc;
  public privateSg: ec2.ISecurityGroup;
  public publicSg: ec2.ISecurityGroup;
  public ami: ec2.IMachineImage;
  public ec2instanceSize: ec2.InstanceType;
  public topic: sns.ITopic;
  public healthPort: number;

  constructor(scope: Construct, id: string, props: ConfigProps) {
    super(scope, id)

    // Translated prod / acc to GTS environment names
    const awsStage = props.stage === 'acc' ? 'Non-Production' : 'Production';
    this.vpc = ec2.Vpc.fromLookup(this, 'Vpc', { isDefault: false });

    // Get hosted zone name based on environment name
    this.hostedZone = r53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: `swf${props.stage === 'acc' ? 'acc' : ''}.nl.aegon.io`
    });
    // SG's need to be mutable otherwise SG's will be overwritten by CDK
    let mutablePrivateSg = ec2.SecurityGroup.fromLookupByName(this, 'MutableInternalSg', `AGT-Create-VPC-${awsStage}-AGTSecurityGroup*`, this.vpc);
    let mutablePublicSg = ec2.SecurityGroup.fromLookupByName(this, 'MutablePublicSg', `AGT-Create-VPC-${awsStage}-AWSPublicSecurityGroup*`, this.vpc);
    // Security Group created by GTS for private network within Aegon NL (Cloud Accounts & On premises)
    this.privateSg =  ec2.SecurityGroup.fromSecurityGroupId(this, 'InternalSG', mutablePrivateSg.securityGroupId, {
        mutable: false
    });
    // Security Group created by GTS for public network access
    this.publicSg =  ec2.SecurityGroup.fromSecurityGroupId(this, 'PublicSG', mutablePublicSg.securityGroupId, {
        mutable: false
    });
    // Only lookup in GTS account id to find GTS hardened AMI
    this.ami = ec2.MachineImage.lookup({ name: props.amiName, owners: ['720898513446'] });

    this.ec2instanceSize = props.stage == 'acc' ?
      ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.LARGE) :
      ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.XLARGE2);

    // Get SNS Topic to be used to send alerts.
    this.topic = sns.Topic.fromTopicArn(this, 'Topic', cdk.Fn.importValue(`${props.team}-alert-topic-arn`));

    // Get port for health check in Auto scaling group, which is equal to port to SonarQube server
    this.healthPort = 9000;
  }
}
