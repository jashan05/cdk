#!/bin/bash -e

TIMESTAMP=$(date +%Y-%m-%d.%H:%M:%S)

# Log Location on Server.
LOG_LOCATION=/var/log/sonar-installation-$TIMESTAMP.log
exec > >(tee -i $LOG_LOCATION) 2>&1
export SONAR_ARTIFACT_DIR=$1

export JAVA_VERSION='11.0.1'
export SONAR_VERSION='8.9.10.61524'
export JAVA_HOME=/usr/local/jdk-$JAVA_VERSION # JAVA_VERSION=11.0.1
export SONAR_WORKING_DIR=/opt/sonarqube-$SONAR_VERSION
export SONAR_DOWNLOAD_URL="https://binaries.sonarsource.com/CommercialDistribution/sonarqube-enterprise/sonarqube-enterprise-${SONAR_VERSION}.zip"

cd $SONAR_ARTIFACT_DIR

echo -e "\n############### Downloading application distibution and dependencies(if any) "
sh ./applications-installation.sh 

echo -e "\n############### Downloading Plugins from artifactory"
sh ./plugins-installation.sh 

echo -e "\n############### Creating application user sonar and setting permissions for SONAR DIR"
getent group sonar || groupadd sonar
if grep -q "^sonar:" /etc/passwd ;then
    echo "[SKIPPING USER CREATION] User already exists."
else
    useradd sonar -g sonar
fi
chown -R sonar:sonar $SONAR_WORKING_DIR
chmod -R 755 $SONAR_WORKING_DIR

echo -e "\n############### Setting pre-requisites from SonarQube. Ref https://docs.sonarqube.org/8.9/requirements/requirements/"
\cp sysctl.conf /etc/sysctl.conf
\cp limits.conf /etc/security/limits.conf
/usr/sbin/sysctl -p

echo -e "\n############### Downloading and running psql client"
sh ./postgres-client-installation.sh

echo -e "\n############### Checking sonar server status and restarting (if needed)"
if $SONAR_WORKING_DIR/bin/linux-x86-64/sonar.sh status; then
    echo "Restarting SonarQube server for changes to take affect"
    $SONAR_WORKING_DIR/bin/linux-x86-64/sonar.sh restart
else
    echo "Starting sonarqube server... "
    $SONAR_WORKING_DIR/bin/linux-x86-64/sonar.sh start
fi

echo SETUP-END
#psql -H sonarhyp-prod-copy-db.cabuvq9rvriq.eu-west-1.rds.amazonaws.com -U sonar