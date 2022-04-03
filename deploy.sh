#!/bin/bash
project=cdn
host="$1"
if [ -z "$host" ]; then
  echo "Usage: $0 <host>"
  exit 1
fi

target=/var/www/htdocs/$project
config=/etc/nginx/sites-available/$project

echo "Deploying $project to $host"
echo "Removing $target"
ssh $host "rm -rf $target"
echo "Copying files"
scp -Crq src $host:$target
echo "Applying new configuraiton"
scp -Crq nginx.conf $host:$config
echo "Configuring nginx"
ssh $host "user-restart-nginx"
echo "Done"
