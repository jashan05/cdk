#!/bin/bash

set -e

echo -e "\n************** Setting Environment variables"
export STACK_NAME=${TEAM}-${ENV}-${PROJECT}

echo -e "\n************** cdk.out clean-up (if exists)"
rm -rf cdk.out

echo -e "\n**************Check if S3 deployment Bucket exists"
CMD="$(which aws) s3api head-bucket --bucket $ACCOUNT_ID-cdk-v2-cloud-blocks"
echo ">> $CMD"
if [[ $($CMD 2>&1) ]]; then
    echo ">> Bucket doesn't exist, running bootstrap"
    #https://docs.aws.amazon.com/cdk/latest/guide/cli.html
    npx cdk bootstrap ${ACCOUNT_ID}/${AWS_REGION} \
    --toolkit-bucket-name=${ACCOUNT_ID}-cdk-v2-cloud-blocks \
    --public-access-block-configuration=false \
    --tags ResourceContact="${CDK_TAG_RESOURCE_CONTACT}" \
    --tags BillingCostCenter="${CDK_TAG_COST_CENTER}" \
    --tags AGTManaged="${CDK_TAG_AGT_MANAGED}" \
    --tags ResourcePurpose=${TEAM}-${ENV}-CDK-Deployement-Stack \
    --tags Environment="${ENV}" \
    --tags Division="${CDK_TAG_DIVISION}" 
else
    echo ">> Bucket [$ACCOUNT_ID-cdk-v2-cloud-blocks] exists. Skipping bootstrap... "
fi

echo -e  "\n************** CDK synthesize"
npx cdk diff
npx cdk synth

echo -e "\n************** CDK tests"
tsc && npm test

echo -e  "\n************** CDK Deploy"
npx cdk deploy --require-approval=$CDK_APPROVAL