#!/bin/bash -e

mkdir -p plugins
PLUGINS="sonar-codescanlang-plugin-4.5.7.1.jar sonar-salesforce-plugin-4.5.7.1 sonar-dependency-check-plugin-2.0.8.jar"

function copy_plugin {
    echo "Copying $plugin from $SONAR_ARTIFACT_DIR to $SONAR_WORKING_DIR"
    \cp $SONAR_ARTIFACT_DIR/plugins/$plugin $SONAR_WORKING_DIR/extensions/plugins
}

for plugin in $PLUGINS
do
    if [ -f "$SONAR_ARTIFACT_DIR/plugins/$plugin" ]; then
        echo "[SKIP DOWNLOAD] $plugin exists for sonar"
        if ! [ -f "$SONAR_WORKING_DIR/extensions/plugins/$plugin" ]; then
            copy_plugin
        fi
    else
        curl -o plugins/$plugin -O "https://swfactory.aegon.com/artifactory/swf_generic/sonarqube/plugins/$plugin"
        copy_plugin
    fi
done

echo PLUGINS-INSTALLATION-COMPELTE