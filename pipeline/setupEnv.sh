#!/bin/bash

# Check if environment argument is provided
if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <environment> <base_domain>"
  exit 1
fi

environment=$1 # The environment to deploy to
echo "Using Environment: $environment"
base_domain=$2 # The base domain to use
echo "Using Base Domain: $base_domain"


# Construct the domain name
domain_name="${environment}.${base_domain}"

# Define the target domain name and URLs
frontend_url="https://${domain_name}"
backend_url="https://${domain_name}/api"
# Added in case the backend and frontend domains diverge in the future
frontend_domain="$domain_name"
backend_domain="$domain_name"

# Write the domain names and URLs to the output environment
echo "frontend_url=${frontend_url}" >> $GITHUB_OUTPUT
echo "backend_url=${backend_url}" >> $GITHUB_OUTPUT
echo "frontend_domain=${frontend_domain}" >> $GITHUB_OUTPUT
echo "backend_domain=${backend_domain}" >> $GITHUB_OUTPUT
echo "domain_name=${domain_name}" >> $GITHUB_OUTPUT
