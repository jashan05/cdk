import * as cdk from 'aws-cdk-lib';
import * as as from 'aws-cdk-lib/aws-autoscaling';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cw from 'aws-cdk-lib/aws-cloudwatch';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elb from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Asset } from 'aws-cdk-lib/aws-s3-assets';
import * as path from 'path';
import { Construct } from 'constructs';

interface AsgProps {
  team: string;
  stage: string;
  vpc: ec2.IVpc;
  privateSg: ec2.ISecurityGroup;
  publicSg: ec2.ISecurityGroup;
  ami: ec2.IMachineImage;
  instanceSize: ec2.InstanceType;
  cert: acm.ICertificate;
  elb: elb.IApplicationLoadBalancer;
  topic: sns.ITopic;
  healthPort: number;
}

/**
 * Construct of the Auto Scaling Group
 * 
 * This construct consist of an autoscaling group, with an IAM role attached, 
 * and will register itself to a domain (see `domain.ts`).
 *
 * @property {asg.AutoScalingGroup} asg the actual autoscaling group object
 * @property {cw.Alarm} alarm the alarm when the instance gets unhealthy
 */
export class AsgConstruct extends Construct {
  public asg: as.AutoScalingGroup;
  public alarm: cw.Alarm;

  constructor(scope: cdk.Stack, id: string, props: AsgProps) {
    super(scope, id)

    /**
     *  Role for Auto Scaling Group Instances
     */
     const sonarInstanceRole = new iam.Role(this, 'SonarQubeInstanceRole', {
        roleName: `${props?.team}-${props?.stage}-sonarqube-instance-role`,
        assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
        managedPolicies: [
            iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonRDSFullAccess"),
            iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonEC2RoleforSSM"),
            iam.ManagedPolicy.fromAwsManagedPolicyName("CloudWatchAgentServerPolicy")
        ],
        inlinePolicies: {
            extraPolicies: new iam.PolicyDocument({
                statements: [
                    new iam.PolicyStatement({
                        actions: ["sts:AssumeRole"],
                        resources: [`arn:aws:iam::${scope.account}:role/*`]
                    }),
                    new iam.PolicyStatement({
                        actions: ['s3:*'],
                        resources: ['*']
                    }),
                    // Policy to complete lifecycle hooks, when a new instance launches
                    new iam.PolicyStatement({
                        actions: [
                            'autoscaling:CompleteLifecycleAction',
                            'autoscaling:PutLifecycleHook',
                            'autoscaling:DeleteLifecycleHook',
                            'autoscaling:RecordLifecycleActionHeartbeat',
                            'autoscaling:DescribeLifecycleHooks',
                            'autoscaling:DescribeLifecycleHookTypes'
                        ],
                        resources: ['*']
                    }),
                ]
            })
        }
    });
    // Need to override the logical Id's so that changes in IAC dont impact
    //START-NO-SONAR-SCAN
    let cfnsonarInstanceRole = sonarInstanceRole.node.defaultChild as iam.CfnRole
    cfnsonarInstanceRole.overrideLogicalId('SonarQubeInstanceRoleEF3A6617')
    //END-NO-SONAR-SCAN
    /**
     *  Auto Scaling Group
     */
     this.asg = new as.AutoScalingGroup(this, "sonar-asg", {
        autoScalingGroupName: `${props?.team}-${props?.stage}-sonar-asg`,
        healthCheck: {
            type: "ELB",
        },
        vpc: props.vpc,
        role: sonarInstanceRole,
        instanceType: props.instanceSize,
        groupMetrics: [new as.GroupMetrics(as.GroupMetric.TERMINATING_INSTANCES)],
        machineImage: props.ami,
        securityGroup: props.privateSg,
        keyName: props?.stage == 'acc' ? 'Acceptance' : 'Production',
        updatePolicy: as.UpdatePolicy.rollingUpdate(),
        minCapacity: 1,
        maxCapacity: 1,
        blockDevices: [{
            deviceName: '/dev/sda1',
            volume: as.BlockDeviceVolume.ebs(props?.stage == 'acc' ? 100 : 200, {
                deleteOnTermination: true,
                encrypted: true,
                iops: 400,
                volumeType: as.EbsDeviceVolumeType.IO1
            })
        }]
    });
    // Need to override the logical Id's so that changes in IAC dont impact resources
    //START-NO-SONAR-SCAN
    let cfnAsg = this.asg.node.defaultChild as as.CfnAutoScalingGroup
    cfnAsg.overrideLogicalId('sonarasgASG3BE76055')
    //END-NO-SONAR-SCAN
    this.asg.addSecurityGroup(props.publicSg);
    const lifecycleHook =  new as.LifecycleHook(this, 'SQLifecycleHook', {
        autoScalingGroup: this.asg,
        lifecycleHookName: `${props?.team}-${props?.stage}-sonar-asg-launching-lifecycle-hook`,
        lifecycleTransition: as.LifecycleTransition.INSTANCE_LAUNCHING,
        heartbeatTimeout: cdk.Duration.minutes(10),
        defaultResult: as.DefaultResult.CONTINUE
    })
    // Need to override the logical Id's so that changes in IAC dont impact resources
    //START-NO-SONAR-SCAN
    let cfnlifecycleHook = lifecycleHook.node.defaultChild as as.CfnLifecycleHook
    cfnlifecycleHook.overrideLogicalId('sonarasgLifecycleHookSQLifecycleHook51D26106')
    //END-NO-SONAR-SCAN

     /**
         * Define start up script for autoscaling group
         */
      const sonarAsset = new Asset(this, 'SonarAssets', { path: path.join(__dirname, '../assets') });
      this.asg.addUserData(
          // Initialization
          `TOKEN=$(curl -X PUT 'http://169.254.169.254/latest/api/token' -H 'X-aws-ec2-metadata-token-ttl-seconds: 216')`,
          'INSTANCE_ID=$(curl -H X-aws-ec2-metadata-token: $TOKEN -v http://169.254.169.254/latest/meta-data/instance-id)',
          'exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1',
          `SONAR_ARTIFACT_DIR='/opt/sonarqube-artifacts'`,
          `mkdir -p $SONAR_ARTIFACT_DIR && cd $SONAR_ARTIFACT_DIR`,
          // Download asset files from S3 bucket to machine
          `$(which aws) s3 cp ${sonarAsset.s3ObjectUrl} .`,
          `unzip $(echo ${sonarAsset.s3ObjectKey} | cut -d'/' -f2)`,
          // Add cloudwatch agent
          `wget https://s3.amazonaws.com/amazoncloudwatch-agent/redhat/amd64/latest/amazon-cloudwatch-agent.rpm`,
          'rpm -U ./amazon-cloudwatch-agent.rpm',
          '/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c file:$SONAR_ARTIFACT_DIR/amazon-cloudwatch-agent.json',
          // Install SonarQube
          'chmod -R o+rwx $SONAR_ARTIFACT_DIR && chmod +x ./sonar-deploy.sh',
          `./sonar-deploy.sh $SONAR_ARTIFACT_DIR`,
          // sending the signal to ASG that lifecycle hook is complete, go ahead and attach this instance to ELB
          'echo "Completing the ASG lifecycle action... "',
          `$(which aws) autoscaling complete-lifecycle-action \
              --region ${scope.region} \
              --instance-id $INSTANCE_ID \
              --lifecycle-hook-name ${props?.team}-${props?.stage}-sonar-asg-launching-lifecycle-hook \
              --auto-scaling-group-name ${props?.team}-${props?.stage}-sonar-asg \
              --lifecycle-action-result CONTINUE`,
          'echo "ASG notified successfully"'
      );

    /**
     *  Load Balancer Listener
     */
    const listener = props.elb.addListener('Listener', {
      protocol: elb.ApplicationProtocol.HTTPS,
      certificates: [props.cert]
    });
     // Need to override the logical Id's so that changes in IAC dont impact resources
     //START-NO-SONAR-SCAN
     let cfnListener = listener.node.defaultChild as elb.CfnListener
     cfnListener.overrideLogicalId('SonarLBListenerACED084C')
    //END-NO-SONAR-SCAN

    const targetGroup = listener.addTargets('Target', {
      targetGroupName: `${props.team}-${props.stage}-sonar-elb-target-group`,
      targets: [this.asg],
      port: props.healthPort,
      protocol: elb.ApplicationProtocol.HTTP,
      deregistrationDelay: cdk.Duration.seconds(30),
      healthCheck: {
        enabled: true,
        protocol: elb.Protocol.HTTP,
        path: '/',
        interval: cdk.Duration.minutes(1),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 2,
        timeout: cdk.Duration.seconds(10)
      }
    })
     // Need to override the logical Id's so that changes in IAC dont impact resources
     //START-NO-SONAR-SCAN
     let cfnTargetGroup = targetGroup.node.defaultChild as elb.CfnTargetGroup
     cfnTargetGroup.overrideLogicalId('SonarLBListenerTargetGroupC4941471')
     //END-NO-SONAR-SCAN
    /**
     *  Health alarm monitoring based on Load balancer
     */
    this.alarm = targetGroup.metricUnhealthyHostCount({
      period: cdk.Duration.minutes(1),

    }).createAlarm(this, 'UnhealthySonarAlarm', {
      threshold: 0,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      alarmName: `${props.team}-${props.stage}-sonar-unhealthy-elb-alarm`,
      treatMissingData: cw.TreatMissingData.MISSING,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });
    // Need to override the logical Id's so that changes in IAC dont impact resources
     //START-NO-SONAR-SCAN
     let cfnAlarm = this.alarm.node.defaultChild as cw.CfnAlarm
     cfnAlarm.overrideLogicalId('UnhealthySonarAlarm5A4B66B2')
     //END-NO-SONAR-SCAN
    this.alarm.addAlarmAction(new SnsAction(props.topic));

    /**
     * Alarm based on terminating instance in ASG
     */
    const instanceMetric = new cw.Metric({
        metricName: 'GroupTerminatingInstances',
        namespace: 'AWS/AutoScaling',
        statistic: 'Sum',
        period: cdk.Duration.minutes(1),
        dimensionsMap: {
            AutoScalingGroupName: this.asg.autoScalingGroupName,
        }
    })
    const terminatingInstanceAlarm = new cw.Alarm(this, 'terminatingInstanceAlarm', {
        metric: instanceMetric,
        threshold: 0,
        evaluationPeriods: 1,
        datapointsToAlarm: 1,
        alarmName: `${props.team}-${props.stage}-sonar-instance-terminating-alarm`,
        treatMissingData: cw.TreatMissingData.MISSING,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
    })

    terminatingInstanceAlarm.addAlarmAction(new SnsAction(props.topic));
  }
}