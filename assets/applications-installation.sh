#!/bin/bash -e

# Update JAVA location in wrapper.conf
function update_wrapper {
    echo "Updating 'wrapper.java.command' path in wrapper.conf"
    sed -i 's>wrapper.java.command=java>wrapper.java.command='$JAVA_HOME'/bin/java>g' $SONAR_WORKING_DIR/conf/wrapper.conf
}

# "Downloading & installing JAVA"
if [ -d "$JAVA_HOME" ]; then
    echo "[SKIP DOWNLOAD] $JAVA_HOME exists for JAVA_VERSION: $JAVA_VERSION"
else
    echo "Downloading Java-$JAVA_VERSION from artifactory"
    curl -O "https://swfactory.aegon.com/artifactory/swf_generic/java/$JAVA_VERSION/java.tar.gz"
    tar zxvf java.tar.gz
    mv jdk-$JAVA_VERSION /usr/local/
    chmod -R 755 $JAVA_HOME
    if grep -qF -- "JAVA_HOME" ~/.bashrc ; then
       sed -i 's>^export JAVA_HOME=.*>export JAVA_HOME='$JAVA_HOME'>g' ~/.bashrc
    else
        echo "export JAVA_HOME=$JAVA_HOME" >> ~/.bashrc
    fi
    source ~/.bashrc
    if [ -d "$SONAR_WORKING_DIR" ]; then 
        update_wrapper
    fi
fi

# "Downloading sonarqube distribution from artifact"
if [ -d "$SONAR_WORKING_DIR" ]; then
    echo "[SKIP DOWNLOAD] $SONAR_WORKING_DIR exists for sonar version: $SONAR_VERSION"
else
    echo "Downloading SonarQube-${SONAR_VERSION} from Sonar distribution"
    curl -o sonarqube.zip ${SONAR_DOWNLOAD_URL}
    unzip sonarqube.zip -d /opt
    
    # Copying sonar.properties from S3 to conf/
    echo "Copying sonar.properties from $SONAR_ARTIFACT_DIR to  $SONAR_WORKING_DIR "
    \cp ./sonar.properties $SONAR_WORKING_DIR/conf/sonar.properties
    
    # Update USER_NAME in sonar.sh
    echo "Updating sonar user in sonar.sh"
    sed -i 's/#RUN_AS_USER=/RUN_AS_USER=sonar/g' $SONAR_WORKING_DIR/bin/linux-x86-64/sonar.sh
    update_wrapper
    
    # Checking and stopping old running sonar version
    if grep -qF -- "SONAR_RUNNING_VERSION" ~/.bashrc ; then
        echo "Stopping the Old SonarQube running version(if any)"
        $SONAR_RUNNING_VERSION/bin/linux-x86-64/sonar.sh stop
        sed -i 's>^export SONAR_RUNNING_VERSION=.*>export SONAR_RUNNING_VERSION='$SONAR_WORKING_DIR'>g' ~/.bashrc
    else
        echo "export SONAR_RUNNING_VERSION=$SONAR_WORKING_DIR" >> ~/.bashrc
    fi
    source ~/.bashrc

    CURRENT_FOLDER=/opt/sonarqube
    echo "Creating SYMLINK between $CURRENT_FOLDER and $SONAR_WORKING_DIR "
    rm -Rf ${CURRENT_FOLDER} && ln -s ${SONAR_WORKING_DIR} ${CURRENT_FOLDER}
fi

echo APPLICATION-INSTALLTION-END
