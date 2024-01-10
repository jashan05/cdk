import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as Sonarqube from '../lib/index';
import * as tags from '../bin/tags'


describe("SonarQube Stack", () => {
    const app = new cdk.App();
    // Mocking Applying tags otherwise env variables needs to be set at run time
    const mock = jest.spyOn(tags, 'addTags');
    mock.mockImplementation(() => 'Mocked');

    const stack = new Sonarqube.SonarqubeStack(app, 'MyTestStack', {
        stage: 'test',
        team: 'test',
        amiName: 'test',
        env: {
            account: '123123',
            region: 'eu-west-1'
        }
    });


    const template = Template.fromStack(stack);
    test('IAM role and profile is created', () => {
        // Check for resources in Stack
        template.hasResource("AWS::IAM::Role", {});
        template.hasResource("AWS::IAM::InstanceProfile", {});
    });
    test('ELB is created', () => {
        // Check for resources in Stack
        template.hasResource("AWS::ElasticLoadBalancingV2::LoadBalancer", {});
        template.hasResource("AWS::ElasticLoadBalancingV2::Listener", {});
        template.hasResource("AWS::ElasticLoadBalancingV2::TargetGroup", {});

    });
    test('ASG is created', () => {
        // Check for resources in Stack
        template.hasResource("AWS::AutoScaling::AutoScalingGroup", {});
        template.hasResource("AWS::AutoScaling::LifecycleHook", {});
        template.hasResource("AWS::AutoScaling::LaunchConfiguration", {});
    });
    test('Cloudwatch Alarm is created', () => {
        // Check for resources in Stack
        template.hasResource("AWS::CloudWatch::Alarm", {});
    });
})
