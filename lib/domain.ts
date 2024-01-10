import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as elb from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as r53 from 'aws-cdk-lib/aws-route53';
import * as r53t from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';

interface DomainProps {
  team: string;
  stage: string;
  vpc: ec2.IVpc;
  hostedZone: r53.IHostedZone;
  privateSg: ec2.ISecurityGroup;
  publicSg: ec2.ISecurityGroup;
}

/**
 *  Construct of (DNS) Domain
 * 
 *  This construct creates a setup from a Route53 record (DNS) and links it to a load balancer,
 *  which can be used to attach for example an autoscaling group to it.
 * 
 *  @property {acm.DnsValidatedCertificate} cert the ACM validation object used in this domain
 *  @property {r53.RecordSet} record the Route53 record of the URL
 *  @property {elb.ApplicationLoadBalancer} elb the load balancer connected to the Route53 record
 *  @property {elb.ApplicationListener} elbListener the listener to the load balancer
 */
export class DomainConstruct extends Construct {
  public cert: acm.DnsValidatedCertificate;
  public record: r53.RecordSet;
  public elb: elb.ApplicationLoadBalancer;
  public elbListener: elb.ApplicationListener;

  constructor(scope: Construct, id: string, props: DomainProps) {
    super(scope, id)

    /**
     * Application Load Balancer
     */
    this.elb = new elb.ApplicationLoadBalancer(this, 'LoadBalancer', {
      vpc: props.vpc,
      internetFacing: false,
      securityGroup: props.privateSg,
      loadBalancerName: `${props.team}-${props.stage}-sonarqube-elb`
    });
     // Need to override the logical Id's so that changes in IAC dont impact resources
    //START-NO-SONAR-SCAN
    let cfnElb = this.elb.node.defaultChild as elb.CfnLoadBalancer
    cfnElb.overrideLogicalId('SonarLB82F7B879')
    this.elb.addSecurityGroup(props.publicSg);
    //END-NO-SONAR-SCAN
    /**
     *  Route53 Record Set
     */
    this.record = new r53.RecordSet(this, 'RecordSetA', {
      zone: props.hostedZone,
      recordType: r53.RecordType.A,
      recordName: 'sonar',
      target: r53.RecordTarget.fromAlias(new r53t.LoadBalancerTarget(this.elb))
    });
     // Need to override the logical Id's so that changes in IAC dont impact resources
    //START-NO-SONAR-SCAN
     let cfnRecord = this.record.node.defaultChild as r53.CfnRecordSet
     cfnRecord.overrideLogicalId('RecordSetA76BE73E4')
     //END-NO-SONAR-SCAN
    /**
     *  ACM Certificate
     */
    this.cert = new acm.DnsValidatedCertificate(this, 'Certificate', {
      domainName: `sonar.${props.hostedZone.zoneName}`,
      hostedZone: props.hostedZone
    });

  }
}
