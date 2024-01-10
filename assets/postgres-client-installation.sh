#!/bin/bash -e

if yum list installed postgresql11; then
    echo "[SKIP DOWNLOAD] postgresql11 already exists"
else
    # Install the repository RPM:
    yum install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-7-x86_64/pgdg-redhat-repo-latest.noarch.rpm
    # Install PostgreSQL
    yum install -y postgresql11-server
fi

# Optionally initialize the database and enable automatic start:
/usr/pgsql-11/bin/postgresql-11-setup initdb

if systemctl status postgresql-11; then
    echo "[SKIP] postgresql-11.service active(running) "
else
    echo "Starting postgresql-11.service active(running) "
    systemctl enable postgresql-11
    systemctl start postgresql-11
fi