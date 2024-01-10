import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AsgConstruct } from './asg';
import { ConfigConstruct } from './config';
import { DomainConstruct } from './domain';
import { addTags } from '../bin/tags';

interface InfraProperties extends cdk.StackProps {
    team: string;
    stage: string;
    amiName: string;
}

/** Stack definition for creating an EC2 instance with SonarQube installed.
 *
 * @param {Construct} scope scope in which the stack will be created
 * @param {string} id the name of the stack to be created
 * @returns A new stack with EC2 instance.
 */
export class SonarqubeStack extends cdk.Stack {
    public asg: AsgConstruct;
    public config: ConfigConstruct;
    public domain: DomainConstruct;

    constructor(scope: Construct, id: string, p: InfraProperties) {
        super(scope, id, p)
        /**
         * Lookup existing resources 
         */
        this.config = new ConfigConstruct(this, 'config', {
            ...p
        });
        /**
         *  Create DNS domain and load balancer to connect to EC2 instance
         */
        this.domain = new DomainConstruct(this, "domain", {
            ...p,
            vpc: this.config.vpc,
            hostedZone: this.config.hostedZone,
            privateSg: this.config.privateSg,
            publicSg: this.config.publicSg
        });
        /**
         *  Create auto scaling group
         */
        this.asg = new AsgConstruct(this, 'autoscaling', {
            ...p,
            vpc: this.config.vpc,
            privateSg: this.config.privateSg,
            publicSg: this.config.publicSg,
            ami: this.config.ami,
            instanceSize: this.config.ec2instanceSize,
            cert: this.domain.cert,
            elb: this.domain.elb,
            topic: this.config.topic,
            healthPort: this.config.healthPort
        });

        /**
         * Apply tags to all the resources created as part of this stack
         */
        addTags(this);

        /**
         *  Output parameters
         */
        //START-NO-SONAR-SCAN
        new cdk.CfnOutput(this, 'SonarQubeURL', {
            value: this.domain.record.domainName,
            description: 'SonarQube Hosted URL',
            exportName: `${p.team}-${p.stage}-sonar-url`
        });
        new cdk.CfnOutput(this, 'SonarUnhealthyAlarmOutput', {
            value: this.asg.alarm.alarmName,
            description: 'SonarQube server unhealthy Alarm Name ',
            exportName: `${p.team}-${p.stage}-sonar-unhealthy-alarm`
        });
        //END-NO-SONAR-SCAN

    }
}